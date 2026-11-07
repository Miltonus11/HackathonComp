from decimal import Decimal

from django.test import SimpleTestCase

from screening import flow


class FullFlowTests(SimpleTestCase):
    def test_starts_with_who5_then_gad7(self):
        self.assertEqual(flow.next_instrument({}), 'WHO5')
        self.assertEqual(flow.next_instrument({'WHO5': Decimal('80')}), 'GAD7')

    def test_not_good_wellbeing_waits_for_the_choice_instead_of_forcing_phq9(self):
        done = {'WHO5': Decimal('48'), 'GAD7': None}
        self.assertIsNone(flow.next_instrument(done))
        self.assertTrue(flow.pending_choice(done, None))
        self.assertFalse(flow.is_complete(done, None))

    def test_accepting_makes_phq9_next(self):
        done = {'WHO5': Decimal('48'), 'GAD7': None}
        self.assertEqual(flow.next_instrument(done, True), 'PHQ9')
        self.assertFalse(flow.pending_choice(done, True))

    def test_declining_completes_without_phq9_or_item9(self):
        done = {'WHO5': Decimal('48'), 'GAD7': None}
        self.assertIsNone(flow.next_instrument(done, False))
        self.assertFalse(flow.pending_choice(done, False))
        self.assertTrue(flow.is_complete(done, False))

    def test_item9_only_check_replaces_phq9_when_who5_52_or_more(self):
        done = {'WHO5': Decimal('52'), 'GAD7': None}
        self.assertEqual(flow.next_instrument(done), 'PHQ9_ITEM9')
        self.assertFalse(flow.pending_choice(done, None))  # good wellbeing is never offered the choice

    def test_complete_after_item9_check(self):
        done = {'WHO5': Decimal('52'), 'GAD7': None, 'PHQ9_ITEM9': None}
        self.assertIsNone(flow.next_instrument(done))
        self.assertTrue(flow.is_complete(done))

    def test_complete_after_phq9_when_accepted(self):
        done = {'WHO5': Decimal('0'), 'GAD7': None, 'PHQ9': None}
        self.assertIsNone(flow.next_instrument(done, True))
        self.assertTrue(flow.is_complete(done, True))

    def test_phq9_needed_boundary(self):
        self.assertTrue(flow.phq9_needed(Decimal('48')))
        self.assertFalse(flow.phq9_needed(Decimal('52')))

    def test_no_choice_before_gad7_is_done(self):
        self.assertFalse(flow.pending_choice({'WHO5': Decimal('40')}, None))
