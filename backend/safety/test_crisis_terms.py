from django.test import SimpleTestCase

from safety import crisis_terms


class CrisisScanTests(SimpleTestCase):
    def flagged(self, text):
        return crisis_terms.scan(text).flagged

    def test_english_phrases(self):
        for text in ['I want to kill myself', 'I think about ending my life', 'I just want to die',
                     "I don't want to live anymore", 'everyone is better off dead', 'I keep hurting myself',
                     'thinking about suicide', "I'm suicidal", 'I wish I was dead', 'no reason to live']:
            self.assertTrue(self.flagged(text), text)

    def test_filipino_and_taglish_phrases(self):
        for text in ['Gusto ko nang mamatay', 'ayoko nang mabuhay', 'Ayaw ko na mabuhay', 'magpapakamatay ako',
                     'wala nang saysay ang buhay', 'sasaktan ko ang sarili ko', 'gusto ko ng mag suicide',
                     'Tapusin ko na ang buhay ko', 'mamatay na lang ako']:
            self.assertTrue(self.flagged(text), text)

    def test_ilocano_phrases(self):
        for text in ['kayat ko ti matay', 'Diak kayat ti agbiag']:
            self.assertTrue(self.flagged(text), text)

    def test_case_punctuation_accents_and_curly_apostrophes_do_not_hide_a_match(self):
        for text in ['I WANT TO KILL MYSELF!!!', 'i want   to\nkill\tmyself', 'I don’t want to live', 'Gusto kó nang mamatáy']:
            self.assertTrue(self.flagged(text), text)

    def test_ordinary_text_is_not_flagged(self):
        for text in ['I killed it at the gym today', 'Work is killing time before the holidays',
                     'I am dying to see that movie', 'We had a deadline and I was exhausted',
                     'Masaya ako ngayon, kumain kami ng adobo', 'I had a skill myself assessment at work',
                     'My phone died and I was upset', 'Nag-aral ako ng mabuti', '']:
            self.assertFalse(self.flagged(text), text)

    def test_errs_toward_false_alarms_negated_statements_are_still_flagged(self):
        # A missed crisis costs far more than an unnecessary prompt, so no negation handling.
        self.assertTrue(self.flagged("I don't want to die, but I'm scared I might hurt myself"))

    def test_returns_what_matched_but_not_the_users_text(self):
        result = crisis_terms.scan('Today was hard and I want to kill myself')
        self.assertTrue(result.matched)
        self.assertTrue(all(isinstance(m, str) for m in result.matched))
        self.assertNotIn('today was hard', ' '.join(result.matched))

    def test_empty_and_none_are_safe(self):
        self.assertFalse(crisis_terms.scan('').flagged)
        self.assertFalse(crisis_terms.scan(None).flagged)

    def test_every_term_in_every_list_matches_itself(self):
        for term in crisis_terms.ALL_TERMS:
            sample = term.rstrip('*') + ('x' if term.endswith('*') else '')
            self.assertTrue(self.flagged(f'so {sample} again'), term)
