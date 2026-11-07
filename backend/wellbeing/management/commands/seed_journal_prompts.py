from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from wellbeing.models import JournalPrompt

SEED_REVIEWER = 'SEED - pending clinical review'
G, N, U = 'GENTLE', 'NEUTRAL', 'UPBEAT'

# English only; validated Filipino prompts are [VERIFY]. None of these ask about self-harm, by design.
# Tone: GENTLE is low-demand and soothing (shown on low-mood days), UPBEAT celebrates (high-mood days).
# The tones are drafting judgments and need clinical review like everything else here.
PROMPTS = {
    'MOOD': [
        ('How would you describe your mood today, and what do you think shaped it?', N),
        ('What is one moment from today that stayed with you, good or hard?', N),
        ('If your mood today were the weather, what would it be and why?', G),
    ],
    'INTEREST': [
        ('What did you enjoy today, even a little?', G),
        ('Is there something you used to like doing that you would want to make room for again?', N),
        ('What did you look forward to today, and how did it go?', U),
    ],
    'SLEEP': [
        ('How has your rest been lately, and what has been on your mind at night?', N),
        ('What helps you wind down in the evening?', G),
        ('How did you feel when you woke up today?', N),
    ],
    'ENERGY': [
        ('What gave you energy today, and what drained it?', N),
        ('When during the day did you feel most awake and active?', U),
        ('What is one small thing that could help you feel more rested tomorrow?', G),
    ],
    'WORRY': [
        ('What has been on your mind the most today?', N),
        ('Is there a worry you can set down for tonight? What is one small step you could take about it tomorrow?', G),
        ('What helped you feel calm today, even for a few minutes?', G),
    ],
    'CONCENTRATION': [
        ('How easy or hard was it to focus today, and what got in the way?', N),
        ('What helps you settle your mind when your thoughts feel scattered?', G),
        ('What is one thing you finished or moved forward today?', U),
    ],
    'SELF_WORTH': [
        ('What is one thing you handled today that you are quietly proud of?', U),
        ('What would you say to a friend who felt the way you do about yourself right now?', G),
        ('Name something you did today that mattered, however small.', G),
    ],
}


class Command(BaseCommand):
    help = (
        'Seed the journal prompt bank (idempotent). Never overwrites edits made in the admin; the only change '
        'to an existing row is tagging the tone of an untouched seed row that is still NEUTRAL.'
    )

    @transaction.atomic
    def handle(self, *args, **opts):
        created = tagged = 0
        for domain, items in PROMPTS.items():
            for text, tone in items:
                prompt, was_created = JournalPrompt.objects.get_or_create(
                    domain_code=domain, language_code='en', prompt_text=text,
                    defaults=dict(tone=tone, rotation_weight=1, review_status=JournalPrompt.ReviewStatus.PUBLISHED,
                                  reviewed_by=SEED_REVIEWER, reviewed_at=timezone.now(), is_active=True))
                created += was_created
                if (not was_created and tone != N and prompt.tone == N and prompt.reviewed_by == SEED_REVIEWER):
                    prompt.tone = tone  # row predates tones and nobody has reviewed it
                    prompt.save(update_fields=['tone'])
                    tagged += 1
        self.stdout.write(self.style.SUCCESS(
            f'Journal prompts: {created} created, {tagged} tagged with a tone. Needs clinical review.'))
