from decimal import Decimal
from types import SimpleNamespace

from django.test import SimpleTestCase

from screening import scoring


def band(lo, hi, code, crisis=False):
    return SimpleNamespace(
        min_value=Decimal(str(lo)), max_value=Decimal(str(hi)), severity_code=code, triggers_crisis_flow=crisis
    )


PHQ9_BANDS = [
    band(0, 4, 'MINIMAL'), band(5, 9, 'MILD'), band(10, 14, 'MODERATE'),
    band(15, 19, 'MODERATELY_SEVERE'), band(20, 27, 'SEVERE', True),
]
GAD7_BANDS = [band(0, 4, 'MINIMAL'), band(5, 9, 'MILD'), band(10, 14, 'MODERATE'), band(15, 21, 'SEVERE', True)]
WHO5_BANDS = [band(0, 28, 'LIKELY_DEPRESSION', True), band('28.1', '51.9', 'POOR'), band(52, 100, 'GOOD')]


def answers(n, value):
    return {i: value for i in range(1, n + 1)}


class ValidateResponsesTests(SimpleTestCase):
    def test_accepts_complete_in_range(self):
        scoring.validate_responses(answers(9, 3), item_count=9, min_response=0, max_response=3)

    def test_rejects_missing_item(self):
        partial = answers(9, 1)
        del partial[4]
        with self.assertRaisesMessage(ValueError, 'missing'):
            scoring.validate_responses(partial, 9, 0, 3)

    def test_rejects_unknown_item(self):
        with self.assertRaisesMessage(ValueError, 'unknown'):
            scoring.validate_responses({**answers(7, 1), 8: 1}, 7, 0, 3)

    def test_rejects_out_of_range(self):
        for bad in (-1, 4):
            with self.assertRaisesMessage(ValueError, 'range'):
                scoring.validate_responses({**answers(7, 1), 3: bad}, 7, 0, 3)


class BandBoundaryTests(SimpleTestCase):
    def sev(self, bands, value):
        return scoring.band_for(bands, Decimal(value)).severity_code

    def test_phq9_boundaries(self):
        expected = {0: 'MINIMAL', 4: 'MINIMAL', 5: 'MILD', 9: 'MILD', 10: 'MODERATE',
                    14: 'MODERATE', 15: 'MODERATELY_SEVERE', 19: 'MODERATELY_SEVERE', 20: 'SEVERE', 27: 'SEVERE'}
        for score, code in expected.items():
            self.assertEqual(self.sev(PHQ9_BANDS, score), code, score)

    def test_gad7_boundaries(self):
        expected = {4: 'MINIMAL', 5: 'MILD', 10: 'MODERATE', 14: 'MODERATE', 15: 'SEVERE', 21: 'SEVERE'}
        for score, code in expected.items():
            self.assertEqual(self.sev(GAD7_BANDS, score), code, score)

    def test_who5_boundaries_on_scaled_score(self):
        expected = {0: 'LIKELY_DEPRESSION', 28: 'LIKELY_DEPRESSION', 32: 'POOR', 48: 'POOR', 52: 'GOOD', 100: 'GOOD'}
        for scaled, code in expected.items():
            self.assertEqual(self.sev(WHO5_BANDS, scaled), code, scaled)

    def test_no_matching_band_raises(self):
        with self.assertRaises(LookupError):
            scoring.band_for(PHQ9_BANDS, Decimal('28'))


class ScoreInstrumentTests(SimpleTestCase):
    def test_phq9_sums_raw_and_has_no_scaled_score(self):
        r = scoring.score_instrument('PHQ9', answers(9, 1), PHQ9_BANDS, critical_items={9})
        self.assertEqual((r.raw_score, r.scaled_score, r.severity_code), (9, None, 'MILD'))

    def test_who5_scales_raw_times_four(self):
        r = scoring.score_instrument('WHO5', answers(5, 5), WHO5_BANDS)
        self.assertEqual((r.raw_score, r.scaled_score, r.severity_code), (25, Decimal('100.0'), 'GOOD'))

    def test_who5_raw_12_is_poor_and_13_is_good(self):
        low = {1: 3, 2: 3, 3: 2, 4: 2, 5: 2}   # raw 12 -> 48
        high = {1: 3, 2: 3, 3: 3, 4: 2, 5: 2}  # raw 13 -> 52
        self.assertEqual(scoring.score_instrument('WHO5', low, WHO5_BANDS).severity_code, 'POOR')
        self.assertEqual(scoring.score_instrument('WHO5', high, WHO5_BANDS).severity_code, 'GOOD')

    def test_item9_alone_flags_critical_despite_minimal_total(self):
        resp = answers(9, 0)
        resp[9] = 1
        r = scoring.score_instrument('PHQ9', resp, PHQ9_BANDS, critical_items={9})
        self.assertEqual(r.severity_code, 'MINIMAL')
        self.assertTrue(r.critical_item_positive)

    def test_item9_zero_is_not_critical(self):
        r = scoring.score_instrument('PHQ9', answers(9, 0), PHQ9_BANDS, critical_items={9})
        self.assertFalse(r.critical_item_positive)

    def test_band_crisis_flag_is_exposed(self):
        r = scoring.score_instrument('GAD7', answers(7, 3), GAD7_BANDS)
        self.assertTrue(r.band_triggers_crisis)
