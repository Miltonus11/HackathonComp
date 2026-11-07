from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock

from django.utils import timezone
from rest_framework.test import APITestCase

from core.models import Consent
from safety.models import AuditLog, Escalation, RiskFlag
from screening import services as screening
from screening.models import Assessment
from screening.tests.helpers import GAD7_MINIMAL, WHO5_POOR, make_user, seed, uniform
from wellbeing import clock
from wellbeing.models import JournalEntry, JournalPrompt, MoodEntry

JOURNAL = '/api/journal/'
PROMPT = '/api/journal/prompt/'
NOON = datetime(2026, 11, 7, 4, 0, tzinfo=dt_timezone.utc)  # 2026-11-07 in Manila


def at(when):
    return mock.patch('wellbeing.clock.timezone.now', return_value=when)


def make_prompt(domain='SLEEP', text=None, lang='en', weight=1, status='PUBLISHED', active=True, tone='NEUTRAL'):
    return JournalPrompt.objects.create(
        domain_code=domain, language_code=lang, prompt_text=text or f'{domain} prompt', rotation_weight=weight,
        review_status=status, is_active=active, tone=tone)


def one_prompt_per_domain():
    return {d: make_prompt(d) for d in ['MOOD', 'INTEREST', 'SLEEP', 'ENERGY', 'WORRY', 'CONCENTRATION', 'SELF_WORTH']}


def take_phq9(user, answers):
    s = screening.start_session(user).session
    screening.submit_instrument(s, 'WHO5', WHO5_POOR)
    screening.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
    screening.answer_phq9_choice(s, True)  # a not-good WHO-5 person chooses to take the longer questions
    screening.submit_instrument(s, 'PHQ9', {**uniform(9, 0), **answers})
    return s


def consent(user, kind, granted=True):
    Consent.objects.create(user=user, consent_type=kind, granted=granted, notice_version='v1', language_code='en')


class JournalBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        self.user = make_user()
        self.client.force_authenticate(self.user)

    def write(self, body='I had an ordinary day.', **extra):
        return self.client.post(JOURNAL, {'body': body, **extra}, format='json')


class PromptTests(JournalBase):
    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(PROMPT).status_code, 401)

    def test_returns_a_reviewed_prompt(self):
        p = make_prompt('SLEEP', 'How has your rest been?')
        res = self.client.get(PROMPT)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'prompt_id': p.id, 'domain': 'SLEEP', 'text': 'How has your rest been?',
                                    'source': 'bank'})

    def test_empty_bank_still_succeeds_so_free_writing_works(self):
        res = self.client.get(PROMPT)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'prompt_id': None, 'domain': None, 'text': None, 'source': 'none'})

    def test_only_published_active_prompts_are_served(self):
        for status, active in (('DRAFT', True), ('CLINICALLY_REVIEWED', True), ('RETIRED', True), ('PUBLISHED', False)):
            make_prompt(status=status, active=active)
        self.assertIsNone(self.client.get(PROMPT).data['prompt_id'])

    def test_uses_users_language_and_falls_back_to_english(self):
        self.user.profile.language_code = 'fil'
        self.user.profile.save()
        en = make_prompt('SLEEP', 'English one', lang='en')
        self.assertEqual(self.client.get(PROMPT).data['prompt_id'], en.id)
        fil = make_prompt('SLEEP', 'Filipino one', lang='fil')
        self.assertEqual(self.client.get(PROMPT).data['prompt_id'], fil.id)

    def test_works_for_a_user_without_a_profile(self):
        self.client.force_authenticate(make_user('+639171230031', profile=False))
        make_prompt('SLEEP')
        self.assertEqual(self.client.get(PROMPT).status_code, 200)

    def test_stable_within_the_day(self):
        one_prompt_per_domain()
        first = self.client.get(PROMPT).data
        self.assertEqual(self.client.get(PROMPT).data, first)

    def test_rotates_after_writing(self):
        one_prompt_per_domain()
        first = self.client.get(PROMPT).data
        self.assertEqual(self.write(prompt_id=first['prompt_id']).status_code, 201)
        self.assertNotEqual(self.client.get(PROMPT).data['domain'], first['domain'])

    def test_does_not_repeat_a_domain_for_three_entries(self):
        one_prompt_per_domain()
        seen = []
        for _ in range(3):
            p = self.client.get(PROMPT).data
            seen.append(p['domain'])
            self.write(prompt_id=p['prompt_id'])
        self.assertEqual(len(set(seen)), 3)

    def test_leans_toward_the_domain_of_todays_mood_reason(self):
        one_prompt_per_domain()
        with at(NOON):
            MoodEntry.objects.create(user=self.user, entry_date=clock.today_ph(), mood_score=4, reason_code='SLEEP')
            self.assertEqual(self.client.get(PROMPT).data['domain'], 'SLEEP')

    def test_leans_toward_the_users_top_phq9_domain(self):
        one_prompt_per_domain()
        take_phq9(self.user, {7: 3})
        self.assertEqual(self.client.get(PROMPT).data['domain'], 'CONCENTRATION')

    def test_item_9_never_steers_the_prompt(self):
        one_prompt_per_domain()
        take_phq9(self.user, {9: 3})
        self.assertEqual(self.client.get(PROMPT).data['domain'], 'MOOD')  # default, no signal

    def test_an_old_phq9_is_ignored(self):
        one_prompt_per_domain()
        take_phq9(self.user, {7: 3})
        Assessment.objects.update(taken_at=timezone.now() - timedelta(days=90))
        self.assertEqual(self.client.get(PROMPT).data['domain'], 'MOOD')

    def test_moves_on_when_the_best_domain_has_no_prompts(self):
        only = make_prompt('INTEREST')
        with at(NOON):
            MoodEntry.objects.create(user=self.user, entry_date=clock.today_ph(), mood_score=4, reason_code='SLEEP')
            self.assertEqual(self.client.get(PROMPT).data['prompt_id'], only.id)

    def test_available_whether_or_not_mood_is_logged(self):
        make_prompt('SLEEP')
        self.assertEqual(self.client.get(PROMPT).status_code, 200)


