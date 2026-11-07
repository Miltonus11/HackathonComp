from django.core.management import call_command
from django.test import TestCase

from safety import crisis_terms
from wellbeing.models import JournalPrompt
from wellbeing.prompting import DOMAINS


class SeedJournalPromptsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_journal_prompts')

    def test_every_domain_has_at_least_three_published_english_prompts(self):
        for domain in DOMAINS:
            n = JournalPrompt.objects.filter(domain_code=domain, language_code='en',
                                             review_status='PUBLISHED', is_active=True).count()
            self.assertGreaterEqual(n, 3, domain)

    def test_seed_is_marked_as_not_clinically_reviewed(self):
        self.assertFalse(JournalPrompt.objects.exclude(reviewed_by='SEED - pending clinical review').exists())

    def test_prompts_never_touch_self_harm(self):
        banned = ('suicid', 'die', 'dead', 'death', 'hurt yourself', 'harm', 'kill', 'end your life')
        for p in JournalPrompt.objects.all():
            text = p.prompt_text.lower()
            self.assertFalse(any(b in text.replace('studied', '') for b in banned), p.prompt_text)
            self.assertFalse(crisis_terms.scan(p.prompt_text).flagged, p.prompt_text)

    def test_prompts_are_questions_or_invitations_of_sensible_length(self):
        for p in JournalPrompt.objects.all():
            self.assertTrue(10 <= len(p.prompt_text) <= 200, p.prompt_text)

    def test_is_idempotent_and_does_not_overwrite_edits(self):
        before = JournalPrompt.objects.count()
        p = JournalPrompt.objects.first()
        p.rotation_weight = 9
        p.save()
        call_command('seed_journal_prompts')
        self.assertEqual(JournalPrompt.objects.count(), before)
        p.refresh_from_db()
        self.assertEqual(p.rotation_weight, 9)

    def test_tones_are_valid_and_every_domain_has_a_gentle_option_and_a_non_gentle_one(self):
        for domain in DOMAINS:
            tones = set(JournalPrompt.objects.filter(domain_code=domain).values_list('tone', flat=True))
            self.assertTrue(tones <= {'GENTLE', 'NEUTRAL', 'UPBEAT'}, domain)
            self.assertIn('GENTLE', tones, domain)  # a low mood must always have something soft to show
            self.assertTrue(tones - {'GENTLE'}, domain)

    def test_reseeding_tags_untouched_seed_rows_but_not_reviewed_ones(self):
        gentle = JournalPrompt.objects.filter(tone='GENTLE').first()
        JournalPrompt.objects.filter(pk=gentle.pk).update(tone='NEUTRAL')  # as if created before tones existed
        call_command('seed_journal_prompts')
        gentle.refresh_from_db()
        self.assertEqual(gentle.tone, 'GENTLE')

        JournalPrompt.objects.filter(pk=gentle.pk).update(tone='NEUTRAL', reviewed_by='Dr. Reyes, clinical psychologist')
        call_command('seed_journal_prompts')
        gentle.refresh_from_db()
        self.assertEqual(gentle.tone, 'NEUTRAL')  # a clinician's decision is never overwritten
