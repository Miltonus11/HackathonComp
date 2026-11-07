from django.test import TestCase

from core.models import Consent
from safety.models import Escalation, RiskFlag
from screening import services
from screening.models import Assessment, AssessmentResponse, AssessmentSession

from .helpers import (GAD7_MINIMAL, GAD7_SEVERE, PHQ9_MINIMAL, PHQ9_SEVERE, WHO5_GOOD, WHO5_POOR, WHO5_VERY_LOW,
                      make_user, phq9_item9_only, seed)


class ServiceTestBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        seed()

    def setUp(self):
        self.user = make_user()

    def start(self, user=None):
        return services.start_session(user or self.user)


class StartSessionTests(ServiceTestBase):
    def test_requires_app_use_consent(self):
        user = make_user('+639171230000', consent=False)
        with self.assertRaises(services.FlowError) as ctx:
            services.start_session(user)
        self.assertEqual(ctx.exception.code, 'consent_required')

    def test_withdrawn_consent_blocks(self):
        Consent.objects.create(user=self.user, consent_type='APP_USE', granted=False, notice_version='v1',
                               language_code='en')
        with self.assertRaises(services.FlowError) as ctx:
            self.start()
        self.assertEqual(ctx.exception.code, 'consent_required')

    def test_requires_profile(self):
        user = make_user('+639171230001', profile=False)
        with self.assertRaises(services.FlowError) as ctx:
            services.start_session(user)
        self.assertEqual(ctx.exception.code, 'profile_required')

    def test_first_instrument_is_who5(self):
        self.assertEqual(self.start().next_instrument, 'WHO5')


class AdaptiveFlowTests(ServiceTestBase):
    def test_good_wellbeing_skips_phq9(self):
        s = self.start().session
        self.assertEqual(services.submit_instrument(s, 'WHO5', WHO5_GOOD).next_instrument, 'GAD7')
        step = services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        self.assertIsNone(step.next_instrument)
        self.assertTrue(step.completed)
        s.refresh_from_db()
        self.assertIsNotNone(s.completed_at)
        self.assertEqual(s.assessments.count(), 2)

    def test_poor_wellbeing_adds_phq9(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_POOR)
        step = services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        self.assertEqual(step.next_instrument, 'PHQ9')
        self.assertFalse(step.completed)
        step = services.submit_instrument(s, 'PHQ9', PHQ9_MINIMAL)
        self.assertTrue(step.completed)
        self.assertEqual(s.assessments.count(), 3)

    def test_out_of_order_rejected(self):
        s = self.start().session
        with self.assertRaises(services.FlowError) as ctx:
            services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        self.assertEqual(ctx.exception.code, 'wrong_instrument')

    def test_phq9_rejected_when_not_needed(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_GOOD)
        services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        with self.assertRaises(services.FlowError):
            services.submit_instrument(s, 'PHQ9', PHQ9_MINIMAL)

    def test_cannot_submit_after_completion(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_GOOD)
        services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        with self.assertRaises(services.FlowError) as ctx:
            services.submit_instrument(s, 'WHO5', WHO5_GOOD)
        self.assertEqual(ctx.exception.code, 'session_complete')

    def test_stores_item_responses_scores_and_version(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_POOR)
        a = Assessment.objects.get(session=s, instrument__code='WHO5')
        self.assertEqual((a.raw_score, str(a.scaled_score), a.severity_code), (10, '40.0', 'POOR'))
        self.assertEqual(a.scoring_version, 'who5-1.0')
        self.assertEqual(AssessmentResponse.objects.filter(assessment=a).count(), 5)

    def test_completing_marks_onboarding(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_GOOD)
        services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        self.user.profile.refresh_from_db()
        self.assertIsNotNone(self.user.profile.onboarding_completed_at)


class ValidationAtomicityTests(ServiceTestBase):
    def test_invalid_answers_persist_nothing(self):
        s = self.start().session
        bad = dict(WHO5_GOOD)
        bad[3] = 9
        with self.assertRaises(services.FlowError) as ctx:
            services.submit_instrument(s, 'WHO5', bad)
        self.assertEqual(ctx.exception.code, 'invalid_responses')
        self.assertEqual(Assessment.objects.count(), 0)
        self.assertEqual(AssessmentResponse.objects.count(), 0)

    def test_incomplete_answers_rejected(self):
        s = self.start().session
        with self.assertRaises(services.FlowError):
            services.submit_instrument(s, 'WHO5', {1: 3, 2: 3})
        self.assertEqual(Assessment.objects.count(), 0)


