from rest_framework.test import APITestCase

from safety.models import Escalation, RiskFlag

from .helpers import (GAD7_MINIMAL, ITEM9_NEGATIVE, ITEM9_POSITIVE, PHQ9_MINIMAL, WHO5_GOOD, WHO5_POOR, make_user,
                      phq9_item9_only, seed)

SESSIONS = '/api/screening/sessions/'


def body(code, answers):
    return {'instrument': code, 'responses': [{'item_no': n, 'value': v} for n, v in answers.items()]}


class ScreeningApiBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        cls.user = make_user()

    def setUp(self):
        self.client.force_authenticate(self.user)

    def start(self):
        res = self.client.post(SESSIONS, {})
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def answer(self, sid, code, answers):
        return self.client.post(f'{SESSIONS}{sid}/answers/', body(code, answers), format='json')

    def choose(self, sid, accept):
        return self.client.post(f'{SESSIONS}{sid}/choice/', {'accept': accept}, format='json')


class StartTests(ScreeningApiBase):
    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(SESSIONS, {}).status_code, 401)

    def test_start_returns_who5_form(self):
        data = self.start()
        self.assertEqual(data['next']['instrument'], 'WHO5')
        self.assertEqual(len(data['next']['items']), 5)
        self.assertEqual(len(data['next']['options']), 6)
        self.assertEqual(data['next']['items'][0], {'item_no': 1, 'text': 'I have felt cheerful and in good spirits'})

    def test_consent_required_is_403_with_code(self):
        self.client.force_authenticate(make_user('+639171230002', consent=False))
        res = self.client.post(SESSIONS, {})
        self.assertEqual((res.status_code, res.data['code']), (403, 'consent_required'))

    def test_profile_required_is_403_with_code(self):
        self.client.force_authenticate(make_user('+639171230003', profile=False))
        res = self.client.post(SESSIONS, {})
        self.assertEqual((res.status_code, res.data['code']), (403, 'profile_required'))


