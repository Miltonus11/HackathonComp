import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from core.models import LanguageCode


def _uuid_pk():
    return models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)


def _user_fk(**kw):
    return models.ForeignKey(settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.CASCADE, **kw)


# ---------------------------------------------------------------- Content store

class Instrument(models.Model):
    class ScoreDirection(models.TextChoices):
        HIGHER_WORSE = 'HIGHER_WORSE'
        HIGHER_BETTER = 'HIGHER_BETTER'

    code = models.CharField(max_length=20, unique=True)  # PHQ9, GAD7, WHO5, PHQ2, GAD2
    name = models.CharField(max_length=100)
    item_count = models.PositiveSmallIntegerField()
    min_response = models.SmallIntegerField()
    max_response = models.SmallIntegerField()
    score_direction = models.CharField(max_length=15, choices=ScoreDirection.choices)
    recall_period_days = models.PositiveSmallIntegerField(null=True, blank=True)
    scoring_version = models.CharField(max_length=20)
    source_citation = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.code


class InstrumentItem(models.Model):
    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name='items')
    item_no = models.PositiveSmallIntegerField()
    language_code = models.CharField(max_length=5, choices=LanguageCode.choices)
    item_text = models.TextField()
    is_critical = models.BooleanField(default=False)

    class Meta:
        ordering = ['instrument', 'item_no']
        constraints = [
            models.UniqueConstraint(
                fields=['instrument', 'item_no', 'language_code'], name='uniq_item_per_language'
            ),
        ]

    def __str__(self):
        return f'{self.instrument.code} #{self.item_no} ({self.language_code})'


class SeverityBand(models.Model):
    """PHQ-9/GAD-7 band on the raw score; WHO-5 bands on the scaled (0-100) score."""

    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, related_name='bands')
    min_value = models.DecimalField(max_digits=5, decimal_places=1)
    max_value = models.DecimalField(max_digits=5, decimal_places=1)
    severity_code = models.CharField(max_length=30)
    label = models.CharField(max_length=50)
    triggers_crisis_flow = models.BooleanField(default=False)

    class Meta:
        ordering = ['instrument', 'min_value']
        constraints = [
            models.CheckConstraint(condition=Q(min_value__lte=F('max_value')), name='band_min_lte_max'),
        ]

    def __str__(self):
        return f'{self.instrument.code} {self.severity_code} [{self.min_value}-{self.max_value}]'


class AdviceContent(models.Model):
    class SuggestedAction(models.TextChoices):
        SELF_CARE = 'SELF_CARE'
        MONITOR = 'MONITOR'
        CONSIDER_PROFESSIONAL = 'CONSIDER_PROFESSIONAL'
        PRIORITY_REFERRAL = 'PRIORITY_REFERRAL'
        CRISIS_SUPPORT = 'CRISIS_SUPPORT'

    class ReviewStatus(models.TextChoices):
        DRAFT = 'DRAFT'
        CLINICALLY_REVIEWED = 'CLINICALLY_REVIEWED'
        PUBLISHED = 'PUBLISHED'
        RETIRED = 'RETIRED'

    instrument = models.ForeignKey(Instrument, on_delete=models.CASCADE, null=True, blank=True, related_name='advice')
    severity_code = models.CharField(max_length=30)  # a band code, or CRISIS
    language_code = models.CharField(max_length=5, choices=LanguageCode.choices)
    headline = models.CharField(max_length=150)
    message_body = models.TextField()
    suggested_action = models.CharField(max_length=25, choices=SuggestedAction.choices)
    version = models.PositiveIntegerField(default=1)
    review_status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.DRAFT)
    reviewed_by = models.CharField(max_length=150, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.severity_code}/{self.language_code} v{self.version}'


# --------------------------------------------------------------- Clinical store

class AssessmentSession(models.Model):
    class TriggerSource(models.TextChoices):
        INITIAL = 'INITIAL'
        SCHEDULED = 'SCHEDULED'
        NUDGE = 'NUDGE'
        USER_INITIATED = 'USER_INITIATED'

    class SessionType(models.TextChoices):
        FULL = 'FULL'    # PHQ-9, GAD-7, WHO-5
        SHORT = 'SHORT'  # PHQ-2, GAD-2, WHO-5

    id = _uuid_pk()
    user = _user_fk(related_name='assessment_sessions')
    trigger_source = models.CharField(max_length=15, choices=TriggerSource.choices)
    session_type = models.CharField(max_length=5, choices=SessionType.choices)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    crisis_shown = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.session_type} session {self.id}'


class Assessment(models.Model):
    """One scored result per instrument. Results are never combined into one score.

    `severity_code` is written only by the scoring service (rule-based), never by AI.
    """

    id = _uuid_pk()
    session = models.ForeignKey(AssessmentSession, on_delete=models.CASCADE, related_name='assessments')
    user = _user_fk(related_name='assessments')
    instrument = models.ForeignKey(Instrument, on_delete=models.PROTECT, related_name='assessments')
    raw_score = models.SmallIntegerField()
    scaled_score = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)  # WHO-5 only
    severity_code = models.CharField(max_length=30)
    critical_item_positive = models.BooleanField(default=False)
    scoring_version = models.CharField(max_length=20)
    taken_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['session', 'instrument'], name='uniq_assessment_per_session'),
        ]
        indexes = [models.Index(fields=['user', 'instrument', '-taken_at'])]

    def __str__(self):
        return f'{self.instrument.code}={self.raw_score} ({self.severity_code})'


class AssessmentResponse(models.Model):
    id = _uuid_pk()
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name='responses')
    item_no = models.PositiveSmallIntegerField()
    response_value = models.SmallIntegerField()  # range checked by the scoring service

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['assessment', 'item_no'], name='uniq_response_per_item'),
        ]

    def __str__(self):
        return f'item {self.item_no}={self.response_value}'
