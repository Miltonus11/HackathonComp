from django.test import SimpleTestCase

from wellbeing import ai_safety as safe

GOOD = {'message': 'That sounds like a tiring week. Writing it down is a kind thing to do for yourself.',
        'nudge': 'A short walk or a glass of water might help tonight.'}


class RedactTests(SimpleTestCase):
    def test_phone_numbers_in_common_formats(self):
        for raw in ['+63 917 123 4567', '0917-123-4567', '09171234567', '(072) 888 1234', '+639171234567']:
            out = safe.redact(f'call me on {raw} later')
            self.assertNotRegex(out, r'\d{3}')
            self.assertIn('[number]', out)

    def test_emails_and_links(self):
        out = safe.redact('write to juan.dela-cruz@example.com or see https://example.com/a?b=1 and www.site.ph')
        self.assertNotIn('@', out)
        self.assertNotIn('example', out)
        self.assertNotIn('www', out)
        self.assertIn('[email]', out)
        self.assertIn('[link]', out)

    def test_ordinary_text_and_small_numbers_are_untouched(self):
        text = 'I slept 4 hours, ate 3 meals, and rated my day 7 out of 10.'
        self.assertEqual(safe.redact(text), text)

    def test_filipino_text_is_untouched(self):
        text = 'Pagod ako ngayon pero masaya kami ng pamilya ko.'
        self.assertEqual(safe.redact(text), text)

    def test_empty_and_none(self):
        self.assertEqual(safe.redact(''), '')
        self.assertEqual(safe.redact(None), '')


class ReflectionCheckTests(SimpleTestCase):
    def test_accepts_a_good_reply_and_returns_it_cleaned(self):
        out = safe.check_reflection({'message': '  Kind words.  ', 'nudge': '  Rest well.  '})
        self.assertEqual(out, {'message': 'Kind words.', 'nudge': 'Rest well.'})

    def test_nudge_is_optional(self):
        for nudge in (None, '', '   '):
            self.assertEqual(safe.check_reflection({'message': 'Kind words.', 'nudge': nudge})['nudge'], None)
        self.assertIsNone(safe.check_reflection({'message': 'Kind words.'})['nudge'])

    def test_rejects_bad_shapes(self):
        for bad in (None, 'text', [], {}, {'message': ''}, {'message': '   '}, {'message': 5}, {'message': ['a']},
                    {'message': 'ok', 'nudge': 5}, {'message': 'ok', 'nudge': ['a']}):
            self.assertIsNone(safe.check_reflection(bad), repr(bad))

    def test_length_limits(self):
        self.assertIsNotNone(safe.check_reflection({'message': 'a' * 600}))
        self.assertIsNone(safe.check_reflection({'message': 'a' * 601}))
        self.assertIsNotNone(safe.check_reflection({'message': 'ok', 'nudge': 'a' * 200}))
        self.assertIsNone(safe.check_reflection({'message': 'ok', 'nudge': 'a' * 201}))

    def test_rejects_diagnosis_severity_medication_therapist_and_contact_details(self):
        bad = [
            'This sounds like depression.', 'You may be depressed.', 'It could be an anxiety disorder.',
            'That sounds like PTSD.', 'You might be bipolar.', 'I would not diagnose this, but it is clinical.',
            'You should ask about medication.', 'An antidepressant could help.', 'Ask a doctor to prescribe something.',
            'Your PHQ-9 score is high.', 'Your wellbeing score dropped.', 'That sounds severe.', 'This is a matter of severity.',
            "I'm a therapist and I can help.", 'I am a counselor here for you.', 'As your therapist, I think so.',
            'I’m a psychologist.', 'Visit https://example.com for more.', 'See www.help.ph today.',
            'Call 0917 123 4567 now.', 'Email me at a@b.com.',
        ]
        for text in bad:
            self.assertIsNone(safe.check_reflection({'message': text}), text)
            self.assertIsNone(safe.check_reflection({'message': 'Fine.', 'nudge': text}), text)

    def test_rejects_a_reply_that_itself_contains_crisis_language(self):
        self.assertIsNone(safe.check_reflection({'message': 'It is understandable to want to die sometimes.'}))
        self.assertIsNone(safe.check_reflection({'message': 'Please do not hurt yourself.'}))

    def test_accepts_warm_ordinary_replies_that_only_look_similar(self):
        for text in ['You mentioned feeling down and tired, and that is okay.', 'That is a lot to carry.',
                     'You handled a lot today.', 'I am here to listen.', 'I am glad you wrote this down.',
                     'Sounds like a heavy day. Be gentle with yourself.', 'Salamat sa pagsulat nito. Pahinga ka muna.']:
            self.assertIsNotNone(safe.check_reflection({'message': text}), text)


class LeadInCheckTests(SimpleTestCase):
    def test_accepts_a_short_warm_lead_in(self):
        self.assertEqual(safe.check_lead_in({'lead_in': '  It sounds like today was a heavy one.  '}),
                         'It sounds like today was a heavy one.')

    def test_rejects_bad_shapes_and_empties(self):
        for bad in (None, 'x', [], {}, {'lead_in': ''}, {'lead_in': '  '}, {'lead_in': 5}):
            self.assertIsNone(safe.check_lead_in(bad), repr(bad))

    def test_rejects_questions_because_the_reviewed_question_must_be_the_only_one(self):
        self.assertIsNone(safe.check_lead_in({'lead_in': 'How are you feeling?'}))

    def test_rejects_long_or_multiline(self):
        self.assertIsNotNone(safe.check_lead_in({'lead_in': 'a' * 140}))
        self.assertIsNone(safe.check_lead_in({'lead_in': 'a' * 141}))
        self.assertIsNone(safe.check_lead_in({'lead_in': 'line one\nline two'}))

    def test_rejects_banned_content_and_crisis_terms(self):
        for text in ('You seem depressed today.', 'Your score is low.', 'Take your medication.', 'I want to die too.',
                     'See https://x.com'):
            self.assertIsNone(safe.check_lead_in({'lead_in': text}), text)


class RiskAnswerTests(SimpleTestCase):
    def test_only_a_real_boolean_is_accepted(self):
        self.assertIs(safe.check_risk({'risk': True}), True)
        self.assertIs(safe.check_risk({'risk': False}), False)
        for bad in (None, {}, [], 'true', {'risk': 'true'}, {'risk': 'no'}, {'risk': 1}, {'risk': 0}, {'risk': None}):
            self.assertIsNone(safe.check_risk(bad), repr(bad))
