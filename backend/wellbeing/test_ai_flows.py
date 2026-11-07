from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from core.models import Consent
from safety.models import Escalation, RiskFlag
from screening.tests.helpers import make_user, seed
from wellbeing import ai, ai_client, clock
from wellbeing.models import JournalEntry, JournalPrompt, MoodEntry

JOURNAL = '/api/journal/'
PROMPT = '/api/journal/prompt/'
NOON = datetime(2026, 11, 7, 4, 0, tzinfo=dt_timezone.utc)
ON = dict(AI_FEATURES_ENABLED=True, OPENAI_API_KEY='sk-test')

GOOD_REFLECTION = {'message': 'That sounds like a tiring day. Thank you for writing it down.',
                   'nudge': 'Be gentle with yourself tonight.'}


class FakeAI:
    """Stands in for ai_client.complete_json. Records every call; each kind can return a dict or raise."""

    def __init__(self, **handlers):
        self.calls = []
        self.handlers = {'risk': {'risk': False}, 'reflect': dict(GOOD_REFLECTION),
                         'reword': {'lead_in': 'It sounds like today was a lot.'}}
        self.handlers.update(handlers)

    def __call__(self, system, user, *, timeout, max_tokens=300):  # no other arguments can slip through
        kind = {ai.RISK_SYSTEM: 'risk', ai.REFLECT_SYSTEM: 'reflect', ai.REWORD_SYSTEM: 'reword'}[system]
        self.calls.append({'kind': kind, 'user': user, 'timeout': timeout, 'max_tokens': max_tokens,
                           'entries_saved': JournalEntry.objects.count()})
        handler = self.handlers[kind]
        if isinstance(handler, Exception):
            raise handler
        return handler(user) if callable(handler) else handler

    def kinds(self):
        return [c['kind'] for c in self.calls]


def at(when):
    return mock.patch('wellbeing.clock.timezone.now', return_value=when)


def consent(user, kind='AI_ANALYSIS', granted=True):
    Consent.objects.create(user=user, consent_type=kind, granted=granted, notice_version='v1', language_code='en')


def prompt(domain='SLEEP', text='How has your rest been lately?', **kw):
    return JournalPrompt.objects.create(domain_code=domain, language_code='en', prompt_text=text,
                                        review_status='PUBLISHED', **kw)


