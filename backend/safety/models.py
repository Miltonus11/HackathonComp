import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class RiskFlag(models.Model):
    class Source(models.TextChoices):
        PHQ9_ITEM9 = 'PHQ9_ITEM9'
        WHO5_LOW = 'WHO5_LOW'
        SEVERE_SCORE = 'SEVERE_SCORE'
        JOURNAL_KEYWORD = 'JOURNAL_KEYWORD'
        JOURNAL_CLASSIFIER = 'JOURNAL_CLASSIFIER'
        CHAT_KEYWORD = 'CHAT_KEYWORD'
        CHAT_CLASSIFIER = 'CHAT_CLASSIFIER'
        MOOD_TREND = 'MOOD_TREND'

    class RefType(models.TextChoices):
        ASSESSMENT = 'ASSESSMENT'
        JOURNAL_ENTRY = 'JOURNAL_ENTRY'
        CHAT_MESSAGE = 'CHAT_MESSAGE'
        MOOD_ENTRY = 'MOOD_ENTRY'

    class Level(models.TextChoices):
        MODERATE = 'MODERATE'
        HIGH = 'HIGH'
        CRISIS = 'CRISIS'

    class Status(models.TextChoices):
        OPEN = 'OPEN'
        ACKNOWLEDGED = 'ACKNOWLEDGED'
        RESOLVED = 'RESOLVED'
        FALSE_ALARM = 'FALSE_ALARM'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.CASCADE, related_name='risk_flags'
    )
    source = models.CharField(max_length=20, choices=Source.choices)
    source_ref_type = models.CharField(max_length=15, choices=RefType.choices, null=True, blank=True)
    # Plain UUID, no FK: journal/chat/mood models arrive in later sub-projects. No text is copied here.
    source_ref_id = models.UUIDField(null=True, blank=True)
    level = models.CharField(max_length=10, choices=Level.choices)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [models.Index(fields=['status', 'level', '-created_at'])]

    def __str__(self):
        return f'{self.source}/{self.level} ({self.status})'


class Escalation(models.Model):
    class Status(models.TextChoices):
        QUEUED = 'QUEUED'
        ASSIGNED = 'ASSIGNED'
        CONTACT_ATTEMPTED = 'CONTACT_ATTEMPTED'
        CONTACTED = 'CONTACTED'
        REFERRED = 'REFERRED'
        CLOSED = 'CLOSED'

    class Outcome(models.TextChoices):
        SUPPORT_PROVIDED = 'SUPPORT_PROVIDED'
        REFERRED_TO_SERVICE = 'REFERRED_TO_SERVICE'
        NO_CONTACT_POSSIBLE = 'NO_CONTACT_POSSIBLE'
        NOT_ACTIONABLE = 'NOT_ACTIONABLE'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flag = models.OneToOneField(RiskFlag, on_delete=models.CASCADE, related_name='escalation')
    assigned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_escalations',
    )
    # [DECIDE] policy for crisis cases where the user has not consented to contact.
    user_contactable = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    outcome_code = models.CharField(max_length=25, choices=Outcome.choices, null=True, blank=True)
    notes = models.TextField(blank=True)  # TODO: encrypt at field level (P4 data)
    queued_at = models.DateTimeField(default=timezone.now)
    first_response_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'Escalation {self.id} ({self.status})'


class AuditLog(models.Model):
    """Append-only record of access to individual-level data and admin actions."""

    class ActorType(models.TextChoices):
        USER = 'USER'
        STAFF = 'STAFF'
        SYSTEM = 'SYSTEM'

    class Result(models.TextChoices):
        ALLOWED = 'ALLOWED'
        DENIED = 'DENIED'

    id = models.BigAutoField(primary_key=True)
    occurred_at = models.DateTimeField(default=timezone.now)
    actor_type = models.CharField(max_length=6, choices=ActorType.choices)
    actor_id = models.UUIDField()  # the actor's user_id
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.UUIDField(null=True, blank=True)
    reason_code = models.CharField(max_length=40, blank=True)
    result = models.CharField(max_length=7, choices=Result.choices)
    client_ip_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['actor_id', '-occurred_at']),
            models.Index(fields=['target_id', '-occurred_at']),
        ]

    def __str__(self):
        return f'{self.occurred_at:%Y-%m-%d %H:%M} {self.action} {self.result}'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError('AuditLog is append-only.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('AuditLog is append-only.')
