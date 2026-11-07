import uuid

from django.conf import settings
from django.db import models

from core.models import Barangay, LanguageCode, UserProfile


class Service(models.Model):
    """Referral directory entry (content table, edited by Content Managers)."""

    class ServiceType(models.TextChoices):
        BARANGAY_HEALTH_CENTER = 'BARANGAY_HEALTH_CENTER'
        CITY_HEALTH_OFFICE = 'CITY_HEALTH_OFFICE'
        HOTLINE = 'HOTLINE'
        HOSPITAL = 'HOSPITAL'
        PRIVATE_PRACTICE = 'PRIVATE_PRACTICE'
        NGO = 'NGO'
        SCHOOL_GUIDANCE = 'SCHOOL_GUIDANCE'
        PEER_SUPPORT = 'PEER_SUPPORT'

    class CostType(models.TextChoices):
        FREE = 'FREE'
        SUBSIDIZED = 'SUBSIDIZED'
        PAID = 'PAID'

    class MinSeverity(models.TextChoices):
        """Lowest support tier this service suits. LOW means suitable for everyone."""
        LOW = 'LOW'
        MILD = 'MILD'
        MODERATE = 'MODERATE'
        HIGH = 'HIGH'

    name = models.CharField(max_length=150)
    service_type = models.CharField(max_length=25, choices=ServiceType.choices)
    barangay = models.ForeignKey(Barangay, null=True, blank=True, on_delete=models.PROTECT, related_name='services',
                                 help_text='Leave empty for city-wide services and hotlines.')
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    schedule_text = models.CharField(max_length=255, blank=True)
    cost_type = models.CharField(max_length=12, choices=CostType.choices)
    accepts_walk_in = models.BooleanField(default=False)
    min_severity = models.CharField(max_length=10, choices=MinSeverity.choices, default=MinSeverity.LOW)
    is_crisis_service = models.BooleanField(default=False, help_text='Shown on the crisis screen.')
    # Null means unconfirmed: the API reports verified=false so apps can say so.
    last_verified_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ServiceLanguage(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='languages')
    language_code = models.CharField(max_length=5, choices=LanguageCode.choices)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['service', 'language_code'], name='uniq_service_language')]


class ServiceSector(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='sectors')
    sector = models.CharField(max_length=25, choices=UserProfile.Sector.choices)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['service', 'sector'], name='uniq_service_sector')]


class Referral(models.Model):
    """Clinical store: a service suggested to a user, and what they did with it."""

    class Status(models.TextChoices):
        SUGGESTED = 'SUGGESTED'
        VIEWED = 'VIEWED'
        CONTACT_INITIATED = 'CONTACT_INITIATED'  # feeds the referral-uptake metric
        DISMISSED = 'DISMISSED'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.CASCADE,
                             related_name='referrals')
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name='referrals')
    session = models.ForeignKey('screening.AssessmentSession', null=True, blank=True, on_delete=models.SET_NULL,
                                related_name='referrals')
    severity_context = models.CharField(max_length=30, blank=True)  # support tier at suggestion time
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUGGESTED)
    shared_with_professional = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'service', 'session'], name='uniq_referral_per_session')]

    def __str__(self):
        return f'{self.service_id} -> {self.user_id} ({self.status})'