class PromptToneTests(JournalBase):
    def setUp(self):
        super().setUp()
        self.neutral = make_prompt('SLEEP', 'neutral q', tone='NEUTRAL')
        self.gentle = make_prompt('SLEEP', 'gentle q', tone='GENTLE')
        self.upbeat = make_prompt('SLEEP', 'upbeat q', tone='UPBEAT')

    def mood(self, score, reason='SLEEP', day_offset=0):
        MoodEntry.objects.create(user=self.user, entry_date=clock.today_ph() - timedelta(days=day_offset),
                                 mood_score=score, reason_code=reason)

    def prompt_id(self):
        with at(NOON):
            return self.client.get(PROMPT).data['prompt_id']

    def test_low_mood_gets_a_gentle_prompt(self):
        with at(NOON):
            self.mood(3)
        self.assertEqual(self.prompt_id(), self.gentle.id)

    def test_high_mood_gets_an_upbeat_prompt(self):
        with at(NOON):
            self.mood(9)
        self.assertEqual(self.prompt_id(), self.upbeat.id)

    def test_ordinary_mood_ignores_tone(self):
        with at(NOON):
            self.mood(6)
        self.assertEqual(self.prompt_id(), self.neutral.id)  # first created, all else equal

    def test_lower_than_usual_gets_a_gentle_prompt_even_above_the_absolute_threshold(self):
        with at(NOON):
            for offset in (1, 2, 3):
                self.mood(9, day_offset=offset)
            self.mood(6)
        self.assertEqual(self.prompt_id(), self.gentle.id)

    def test_todays_own_entry_does_not_count_toward_its_baseline(self):
        with at(NOON):
            for offset in (1, 2, 3):
                self.mood(6, day_offset=offset)
            self.mood(6)
        self.assertEqual(self.prompt_id(), self.neutral.id)

    def test_no_mood_logged_ignores_tone(self):
        self.assertEqual(self.prompt_id(), self.neutral.id)

    def test_falls_back_when_no_prompt_has_the_wanted_tone(self):
        JournalPrompt.objects.exclude(pk=self.neutral.pk).delete()
        with at(NOON):
            self.mood(2)
        self.assertEqual(self.prompt_id(), self.neutral.id)

    def test_a_very_low_score_never_changes_the_topic_or_raises_a_flag(self):
        with at(NOON):
            self.mood(1)
        self.assertEqual(self.client.get(PROMPT).data['domain'], 'SLEEP')
        self.assertEqual(RiskFlag.objects.count(), 0)


