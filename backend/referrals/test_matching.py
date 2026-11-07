from django.test import SimpleTestCase

from referrals import matching
from referrals.matching import Candidate


def cand(id, name='S', **kw):
    base = dict(barangay_id=None, languages=frozenset(), sectors=frozenset(), cost_type='PAID',
                accepts_walk_in=False, min_severity='LOW', is_crisis_service=False)
    base.update(kw)
    return Candidate(id=id, name=name, **base)


def ids(ranked):
    return [r.candidate.id for r in ranked]


class TierTests(SimpleTestCase):
    def test_low_codes(self):
        self.assertEqual(matching.tier_for(['GOOD', 'MINIMAL', 'NEGATIVE']), 'LOW')

    def test_mild_codes(self):
        self.assertEqual(matching.tier_for(['POOR', 'MINIMAL']), 'MILD')
        self.assertEqual(matching.tier_for(['MILD']), 'MILD')

    def test_moderate(self):
        self.assertEqual(matching.tier_for(['GOOD', 'MODERATE']), 'MODERATE')

    def test_high_codes(self):
        for code in ('MODERATELY_SEVERE', 'SEVERE', 'LIKELY_DEPRESSION', 'POSITIVE'):
            self.assertEqual(matching.tier_for([code, 'MINIMAL']), 'HIGH', code)

    def test_highest_wins_and_empty_is_low(self):
        self.assertEqual(matching.tier_for(['MILD', 'MODERATE', 'POOR']), 'MODERATE')
        self.assertEqual(matching.tier_for([]), 'LOW')

    def test_unknown_code_is_an_error_not_silently_low(self):
        with self.assertRaises(KeyError):
            matching.tier_for(['NOT_A_CODE'])


class EligibilityTests(SimpleTestCase):
    def test_service_needing_higher_tier_is_excluded(self):
        c = [cand(1, min_severity='MODERATE'), cand(2, min_severity='MILD'), cand(3, min_severity='LOW')]
        self.assertEqual(sorted(ids(matching.rank(c, 'MILD', None, 'en', 'STUDENT'))), [2, 3])
        self.assertEqual(sorted(ids(matching.rank(c, 'MODERATE', None, 'en', 'STUDENT'))), [1, 2, 3])

    def test_crisis_services_only_at_high_tier_and_listed_first(self):
        c = [cand(1, 'A', cost_type='FREE', accepts_walk_in=True), cand(2, 'Hotline', is_crisis_service=True)]
        self.assertEqual(ids(matching.rank(c, 'MODERATE', None, 'en', 'STUDENT')), [1])
        self.assertEqual(ids(matching.rank(c, 'HIGH', None, 'en', 'STUDENT')), [2, 1])


class ScoringTests(SimpleTestCase):
    def test_same_barangay_beats_citywide_beats_other_barangay(self):
        c = [cand(1, 'Other', barangay_id=9), cand(2, 'City', barangay_id=None), cand(3, 'Here', barangay_id=5)]
        self.assertEqual(ids(matching.rank(c, 'MILD', 5, 'en', 'STUDENT')), [3, 2, 1])

    def test_language_match_ranks_higher(self):
        c = [cand(1, 'A'), cand(2, 'B', languages=frozenset({'fil'}))]
        self.assertEqual(ids(matching.rank(c, 'MILD', None, 'fil', 'STUDENT')), [2, 1])

    def test_sector_match_ranks_higher(self):
        c = [cand(1, 'A'), cand(2, 'B', sectors=frozenset({'STUDENT'}))]
        self.assertEqual(ids(matching.rank(c, 'MILD', None, 'en', 'STUDENT')), [2, 1])

    def test_cheaper_ranks_higher(self):
        c = [cand(1, 'A', cost_type='PAID'), cand(2, 'B', cost_type='SUBSIDIZED'), cand(3, 'C', cost_type='FREE')]
        self.assertEqual(ids(matching.rank(c, 'MILD', None, 'en', 'STUDENT')), [3, 2, 1])

    def test_walk_in_ranks_higher(self):
        c = [cand(1, 'A'), cand(2, 'B', accepts_walk_in=True)]
        self.assertEqual(ids(matching.rank(c, 'MILD', None, 'en', 'STUDENT')), [2, 1])

    def test_ties_break_by_name_for_stable_output(self):
        c = [cand(1, 'Zed'), cand(2, 'Abe'), cand(3, 'Mid')]
        self.assertEqual(ids(matching.rank(c, 'MILD', None, 'en', 'STUDENT')), [2, 3, 1])

    def test_reasons_explain_the_ranking(self):
        c = [cand(1, 'A', barangay_id=5, languages=frozenset({'en'}), cost_type='FREE', accepts_walk_in=True)]
        reasons = matching.rank(c, 'MILD', 5, 'en', 'STUDENT')[0].reasons
        self.assertEqual(len(reasons), 4)
        self.assertTrue(all(isinstance(r, str) and r for r in reasons))

    def test_no_reasons_when_nothing_matches(self):
        self.assertEqual(matching.rank([cand(1, barangay_id=9)], 'MILD', 5, 'fil', 'STUDENT')[0].reasons, [])

    def test_limit_is_applied(self):
        c = [cand(i, f'S{i:02d}') for i in range(25)]
        self.assertEqual(len(matching.rank(c, 'MILD', None, 'en', 'STUDENT', limit=10)), 10)
        self.assertEqual(len(matching.rank(c, 'MILD', None, 'en', 'STUDENT')), matching.DEFAULT_LIMIT)
        self.assertEqual(matching.DEFAULT_LIMIT, 10)
