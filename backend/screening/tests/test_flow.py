from decimal import Decimal

from django.test import SimpleTestCase

from screening import flow


class FullFlowTests(SimpleTestCase):
    def test_starts_with_who5_then_gad7(self):
        self.assertEqual(flow.next_instrument({}), 'WHO5')
        self.assertEqual(flow.next_instrument({'WHO5': Decimal('80')}), 'GAD7')

    def test_phq9_follows_when_who5_below_52(self):
        done = {'WHO5': Decimal('48'), 'GAD7': None}
        self.assertEqual(flow.next_instrument(done), 'PHQ9')

    def test_item9_only_check_replaces_phq9_when_who5_52_or_more(self):
        done = {'WHO5': Decimal('52'), 'GAD7': None}
        self.assertEqual(flow.next_instrument(done), 'PHQ9_ITEM9')

    def test_complete_after_item9_check(self):
        done = {'WHO5': Decimal('52'), 'GAD7': None, 'PHQ9_ITEM9': None}
        self.assertIsNone(flow.next_instrument(done))

    def test_item9_not_asked_twice_when_full_phq9_taken(self):
        done = {'WHO5': Decimal('48'), 'GAD7': None, 'PHQ9': None}
        self.assertIsNone(flow.next_instrument(done))

    def test_complete_after_phq9(self):
        done = {'WHO5': Decimal('0'), 'GAD7': None, 'PHQ9': None}
        self.assertIsNone(flow.next_instrument(done))

    def test_phq9_needed_boundary(self):
        self.assertTrue(flow.phq9_needed(Decimal('48')))
        self.assertFalse(flow.phq9_needed(Decimal('52')))