class WriteTests(JournalBase):
    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(JOURNAL, {'body': 'x'}).status_code, 401)

    def test_saves_encrypted_and_returns_the_contract(self):
        p = make_prompt('SLEEP')
        res = self.write('I slept badly all week.', prompt_id=p.id)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(set(res.data), {'entry_id', 'written_at', 'reflection', 'ai_status', 'crisis'})
        self.assertIsNone(res.data['reflection'])
        self.assertIsNone(res.data['crisis'])
        entry = JournalEntry.objects.get()
        self.assertNotIn('slept', entry.body)  # ciphertext in the database
        self.assertEqual(entry.prompt_id, p.id)
        self.assertEqual(entry.user_id, self.user.user_id)
        self.assertIsNotNone(entry.risk_scanned_at)
        self.assertFalse(entry.ai_analyzed)

    def test_free_writing_without_a_prompt(self):
        res = self.write('Just thinking out loud.')
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(JournalEntry.objects.get().prompt_id)

    def test_surrounding_whitespace_is_trimmed(self):
        entry_id = self.write('   hello   ').data['entry_id']
        self.assertEqual(self.client.get(f'{JOURNAL}{entry_id}/').data['body'], 'hello')

    def test_works_without_a_logged_mood(self):
        self.assertFalse(MoodEntry.objects.exists())
        self.assertEqual(self.write().status_code, 201)

    def test_ai_status_without_consent(self):
        self.assertEqual(self.write().data['ai_status'], 'no_consent')

    def test_ai_status_after_consent_is_unavailable_until_the_ai_step_exists(self):
        consent(self.user, 'AI_ANALYSIS')
        res = self.write()
        self.assertEqual(res.data['ai_status'], 'unavailable')
        self.assertIsNone(res.data['reflection'])
        self.assertFalse(JournalEntry.objects.get().ai_analyzed)

    def test_withdrawn_consent_counts_as_no_consent(self):
        consent(self.user, 'AI_ANALYSIS')
        consent(self.user, 'AI_ANALYSIS', granted=False)
        self.assertEqual(self.write().data['ai_status'], 'no_consent')

    def test_invalid_prompt_ids_rejected(self):
        draft = make_prompt(status='DRAFT')
        off = make_prompt(active=False)
        for bad in (99999, draft.id, off.id, 'abc'):
            self.assertEqual(self.write(prompt_id=bad).status_code, 400, bad)
        self.assertEqual(JournalEntry.objects.count(), 0)

    def test_body_validation(self):
        for bad in ('', '   ', None, 123, ['a'], 'x' * 5001):
            self.assertEqual(self.client.post(JOURNAL, {'body': bad}, format='json').status_code, 400, repr(bad)[:20])
        self.assertEqual(self.client.post(JOURNAL, {}, format='json').status_code, 400)
        self.assertEqual(self.write('x' * 5000).status_code, 201)
        self.assertEqual(JournalEntry.objects.count(), 1)