class Base(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.client.force_authenticate(self.user)
        self.fake = FakeAI()
        patcher = mock.patch('wellbeing.ai_client.complete_json', side_effect=self.fake)
        patcher.start()
        self.addCleanup(patcher.stop)

    def write(self, body='I had a long day at work.', **extra):
        return self.client.post(JOURNAL, {'body': body, **extra}, format='json')


@override_settings(**ON)
class ReflectionFlowTests(Base):
    def setUp(self):
        super().setUp()
        consent(self.user)

    def test_happy_path_returns_and_stores_an_encrypted_reflection(self):
        res = self.write('Work was exhausting today.')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['ai_status'], 'ok')
        self.assertEqual(res.data['reflection'], GOOD_REFLECTION)
        self.assertIsNone(res.data['crisis'])
        entry = JournalEntry.objects.get()
        self.assertTrue(entry.ai_analyzed)
        self.assertNotIn('tiring', entry.ai_reflection)  # ciphertext
        self.assertEqual(entry.get_reflection(), GOOD_REFLECTION)
        self.assertEqual(self.fake.kinds(), ['risk', 'reflect'])

    def test_reflection_is_returned_when_reading_the_entry_back(self):
        entry_id = self.write().data['entry_id']
        self.assertEqual(self.client.get(f'{JOURNAL}{entry_id}/').data['reflection'], GOOD_REFLECTION)
        self.assertEqual(self.client.get(JOURNAL).data[0]['reflection'], GOOD_REFLECTION)

    def test_timeouts_and_token_limits(self):
        self.write()
        by_kind = {c['kind']: c for c in self.fake.calls}
        self.assertEqual(by_kind['risk']['timeout'], 5)
        self.assertEqual(by_kind['reflect']['timeout'], 10)

    def test_the_entry_is_already_saved_when_the_ai_is_called(self):
        self.write()
        self.assertTrue(all(c['entries_saved'] == 1 for c in self.fake.calls))

    def test_the_risk_check_runs_first_and_the_reflection_only_if_it_passes(self):
        self.write()
        self.assertEqual(self.fake.kinds()[0], 'risk')

    # --- the AI risk layer
    def test_ai_risk_flags_a_crisis_the_keywords_missed(self):
        self.fake.handlers['risk'] = {'risk': True}
        res = self.write('Everyone would be happier if I just was not around anymore.')
        self.assertEqual(res.data['ai_status'], 'crisis')
        self.assertIsNone(res.data['reflection'])
        self.assertTrue(res.data['crisis']['hotlines'])
        flag = RiskFlag.objects.get()
        self.assertEqual((flag.source, flag.level, flag.source_ref_type), ('JOURNAL_CLASSIFIER', 'CRISIS', 'JOURNAL_ENTRY'))
        self.assertEqual(Escalation.objects.get().flag, flag)
        self.assertEqual(self.fake.kinds(), ['risk'])  # no encouraging reply for someone at risk
        self.assertIsNone(JournalEntry.objects.get().ai_reflection)

    def test_the_user_still_gets_the_crisis_screen_if_recording_the_flag_fails(self):
        self.fake.handlers['risk'] = {'risk': True}
        with mock.patch('wellbeing.journal.raise_flag', side_effect=RuntimeError('db down')):
            with self.assertLogs('wellbeing.journal', level='ERROR'):
                res = self.write('I do not want to be here')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['ai_status'], 'crisis')
        self.assertTrue(res.data['crisis']['hotlines'])

    def test_keyword_crisis_never_reaches_the_ai_at_all(self):
        res = self.write('I want to kill myself')
        self.assertEqual(res.data['ai_status'], 'crisis')
        self.assertEqual(self.fake.calls, [])
        self.assertEqual(RiskFlag.objects.get().source, 'JOURNAL_KEYWORD')

    def test_if_the_risk_check_fails_no_reply_is_generated(self):
        self.fake.handlers['risk'] = ai_client.AIUnavailable('timeout')
        res = self.write()
        self.assertEqual((res.status_code, res.data['ai_status']), (201, 'unavailable'))
        self.assertIsNone(res.data['reflection'])
        self.assertEqual(self.fake.kinds(), ['risk'])
        self.assertEqual(JournalEntry.objects.count(), 1)

    def test_a_malformed_risk_answer_counts_as_a_failed_check(self):
        for bad in ({'risk': 'no'}, {}, {'risk': None}, {'risk': 0}):
            JournalEntry.objects.all().delete()
            self.fake.calls.clear()
            self.fake.handlers['risk'] = bad
            res = self.write()
            self.assertEqual(res.data['ai_status'], 'unavailable', bad)
            self.assertEqual(self.fake.kinds(), ['risk'], bad)

    # --- failures of the reply itself
    def test_reflection_failure_keeps_the_entry_and_says_unavailable(self):
        self.fake.handlers['reflect'] = ai_client.AIUnavailable('timeout')
        res = self.write()
        self.assertEqual((res.status_code, res.data['ai_status']), (201, 'unavailable'))
        self.assertIsNone(res.data['reflection'])
        entry = JournalEntry.objects.get()
        self.assertIsNone(entry.ai_reflection)
        self.assertEqual(RiskFlag.objects.count(), 0)

    def test_a_reply_that_breaks_the_rules_is_discarded_not_stored(self):
        for bad in ({'message': 'This sounds like depression, ask about medication.'}, {'message': ''}, {},
                    {'message': 'Call 0917 123 4567'}, {'message': 'x' * 700}):
            JournalEntry.objects.all().delete()
            self.fake.handlers['reflect'] = bad
            res = self.write()
            self.assertEqual(res.data['ai_status'], 'unavailable', bad)
            self.assertIsNone(res.data['reflection'])
            self.assertIsNone(JournalEntry.objects.get().ai_reflection)

    def test_an_unexpected_error_in_the_ai_layer_never_breaks_saving(self):
        self.fake.handlers['reflect'] = RuntimeError('anything at all')
        res = self.write()
        self.assertEqual((res.status_code, res.data['ai_status']), (201, 'unavailable'))
        self.assertEqual(JournalEntry.objects.count(), 1)

    def test_response_contract_keys_are_unchanged(self):
        self.assertEqual(set(self.write().data), {'entry_id', 'written_at', 'reflection', 'ai_status', 'crisis'})

    # --- what is sent
    def test_no_identifier_is_sent_and_contact_details_in_the_text_are_redacted(self):
        self.user.first_name, self.user.display_name = 'Lawrence', 'Larry'
        self.user.save()
        body = 'Text me at 0917 123 4567 or juan@example.com, see https://example.com/me'
        self.write(body)
        for call in self.fake.calls:
            sent = call['user']
            for secret in (str(self.user.user_id), self.user.mobile_number, 'Poro', 'Lawrence', 'Larry',
                           '0917', 'juan@', 'example.com'):
                self.assertNotIn(secret, sent, (call['kind'], secret))
            self.assertIn('[number]', sent)
            self.assertIn('[email]', sent)
            self.assertIn('[link]', sent)

    def test_the_prompt_the_user_answered_is_sent_as_context(self):
        p = prompt(text='What helps you wind down in the evening?')
        self.write('Music, mostly.', prompt_id=p.id)
        reflect = next(c for c in self.fake.calls if c['kind'] == 'reflect')
        self.assertIn('What helps you wind down in the evening?', reflect['user'])

    def test_mood_context_is_sent_when_logged(self):
        with at(NOON):
            for offset in (1, 2, 3):
                MoodEntry.objects.create(user=self.user, entry_date=clock.today_ph() - timedelta(days=offset), mood_score=8)
            MoodEntry.objects.create(user=self.user, entry_date=clock.today_ph(), mood_score=3, reason_code='SLEEP')
            self.write()
        reflect = next(c for c in self.fake.calls if c['kind'] == 'reflect')
        self.assertIn('3', reflect['user'])
        self.assertIn('lower than usual', reflect['user'])
        self.assertIn('sleep', reflect['user'].lower())

    def test_no_mood_context_when_not_logged(self):
        self.write()
        reflect = next(c for c in self.fake.calls if c['kind'] == 'reflect')
        self.assertIn('not logged', reflect['user'].lower())

    def test_the_users_language_is_passed(self):
        self.user.profile.language_code = 'fil'
        self.user.profile.save()
        self.write()
        reflect = next(c for c in self.fake.calls if c['kind'] == 'reflect')
        self.assertIn('Filipino', reflect['user'])


