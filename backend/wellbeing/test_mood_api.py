from datetime import date, datetime, timedelta, timezone as dt_timezone
from unittest import mock

from django.db import IntegrityError, transaction
from rest_framework.test import APITestCase

from accounts.models import User
from wellbeing.models import MoodEntry

MOOD = '/api/mood/'
TODAY = '/api/mood/today/'


def utc(*args):
    return datetime(*args, tzinfo=dt_timezone.utc)


def at(when):
    """Pretend the server clock reads `when` (UTC)."""
    return mock.patch('wellbeing.clock.timezone.now', return_value=when)


NOON = utc(2026, 11, 7, 4, 0)  # 12:00 in Manila on 2026-11-07
D = date(2026, 11, 7)


def make_user(mobile='+639171234567'):
    return User.objects.create_user(mobile, 'S3cure-pass-123')


class MoodModelTests(APITestCase):
    def setUp(self):
        self.user = make_user()

    def create(self, score, day=D, user=None):
        with transaction.atomic():
            return MoodEntry.objects.create(user=user or self.user, entry_date=day, mood_score=score)

    def test_score_must_be_1_to_10(self):
        for bad in (0, 11, -3):
            with self.assertRaises(IntegrityError, msg=bad):
                self.create(bad)
        self.create(1)
        self.create(10, day=D + timedelta(days=1))

    def test_one_entry_per_user_per_day(self):
        self.create(5)
        with self.assertRaises(IntegrityError):
            self.create(6)
        self.create(6, user=make_user('+639171230099'))  # another user is fine

    def test_deleting_user_deletes_entries(self):
        self.create(5)
        self.user.delete()
        self.assertEqual(MoodEntry.objects.count(), 0)


class MoodApiBase(APITestCase):
    def setUp(self):
        self.user = make_user()
        self.client.force_authenticate(self.user)

    def log(self, score=7, when=NOON, **extra):
        with at(when):
            return self.client.post(MOOD, {'mood_score': score, **extra}, format='json')


class AuthTests(MoodApiBase):
    def test_all_endpoints_require_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(TODAY).status_code, 401)
        self.assertEqual(self.client.post(MOOD, {'mood_score': 5}).status_code, 401)
        self.assertEqual(self.client.get(MOOD).status_code, 401)


class TodayTests(MoodApiBase):
    def test_not_logged_yet(self):
        with at(NOON):
            res = self.client.get(TODAY)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'date': '2026-11-07', 'logged': False, 'entry': None})

    def test_after_logging(self):
        self.log(7, reason_code='SLEEP')
        with at(NOON):
            res = self.client.get(TODAY)
        self.assertTrue(res.data['logged'])
        self.assertEqual(res.data['entry']['mood_score'], 7)
        self.assertEqual(res.data['entry']['reason_code'], 'SLEEP')

    def test_other_users_entry_is_not_mine(self):
        MoodEntry.objects.create(user=make_user('+639171230098'), entry_date=D, mood_score=2)
        with at(NOON):
            self.assertFalse(self.client.get(TODAY).data['logged'])

    def test_resets_at_manila_midnight(self):
        self.log(7, when=utc(2026, 11, 7, 15, 0))
        with at(utc(2026, 11, 7, 16, 1)):  # 00:01 next day in Manila
            res = self.client.get(TODAY)
        self.assertEqual(res.data['date'], '2026-11-08')
        self.assertFalse(res.data['logged'])