class FlowTests(ScreeningApiBase):
    def test_good_wellbeing_path_skips_phq9_but_asks_item9(self):
        sid = self.start()['session_id']
        r1 = self.answer(sid, 'WHO5', WHO5_GOOD)
        self.assertEqual(r1.status_code, 200, r1.data)
        self.assertEqual(r1.data['next']['instrument'], 'GAD7')
        self.assertEqual(r1.data['result']['severity_code'], 'GOOD')
        self.assertEqual(r1.data['result']['scaled_score'], '80.0')
        self.assertIsNone(r1.data['crisis'])
        r2 = self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.assertFalse(r2.data['completed'])
        self.assertEqual(r2.data['next']['instrument'], 'PHQ9_ITEM9')
        self.assertEqual(len(r2.data['next']['items']), 1)
        self.assertEqual(len(r2.data['next']['options']), 4)
        r3 = self.answer(sid, 'PHQ9_ITEM9', ITEM9_NEGATIVE)
        self.assertTrue(r3.data['completed'])
        self.assertIsNone(r3.data['next'])
        self.assertIsNone(r3.data['crisis'])
        self.assertIn('headline', r3.data['result']['advice'])
        self.assertNotIn('combined_score', r3.data)

    def test_good_wellbeing_with_item9_positive_returns_crisis(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_GOOD)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        res = self.answer(sid, 'PHQ9_ITEM9', ITEM9_POSITIVE)
        self.assertTrue(res.data['crisis']['hotlines'])
        self.assertTrue(res.data['completed'])
        self.assertEqual(RiskFlag.objects.get().level, 'CRISIS')

    def test_poor_wellbeing_asks_the_person_before_phq9(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        r2 = self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.assertIsNone(r2.data['next'])
        self.assertFalse(r2.data['completed'])
        self.assertEqual(r2.data['choice'], 'MOOD_QUESTIONS')

    def test_accepting_the_choice_returns_the_phq9_form(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        res = self.choose(sid, True)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['next']['instrument'], 'PHQ9')
        self.assertEqual(len(res.data['next']['items']), 9)
        self.assertFalse(res.data['completed'])
        self.assertIsNone(res.data['choice'])
        r3 = self.answer(sid, 'PHQ9', PHQ9_MINIMAL)
        self.assertTrue(r3.data['completed'])
        self.assertIsNone(r3.data['choice'])

    def test_declining_goes_to_results_with_only_wellbeing_and_anxiety(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        res = self.choose(sid, False)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data['completed'])
        self.assertIsNone(res.data['next'])
        detail = self.client.get(f'{SESSIONS}{sid}/').data
        self.assertTrue(detail['completed'])
        self.assertIsNone(detail['choice'])
        self.assertEqual([r['instrument'] for r in detail['results']], ['WHO5', 'GAD7'])

    def test_phq9_before_the_choice_is_rejected(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        res = self.answer(sid, 'PHQ9', PHQ9_MINIMAL)
        self.assertEqual((res.status_code, res.data['code']), (400, 'choice_required'))

    def test_detail_while_choice_pending_resumes_at_the_choice(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        data = self.client.get(f'{SESSIONS}{sid}/').data
        self.assertEqual(data['choice'], 'MOOD_QUESTIONS')
        self.assertIsNone(data['next'])
        self.assertFalse(data['completed'])

    def test_good_wellbeing_never_gets_a_choice(self):
        sid = self.start()['session_id']
        r1 = self.answer(sid, 'WHO5', WHO5_GOOD)
        r2 = self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.assertIsNone(r1.data['choice'])
        self.assertIsNone(r2.data['choice'])
        res = self.choose(sid, True)
        self.assertEqual((res.status_code, res.data['code']), (400, 'no_choice_pending'))

    def test_choice_validation_and_ownership(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.assertEqual(self.client.post(f'{SESSIONS}{sid}/choice/', {}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'{SESSIONS}{sid}/choice/', {'accept': 'maybe'}, format='json').status_code, 400)
        self.client.force_authenticate(make_user('+639171230006'))
        self.assertEqual(self.choose(sid, True).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.choose(sid, True).status_code, 401)

    def test_choice_after_completion_is_409(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.choose(sid, False)
        res = self.choose(sid, True)
        self.assertEqual((res.status_code, res.data['code']), (409, 'session_complete'))

    def test_item9_returns_crisis_block_first(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.choose(sid, True)
        res = self.answer(sid, 'PHQ9', phq9_item9_only())
        self.assertEqual(res.data['result']['severity_code'], 'MINIMAL')
        crisis = res.data['crisis']
        self.assertTrue(crisis['hotlines'])
        self.assertTrue(crisis['talk_to_a_person'])
        self.assertEqual(RiskFlag.objects.get().level, 'CRISIS')
        self.assertEqual(Escalation.objects.count(), 1)

    def test_wrong_instrument_is_400(self):
        sid = self.start()['session_id']
        res = self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.assertEqual((res.status_code, res.data['code']), (400, 'wrong_instrument'))

    def test_invalid_responses_is_400(self):
        sid = self.start()['session_id']
        res = self.client.post(f'{SESSIONS}{sid}/answers/', body('WHO5', {1: 9, 2: 1, 3: 1, 4: 1, 5: 1}), format='json')
        self.assertEqual((res.status_code, res.data['code']), (400, 'invalid_responses'))

    def test_malformed_body_is_400(self):
        sid = self.start()['session_id']
        for bad in ({}, {'instrument': 'WHO5'}, {'instrument': 'WHO5', 'responses': 'x'},
                    {'instrument': 'WHO5', 'responses': [{'item_no': 1}]},
                    {'instrument': 'WHO5', 'responses': [{'item_no': 1, 'value': 'a'}]},
                    {'instrument': 'WHO5', 'responses': [{'item_no': 1, 'value': 1}, {'item_no': 1, 'value': 2}]}):
            res = self.client.post(f'{SESSIONS}{sid}/answers/', bad, format='json')
            self.assertEqual(res.status_code, 400, bad)

    def test_submitting_after_completion_is_409(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_GOOD)
        self.answer(sid, 'GAD7', GAD7_MINIMAL)
        self.answer(sid, 'PHQ9_ITEM9', ITEM9_NEGATIVE)
        res = self.answer(sid, 'WHO5', WHO5_GOOD)
        self.assertEqual((res.status_code, res.data['code']), (409, 'session_complete'))


class OwnershipAndHistoryTests(ScreeningApiBase):
    def test_other_users_session_is_404(self):
        sid = self.start()['session_id']
        self.client.force_authenticate(make_user('+639171230004'))
        self.assertEqual(self.client.get(f'{SESSIONS}{sid}/').status_code, 404)
        self.assertEqual(self.answer(sid, 'WHO5', WHO5_GOOD).status_code, 404)

    def test_detail_shows_results_and_resumes_next_step(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', WHO5_POOR)
        data = self.client.get(f'{SESSIONS}{sid}/').data
        self.assertEqual([r['instrument'] for r in data['results']], ['WHO5'])
        self.assertEqual(data['next']['instrument'], 'GAD7')
        self.assertFalse(data['completed'])

    def test_detail_includes_crisis_when_shown(self):
        sid = self.start()['session_id']
        self.answer(sid, 'WHO5', {1: 0, 2: 0, 3: 0, 4: 0, 5: 0})
        data = self.client.get(f'{SESSIONS}{sid}/').data
        self.assertTrue(data['crisis_shown'])
        self.assertTrue(data['crisis']['hotlines'])

    def test_list_only_own_sessions_newest_first(self):
        a = self.start()['session_id']
        b = self.start()['session_id']
        self.client.force_authenticate(make_user('+639171230005'))
        self.assertEqual(self.client.get(SESSIONS).data, [])
        self.client.force_authenticate(self.user)
        ids = [s['session_id'] for s in self.client.get(SESSIONS).data]
        self.assertEqual(ids, [b, a])
