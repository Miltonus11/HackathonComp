import json
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import LanguageCode

from . import crypto


class MoodEntry(models.Model):
    """Daily mood tracker (1-10, 10 is best). Not a validated instrument; never used to assign severity."""

    class Reason(models.TextChoices):
        SLEEP = 'SLEEP'
        WORK = 'WORK'
        SCHOOL = 'SCHOOL'
        FAMILY = 'FAMILY'
        HEALTH = 'HEALTH'
        RELATIONSHIP = 'RELATIONSHIP'
        FINANCES = 'FINANCES'
        OTHER = 'OTHER'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.CASCADE,
                             related_name='mood_entries')
    entry_date = models.DateField()  # Philippine calendar day, set by the server
    mood_score = models.SmallIntegerField()
    reason_code = models.CharField(max_length=15, choices=Reason.choices, null=True, blank=True)
    logged_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-entry_date']
        constraints = [
            models.UniqueConstraint(fields=['user', 'entry_date'], name='uniq_mood_per_user_per_day'),
            models.CheckConstraint(condition=Q(mood_score__gte=1) & Q(mood_score__lte=10),
                                   name='mood_score_1_to_10'),
        ]

    def __str__(self):
        return f'{self.entry_date}: {self.mood_score}'


class JournalPrompt(models.Model):
    """Clinician-reviewed prompt bank (content table). Only PUBLISHED, active rows are ever served."""

    class Domain(models.TextChoices):
        MOOD = 'MOOD'
        INTEREST = 'INTEREST'
        SLEEP = 'SLEEP'
        ENERGY = 'ENERGY'
        WORRY = 'WORRY'
        CONCENTRATION = 'CONCENTRATION'
        SELF_WORTH = 'SELF_WORTH'

    class ReviewStatus(models.TextChoices):
        DRAFT = 'DRAFT'
        CLINICALLY_REVIEWED = 'CLINICALLY_REVIEWED'
        PUBLISHED = 'PUBLISHED'
        RETIRED = 'RETIRED'

    class Tone(models.TextChoices):
        GENTLE = 'GENTLE'
        NEUTRAL = 'NEUTRAL'
        UPBEAT = 'UPBEAT'

    domain_code = models.CharField(max_length=15, choices=Domain.choices)
    language_code = models.CharField(max_length=5, choices=LanguageCode.choices)
    prompt_text = models.TextField()
    # Softer prompts are shown on low-mood days, upbeat ones on high-mood days. Needs clinical review.
    tone = models.CharField(max_length=10, choices=Tone.choices, default='NEUTRAL')
    rotation_weight = models.SmallIntegerField(default=1)
    review_status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.DRAFT)
    reviewed_by = models.CharField(max_length=150, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['domain_code', 'id']

    def __str__(self):
        return f'{self.domain_code}/{self.language_code}: {self.prompt_text[:40]}'


class JournalEntry(models.Model):
    """P4 data. `body` and `ai_reflection` hold per-user ciphertext; use set_text()/get_text()."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.CASCADE,
                             related_name='journal_entries')
    prompt = models.ForeignKey(JournalPrompt, null=True, blank=True, on_delete=models.SET_NULL,
                               related_name='entries')
    body = models.TextField()
    ai_reflection = models.TextField(null=True, blank=True)
    ai_analyzed = models.BooleanField(default=False)  # true only if AI_ANALYSIS consent was active at write time
    risk_scanned_at = models.DateTimeField(null=True, blank=True)  # the crisis scan runs on EVERY entry
    written_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-written_at']
        indexes = [models.Index(fields=['user', '-written_at'])]

    def set_text(self, text):
        self.body = crypto.encrypt(self.user_id, text)

    def get_text(self):
        return self._read(self.body)

    def set_reflection(self, reflection):
        """`reflection` is {'message': str, 'nudge': str|None}; stored as encrypted JSON."""
        self.ai_reflection = crypto.encrypt(self.user_id, json.dumps(reflection, ensure_ascii=False))

    def get_reflection(self):
        raw = self._read(self.ai_reflection) if self.ai_reflection else None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None

    def _read(self, token):
        try:
            return crypto.decrypt(self.user_id, token)
        except crypto.DecryptionError:
            return None  # e.g. the master key changed; never crash a whole list over one entry