class LogMoodTests(MoodApiBase):
    def test_creates_entry_with_server_date(self):
        res = self.log(7, reason_code='WORK')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['entry_date'], '2026-11-07')
        self.assertEqual((res.data['mood_score'], res.data['reason_code']), (7, 'WORK'))
        for key in ('id', 'logged_at'):
            self.assertIn(key, res.data)
        entry = MoodEntry.objects.get()
        self.assertEqual((entry.user_id, entry.entry_date), (self.user.user_id, D))

    def test_client_cannot_choose_the_date(self):
        res = self.log(7, entry_date='2020-01-01')
        self.assertEqual(res.data['entry_date'], '2026-11-07')

    def test_late_evening_utc_counts_as_manila_next_day(self):
        res = self.log(6, when=utc(2026, 11, 7, 20, 0))
        self.assertEqual(res.data['entry_date'], '2026-11-08')

    def test_reason_is_optional(self):
        res = self.log(4)
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.data['reason_code'])
        self.assertEqual(self.log(5, when=NOON + timedelta(days=1), reason_code=None).status_code, 201)
        self.assertEqual(self.log(5, when=NOON + timedelta(days=2), reason_code='').status_code, 201)

    def test_every_valid_reason_accepted(self):
        for i, reason in enumerate(['SLEEP', 'WORK', 'SCHOOL', 'FAMILY', 'HEALTH', 'RELATIONSHIP', 'FINANCES', 'OTHER']):
            res = self.log(5, when=NOON + timedelta(days=i), reason_code=reason)
            self.assertEqual(res.status_code, 201, reason)

    def test_boundaries_1_and_10_accepted(self):
        self.assertEqual(self.log(1).status_code, 201)
        self.assertEqual(self.log(10, when=NOON + timedelta(days=1)).status_code, 201)

    def test_invalid_scores_rejected_and_nothing_saved(self):
        for bad in (0, 11, -1, 7.5, 'abc', None, '', True, [5]):
            res = self.client.post(MOOD, {'mood_score': bad}, format='json')
            self.assertEqual(res.status_code, 400, repr(bad))
        self.assertEqual(self.client.post(MOOD, {}, format='json').status_code, 400)
        self.assertEqual(MoodEntry.objects.count(), 0)

    def test_invalid_reason_rejected(self):
        self.assertEqual(self.log(5, reason_code='BORED').status_code, 400)
        self.assertEqual(MoodEntry.objects.count(), 0)

    def test_second_log_same_day_is_409_and_keeps_original(self):
        self.log(7)
        res = self.log(2)
        self.assertEqual((res.status_code, res.data['code']), (409, 'already_logged'))
        self.assertEqual(MoodEntry.objects.get().mood_score, 7)

    def test_can_log_again_next_day(self):
        self.log(7)
        self.assertEqual(self.log(3, when=NOON + timedelta(days=1)).status_code, 201)
        self.assertEqual(MoodEntry.objects.count(), 2)

    def test_users_are_independent(self):
        self.log(7)
        self.client.force_authenticate(make_user('+639171230097'))
        self.assertEqual(self.log(3).status_code, 201)

    def test_race_on_unique_constraint_maps_to_409(self):
        with mock.patch('wellbeing.views.MoodEntry.objects.filter') as f:
            f.return_value.exists.return_value = False  # pass the pre-check, let the DB catch the duplicate
            self.log(7)
            res = self.log(8)
        self.assertEqual((res.status_code, res.data['code']), (409, 'already_logged'))
        self.assertEqual(MoodEntry.objects.get().mood_score, 7)


class HistoryTests(MoodApiBase):
    def seed(self, scores, start=D):
        for i, s in enumerate(scores):
            MoodEntry.objects.create(user=self.user, entry_date=start - timedelta(days=i), mood_score=s)

    def history(self, query=''):
        with at(NOON):
            return self.client.get(MOOD + query)

    def test_empty(self):
        res = self.history()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'entries': [], 'baseline': None})

    def test_newest_first_with_documented_fields(self):
        self.seed([7, 5, 6])
        entries = self.history().data['entries']
        self.assertEqual([e['mood_score'] for e in entries], [7, 5, 6])
        self.assertEqual(set(entries[0]), {'entry_date', 'mood_score', 'reason_code'})
        self.assertEqual(entries[0]['entry_date'], '2026-11-07')

    def test_days_window(self):
        self.seed([5] * 10)
        self.assertEqual(len(self.history('?days=3').data['entries']), 3)
        self.assertEqual(len(self.history('?days=1').data['entries']), 1)
        self.assertEqual(len(self.history().data['entries']), 10)

    def test_days_validation(self):
        for bad in ('0', '-5', 'abc', '366', '1.5', ''):
            self.assertEqual(self.history(f'?days={bad}').status_code, 400, bad)
        self.assertEqual(self.history('?days=365').status_code, 200)

    def test_only_own_entries(self):
        self.seed([7])
        MoodEntry.objects.create(user=make_user('+639171230096'), entry_date=D, mood_score=1)
        self.assertEqual(len(self.history().data['entries']), 1)

    def test_baseline_needs_three_entries(self):
        self.seed([6, 8])
        self.assertIsNone(self.history().data['baseline'])
        self.seed([5], start=D - timedelta(days=2))  # third distinct day
        self.assertEqual(self.history().data['baseline'], 6.3)

    def test_baseline_uses_fixed_30_day_window_not_the_days_param(self):
        self.seed([10, 10, 10])                                   # recent, inside 30 days
        self.seed([1, 1, 1], start=D - timedelta(days=60))        # old, outside the window
        self.assertEqual(self.history('?days=365').data['baseline'], 10.0)
        self.assertEqual(self.history('?days=1').data['baseline'], 10.0)