@override_settings(**ON)
class ConsentAndSwitchTests(Base):
    def test_no_consent_means_nothing_is_ever_sent(self):
        res = self.write()
        self.assertEqual(res.data['ai_status'], 'no_consent')
        self.assertEqual(self.fake.calls, [])
        self.assertFalse(JournalEntry.objects.get().ai_analyzed)

    def test_withdrawn_consent_takes_effect_on_the_next_entry(self):
        consent(self.user)
        self.assertEqual(self.write().data['ai_status'], 'ok')
        consent(self.user, granted=False)
        before = len(self.fake.calls)
        self.assertEqual(self.write().data['ai_status'], 'no_consent')
        self.assertEqual(len(self.fake.calls), before)

    def test_other_consents_do_not_count(self):
        consent(self.user, 'PROFESSIONAL_SHARING')
        self.assertEqual(self.write().data['ai_status'], 'no_consent')
        self.assertEqual(self.fake.calls, [])

    @override_settings(AI_FEATURES_ENABLED=False)
    def test_the_kill_switch_stops_everything_even_with_consent(self):
        consent(self.user)
        res = self.write()
        self.assertEqual(res.data['ai_status'], 'unavailable')
        self.assertEqual(self.fake.calls, [])
        self.assertFalse(JournalEntry.objects.get().ai_analyzed)

    @override_settings(OPENAI_API_KEY='')
    def test_no_key_behaves_like_the_switch_being_off(self):
        consent(self.user)
        self.assertEqual(self.write().data['ai_status'], 'unavailable')
        self.assertEqual(self.fake.calls, [])

    def test_text_that_was_sent_is_recorded_even_if_the_ai_then_failed(self):
        consent(self.user)
        self.fake.handlers['risk'] = ai_client.AIUnavailable('timeout')
        self.write()
        self.assertTrue(JournalEntry.objects.get().ai_analyzed)


