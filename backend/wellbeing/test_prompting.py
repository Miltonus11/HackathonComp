from django.test import SimpleTestCase

from wellbeing import prompting
from wellbeing.prompting import DOMAINS


class TopPhq9DomainTests(SimpleTestCase):
    def test_none_when_all_zero_or_missing(self):
        self.assertIsNone(prompting.top_phq9_domain({}))
        self.assertIsNone(prompting.top_phq9_domain({i: 0 for i in range(1, 10)}))

    def test_highest_mapped_item_wins(self):
        self.assertEqual(prompting.top_phq9_domain({1: 1, 3: 3, 4: 2}), 'SLEEP')

    def test_ties_go_to_the_lower_item_number(self):
        self.assertEqual(prompting.top_phq9_domain({2: 2, 7: 2}), 'MOOD')

    def test_unmapped_items_are_ignored(self):
        self.assertIsNone(prompting.top_phq9_domain({5: 3, 8: 3}))  # appetite, psychomotor: no domain

    def test_item_9_is_never_used(self):
        self.assertIsNone(prompting.top_phq9_domain({9: 3}))
        self.assertEqual(prompting.top_phq9_domain({9: 3, 6: 1}), 'SELF_WORTH')
        self.assertNotIn(9, prompting.PHQ9_ITEM_DOMAIN)


class RankDomainsTests(SimpleTestCase):
    def rank(self, recent=(), reason=None, phq9=None):
        return prompting.rank_domains(list(recent), reason, phq9)

    def test_returns_every_domain_exactly_once(self):
        self.assertEqual(sorted(self.rank(recent=['MOOD', 'SLEEP'], reason='WORK', phq9='ENERGY')), sorted(DOMAINS))

    def test_default_order_with_no_signals_is_fixed(self):
        self.assertEqual(self.rank(), DOMAINS)

    def test_recent_domains_go_last_so_prompts_do_not_repeat(self):
        ranked = self.rank(recent=['MOOD', 'INTEREST', 'SLEEP'])
        self.assertEqual(ranked[:4], ['ENERGY', 'WORRY', 'CONCENTRATION', 'SELF_WORTH'])
        self.assertEqual(set(ranked[4:]), {'MOOD', 'INTEREST', 'SLEEP'})

    def test_mood_reason_beats_phq9_beats_rotation(self):
        self.assertEqual(self.rank(reason='SLEEP')[0], 'SLEEP')
        self.assertEqual(self.rank(phq9='ENERGY')[0], 'ENERGY')
        self.assertEqual(self.rank(reason='SLEEP', phq9='ENERGY')[0], 'SLEEP')

    def test_a_signal_for_a_recent_domain_is_skipped_in_favour_of_a_fresh_one(self):
        self.assertNotEqual(self.rank(recent=['SLEEP'], reason='SLEEP')[0], 'SLEEP')

    def test_least_recently_used_goes_first_among_equals(self):
        recent = ['MOOD', 'INTEREST', 'SLEEP', 'ENERGY', 'WORRY', 'CONCENTRATION', 'SELF_WORTH']
        self.assertEqual(self.rank(recent=recent)[0], 'SELF_WORTH')  # used longest ago

    def test_mood_reasons_map_to_domains_and_unknown_reasons_are_ignored(self):
        self.assertEqual(self.rank(reason='WORK')[0], 'WORRY')
        self.assertEqual(self.rank(reason='SCHOOL')[0], 'CONCENTRATION')
        self.assertEqual(self.rank(reason='HEALTH')[0], 'ENERGY')
        self.assertEqual(self.rank(reason='OTHER'), DOMAINS)
        self.assertEqual(self.rank(reason='NOPE'), DOMAINS)

    def test_deterministic(self):
        args = (['MOOD'], 'FAMILY', 'SLEEP')
        self.assertEqual(prompting.rank_domains(*args), prompting.rank_domains(*args))


