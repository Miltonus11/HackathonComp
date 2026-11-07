import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


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