class CrisisScanTests(JournalBase):
    def test_crisis_entry_is_flagged_escalated_and_skips_the_ai(self):
        consent(self.user, 'AI_ANALYSIS')
        res = self.write('Today was awful and I want to kill myself')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['ai_status'], 'crisis')
        self.assertIsNone(res.data['reflection'])
        self.assertTrue(res.data['crisis']['hotlines'])
        self.assertTrue(res.data['crisis']['talk_to_a_person'])
        entry = JournalEntry.objects.get()
        flag = RiskFlag.objects.get()
        self.assertEqual((flag.source, flag.level, flag.status), ('JOURNAL_KEYWORD', 'CRISIS', 'OPEN'))
        self.assertEqual((flag.source_ref_type, str(flag.source_ref_id)), ('JOURNAL_ENTRY', str(entry.id)))
        self.assertEqual(Escalation.objects.get().flag, flag)
        self.assertIsNotNone(entry.risk_scanned_at)

    def test_scan_runs_with_no_consent_at_all(self):
        self.assertFalse(Consent.objects.filter(consent_type='AI_ANALYSIS').exists())
        self.assertEqual(self.write('gusto ko nang mamatay').data['ai_status'], 'crisis')

    def test_taglish_and_ilocano_are_scanned(self):
        self.assertEqual(self.write('ayoko na mabuhay').data['ai_status'], 'crisis')
        self.assertEqual(self.write('kayat ko ti matay').data['ai_status'], 'crisis')

    def test_escalation_mirrors_the_followup_preference(self):
        for mobile, followup in (('+639171230040', True), ('+639171230041', False)):
            user = make_user(mobile, followup=followup)
            self.client.force_authenticate(user)
            self.write('I want to die')
            self.assertEqual(Escalation.objects.get(flag__user=user).user_contactable, followup)

    def test_benign_entry_raises_nothing_but_is_still_scanned(self):
        res = self.write('Good day. I killed it at the gym.')
        self.assertEqual(res.data['ai_status'], 'no_consent')
        self.assertEqual(RiskFlag.objects.count(), 0)
        self.assertIsNotNone(JournalEntry.objects.get().risk_scanned_at)

    def test_no_text_is_copied_into_the_flag(self):
        self.write('I want to kill myself because of the exam')
        flag = RiskFlag.objects.get()
        self.assertNotIn('exam', ' '.join(str(getattr(flag, f.name)) for f in flag._meta.fields))

    def test_a_failure_while_escalating_saves_nothing(self):
        with mock.patch('safety.services.Escalation.objects.create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                self.write('I want to kill myself')
        self.assertEqual(JournalEntry.objects.count(), 0)
        self.assertEqual(RiskFlag.objects.count(), 0)


class ReadAndDeleteTests(JournalBase):
    def test_list_is_newest_first_decrypted_and_own_only(self):
        p = make_prompt('SLEEP', 'How is your rest?')
        self.write('first', prompt_id=p.id)
        self.write('second')
        other = make_user('+639171230050')
        self.client.force_authenticate(other)
        self.write('someone else')
        self.client.force_authenticate(self.user)
        rows = self.client.get(JOURNAL).data
        self.assertEqual([r['body'] for r in rows], ['second', 'first'])
        self.assertEqual(set(rows[0]), {'entry_id', 'written_at', 'prompt_text', 'body', 'reflection'})
        self.assertEqual((rows[1]['prompt_text'], rows[0]['prompt_text']), ('How is your rest?', None))
        self.assertIsNone(rows[0]['reflection'])

    def test_list_limit(self):
        for i in range(5):
            self.write(f'entry {i}')
        self.assertEqual(len(self.client.get(JOURNAL + '?limit=2').data), 2)
        self.assertEqual(len(self.client.get(JOURNAL).data), 5)
        for bad in ('0', '-1', 'abc', '201', ''):
            self.assertEqual(self.client.get(JOURNAL + f'?limit={bad}').status_code, 400, bad)

    def test_detail_own_and_others(self):
        entry_id = self.write('mine').data['entry_id']
        self.assertEqual(self.client.get(f'{JOURNAL}{entry_id}/').data['body'], 'mine')
        self.client.force_authenticate(make_user('+639171230051'))
        self.assertEqual(self.client.get(f'{JOURNAL}{entry_id}/').status_code, 404)
        self.assertEqual(self.client.delete(f'{JOURNAL}{entry_id}/').status_code, 404)
        self.assertEqual(JournalEntry.objects.count(), 1)

    def test_unreadable_entry_does_not_break_the_list(self):
        self.write('fine')
        bad = self.write('corrupt me').data['entry_id']
        JournalEntry.objects.filter(pk=bad).update(body='not-a-valid-token')
        rows = self.client.get(JOURNAL).data
        self.assertEqual(sorted(str(r['body']) for r in rows), ['None', 'fine'])

    def test_delete_is_a_hard_delete_and_is_audited(self):
        entry_id = self.write('delete me').data['entry_id']
        res = self.client.delete(f'{JOURNAL}{entry_id}/')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(JournalEntry.objects.count(), 0)
        self.assertEqual(self.client.get(f'{JOURNAL}{entry_id}/').status_code, 404)
        log = AuditLog.objects.get(action='DELETE_JOURNAL')
        self.assertEqual((log.actor_type, str(log.actor_id), str(log.target_id), log.result),
                         ('USER', str(self.user.user_id), entry_id, 'ALLOWED'))
        self.assertNotIn('delete me', ' '.join(str(getattr(log, f.name)) for f in log._meta.fields))

    def test_deleting_a_crisis_entry_keeps_the_safety_record(self):
        entry_id = self.write('I want to kill myself').data['entry_id']
        self.client.delete(f'{JOURNAL}{entry_id}/')
        self.assertEqual(RiskFlag.objects.count(), 1)  # accountability record stays; it holds no journal text
        self.assertEqual(Escalation.objects.count(), 1)

    def test_deleting_the_user_deletes_their_entries(self):
        self.write('bye')
        self.user.delete()
        self.assertEqual(JournalEntry.objects.count(), 0)