@override_settings(**ON)
class PromptWordingTests(Base):
    def setUp(self):
        super().setUp()
        consent(self.user)
        self.p = prompt(text='How has your rest been lately?')

    def get(self):
        return self.client.get(PROMPT).data

    def test_the_reviewed_question_is_kept_verbatim_after_a_warm_lead_in(self):
        data = self.get()
        self.assertEqual(data['source'], 'personalized')
        self.assertEqual(data['text'], 'It sounds like today was a lot. How has your rest been lately?')
        self.assertEqual((data['prompt_id'], data['domain']), (self.p.id, 'SLEEP'))
        self.assertEqual(self.fake.calls[0]['timeout'], 4)

    def test_what_the_ai_is_given_has_no_identifiers(self):
        self.get()
        sent = self.fake.calls[0]['user']
        self.assertIn('How has your rest been lately?', sent)
        for secret in (str(self.user.user_id), self.user.mobile_number, 'Poro'):
            self.assertNotIn(secret, sent)

    def test_mood_tunes_the_wording(self):
        with at(NOON):
            MoodEntry.objects.create(user=self.user, entry_date=clock.today_ph(), mood_score=2, reason_code='SLEEP')
            self.get()
        self.assertIn('2', self.fake.calls[0]['user'])

    def test_a_successful_wording_is_reused_not_regenerated(self):
        first = self.get()
        self.assertEqual(self.get(), first)
        self.assertEqual(len(self.fake.calls), 1)

    def test_no_consent_gets_the_plain_reviewed_prompt_and_no_call(self):
        consent(self.user, granted=False)
        data = self.get()
        self.assertEqual((data['source'], data['text']), ('bank', 'How has your rest been lately?'))
        self.assertEqual(self.fake.calls, [])

    @override_settings(AI_FEATURES_ENABLED=False)
    def test_switch_off_gets_the_plain_prompt(self):
        self.assertEqual(self.get()['source'], 'bank')
        self.assertEqual(self.fake.calls, [])

    def test_failure_falls_back_and_does_not_retry_on_every_request(self):
        self.fake.handlers['reword'] = ai_client.AIUnavailable('timeout')
        data = self.get()
        self.assertEqual((data['source'], data['text']), ('bank', 'How has your rest been lately?'))
        self.get()
        self.get()
        self.assertEqual(len(self.fake.calls), 1)  # a short pause after a failure, so the screen is not slowed each time

    def test_unacceptable_lead_ins_fall_back_to_the_reviewed_prompt(self):
        for bad in ({'lead_in': 'You seem depressed.'}, {'lead_in': 'How are you?'}, {'lead_in': 'a' * 200},
                    {'lead_in': 'I want to die too.'}, {'lead_in': ''}, {}, {'lead_in': 5}):
            cache.clear()
            self.fake.handlers['reword'] = bad
            data = self.get()
            self.assertEqual((data['source'], data['text']), ('bank', 'How has your rest been lately?'), bad)

    def test_an_unexpected_error_still_returns_a_prompt(self):
        self.fake.handlers['reword'] = RuntimeError('anything')
        self.assertEqual(self.get()['source'], 'bank')

    def test_posting_with_the_prompt_id_still_works(self):
        data = self.get()
        self.assertEqual(self.write(prompt_id=data['prompt_id']).status_code, 201)

    def test_empty_bank_makes_no_call(self):
        JournalPrompt.objects.all().delete()
        self.assertEqual(self.get()['source'], 'none')
        self.assertEqual(self.fake.calls, [])