class CrisisRuleTests(ServiceTestBase):
    def finish_to_phq9(self, s):
        services.submit_instrument(s, 'WHO5', WHO5_POOR)
        services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)

    def test_item9_alone_raises_crisis_flag_and_escalation(self):
        s = self.start().session
        self.finish_to_phq9(s)
        step = services.submit_instrument(s, 'PHQ9', phq9_item9_only())
        self.assertEqual(step.score.severity_code, 'MINIMAL')
        self.assertTrue(step.crisis)
        flag = RiskFlag.objects.get()
        self.assertEqual((flag.source, flag.level, flag.status), ('PHQ9_ITEM9', 'CRISIS', 'OPEN'))
        self.assertEqual(str(flag.source_ref_id), str(step.assessment.id))
        self.assertEqual(Escalation.objects.get().flag, flag)
        s.refresh_from_db()
        self.assertTrue(s.crisis_shown)
        self.assertTrue(step.assessment.critical_item_positive)

    def test_very_low_who5_flags_high_before_other_instruments(self):
        s = self.start().session
        step = services.submit_instrument(s, 'WHO5', WHO5_VERY_LOW)
        self.assertTrue(step.crisis)
        flag = RiskFlag.objects.get()
        self.assertEqual((flag.source, flag.level), ('WHO5_LOW', 'HIGH'))
        self.assertEqual(step.next_instrument, 'GAD7')

    def test_severe_gad7_flags_high(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_GOOD)
        services.submit_instrument(s, 'GAD7', GAD7_SEVERE)
        flag = RiskFlag.objects.get()
        self.assertEqual((flag.source, flag.level), ('SEVERE_SCORE', 'HIGH'))

    def test_severe_phq9_with_item9_makes_two_flags_one_escalation_on_crisis(self):
        s = self.start().session
        self.finish_to_phq9(s)
        services.submit_instrument(s, 'PHQ9', PHQ9_SEVERE)
        self.assertEqual(set(RiskFlag.objects.values_list('source', flat=True)), {'PHQ9_ITEM9', 'SEVERE_SCORE'})
        self.assertEqual(Escalation.objects.count(), 1)
        self.assertEqual(Escalation.objects.get().flag.level, 'CRISIS')

    def test_no_flags_for_benign_answers(self):
        s = self.start().session
        services.submit_instrument(s, 'WHO5', WHO5_GOOD)
        step = services.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        self.assertFalse(step.crisis)
        self.assertEqual(RiskFlag.objects.count(), 0)
        s.refresh_from_db()
        self.assertFalse(s.crisis_shown)

    def test_escalation_contactable_mirrors_followup_preference(self):
        for mobile, followup in (('+639171230010', True), ('+639171230011', False)):
            user = make_user(mobile, followup=followup)
            s = services.start_session(user).session
            services.submit_instrument(s, 'WHO5', WHO5_VERY_LOW)
            self.assertEqual(Escalation.objects.get(flag__user=user).user_contactable, followup)

    def test_flag_failure_rolls_back_assessment(self):
        s = self.start().session
        self.finish_to_phq9(s)
        from unittest import mock
        with mock.patch('screening.services.Escalation.objects.create', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                services.submit_instrument(s, 'PHQ9', phq9_item9_only())
        self.assertFalse(Assessment.objects.filter(instrument__code='PHQ9').exists())
        self.assertEqual(RiskFlag.objects.count(), 0)


class PresentationTests(ServiceTestBase):
    def test_advice_uses_flag_wording_and_matches_band(self):
        s = self.start().session
        step = services.submit_instrument(s, 'WHO5', WHO5_POOR)
        advice = services.advice_for(self.user, 'WHO5', step.score.severity_code)
        self.assertIn('suggest', advice.message_body)

    def test_crisis_payload_has_hotlines_and_handoff(self):
        payload = services.crisis_payload(self.user)
        self.assertTrue(payload['hotlines'])
        self.assertTrue(payload['talk_to_a_person'])
        self.assertTrue(payload['message'])

    def test_crisis_payload_falls_back_when_no_advice_row(self):
        from screening.models import AdviceContent
        AdviceContent.objects.filter(severity_code='CRISIS').delete()
        payload = services.crisis_payload(self.user)
        self.assertTrue(payload['message'])
        self.assertTrue(payload['hotlines'])