class ChoosePromptTests(SimpleTestCase):
    def test_highest_weight_unused_prompt(self):
        prompts = [(1, 1, 'NEUTRAL'), (2, 5, 'NEUTRAL'), (3, 3, 'NEUTRAL')]
        self.assertEqual(prompting.choose_prompt(prompts, recent_ids=[]), 2)

    def test_skips_recently_used_prompts(self):
        prompts = [(1, 1, 'NEUTRAL'), (2, 5, 'NEUTRAL'), (3, 3, 'NEUTRAL')]
        self.assertEqual(prompting.choose_prompt(prompts, recent_ids=[2]), 3)

    def test_ties_break_to_lowest_id(self):
        self.assertEqual(prompting.choose_prompt([(9, 1, 'NEUTRAL'), (4, 1, 'NEUTRAL')], recent_ids=[]), 4)

    def test_when_all_used_picks_the_one_used_longest_ago(self):
        # recent_ids is newest first
        self.assertEqual(prompting.choose_prompt([(1, 1, 'NEUTRAL'), (2, 1, 'NEUTRAL'), (3, 1, 'NEUTRAL')], recent_ids=[3, 1, 2]), 2)

    def test_empty_returns_none(self):
        self.assertIsNone(prompting.choose_prompt([], recent_ids=[]))

    def test_prefers_the_requested_tone_then_highest_weight(self):
        prompts = [(1, 1, 'NEUTRAL'), (2, 1, 'GENTLE'), (3, 5, 'GENTLE')]
        self.assertEqual(prompting.choose_prompt(prompts, recent_ids=[], preferred_tone='GENTLE'), 3)

    def test_tone_preference_still_avoids_recent_prompts(self):
        prompts = [(1, 1, 'NEUTRAL'), (2, 1, 'GENTLE'), (3, 5, 'GENTLE')]
        self.assertEqual(prompting.choose_prompt(prompts, recent_ids=[3], preferred_tone='GENTLE'), 2)

    def test_falls_back_to_any_prompt_when_none_has_the_tone(self):
        self.assertEqual(prompting.choose_prompt([(1, 1, 'NEUTRAL')], recent_ids=[], preferred_tone='GENTLE'), 1)

    def test_no_preferred_tone_ignores_tone(self):
        prompts = [(1, 1, 'GENTLE'), (2, 5, 'NEUTRAL')]
        self.assertEqual(prompting.choose_prompt(prompts, recent_ids=[]), 2)

    def test_all_matching_used_repeats_the_oldest_matching_not_another_tone(self):
        prompts = [(1, 1, 'GENTLE'), (2, 1, 'GENTLE'), (3, 9, 'NEUTRAL')]
        self.assertEqual(prompting.choose_prompt(prompts, recent_ids=[2, 1], preferred_tone='GENTLE'), 1)


class MoodBandTests(SimpleTestCase):
    def test_absolute_bands_without_a_baseline(self):
        expected = {1: 'LOW', 3: 'LOW', 4: 'LOW', 5: 'MID', 7: 'MID', 8: 'HIGH', 10: 'HIGH'}
        for score, band in expected.items():
            self.assertEqual(prompting.mood_band(score), band, score)

    def test_lower_than_usual_counts_as_low(self):
        self.assertEqual(prompting.mood_band(6, baseline=8.5), 'LOW')
        self.assertEqual(prompting.mood_band(7, baseline=8.5), 'MID')

    def test_low_wins_over_high(self):
        self.assertEqual(prompting.mood_band(8, baseline=10.0), 'LOW')
        self.assertEqual(prompting.mood_band(3, baseline=2.0), 'LOW')

    def test_high_needs_the_absolute_threshold(self):
        self.assertEqual(prompting.mood_band(9, baseline=4.0), 'HIGH')
        self.assertEqual(prompting.mood_band(7, baseline=3.0), 'MID')

    def test_no_score_means_no_band(self):
        self.assertIsNone(prompting.mood_band(None))

    def test_preferred_tone_by_band(self):
        self.assertEqual(prompting.preferred_tone('LOW'), 'GENTLE')
        self.assertEqual(prompting.preferred_tone('HIGH'), 'UPBEAT')
        self.assertIsNone(prompting.preferred_tone('MID'))
        self.assertIsNone(prompting.preferred_tone(None))
