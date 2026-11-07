import uuid
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def validate_birth_year(value):
    if value < 1900 or value > date.today().year:
        raise ValidationError(f'Birth year must be between 1900 and {date.today().year}.')


class LanguageCode(models.TextChoices):
    ENGLISH = 'en'
    FILIPINO = 'fil'
    # ILOCANO = 'ilo'  # add after validation


class Barangay(models.Model):
    """Lookup. Barangay is the finest location the system stores."""

    name = models.CharField(max_length=100)
    psgc_code = models.CharField(max_length=15, unique=True, null=True, blank=True)
    district = models.CharField(max_length=50, blank=True)
    city_municipality = models.CharField(max_length=100, default='City of San Fernando')
    province = models.CharField(max_length=100, default='La Union')

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'barangays'
        constraints = [
            models.UniqueConstraint(fields=['name', 'city_municipality'], name='uniq_barangay_name_city'),
        ]

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    """Registration data, linked to identity only through user_id."""

    class Sex(models.TextChoices):
        FEMALE = 'FEMALE'
        MALE = 'MALE'
        PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY'

    class Sector(models.TextChoices):
        STUDENT = 'STUDENT'
        EMPLOYEE = 'EMPLOYEE'
        SELF_EMPLOYED = 'SELF_EMPLOYED'
        UNEMPLOYED = 'UNEMPLOYED'
        SENIOR = 'SENIOR'
        OUT_OF_SCHOOL_YOUTH = 'OUT_OF_SCHOOL_YOUTH'
        HEALTHCARE_WORKER = 'HEALTHCARE_WORKER'
        OTHER = 'OTHER'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        to_field='user_id',
        primary_key=True,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    birth_year = models.PositiveSmallIntegerField(validators=[validate_birth_year])
    sex = models.CharField(max_length=20, choices=Sex.choices)
    sector = models.CharField(max_length=25, choices=Sector.choices)
    occupation_detail = models.CharField(max_length=100, blank=True)
    barangay = models.ForeignKey(Barangay, on_delete=models.PROTECT, related_name='profiles')
    language_code = models.CharField(max_length=5, choices=LanguageCode.choices, default=LanguageCode.ENGLISH)
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Profile {self.user_id}'

    @property
    def age_band(self):
        age = date.today().year - self.birth_year
        if age < 18:
            return 'UNDER_18'
        if age <= 24:
            return '18_24'
        if age <= 34:
            return '25_34'
        if age <= 44:
            return '35_44'
        if age <= 59:
            return '45_59'
        return '60_PLUS'


class Consent(models.Model):
    """Insert-only. A withdrawal is a new row with granted=False."""

    class ConsentType(models.TextChoices):
        APP_USE = 'APP_USE'
        AI_ANALYSIS = 'AI_ANALYSIS'
        PROFESSIONAL_SHARING = 'PROFESSIONAL_SHARING'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, to_field='user_id', on_delete=models.CASCADE, related_name='consents'
    )
    consent_type = models.CharField(max_length=25, choices=ConsentType.choices)
    granted = models.BooleanField()
    notice_version = models.CharField(max_length=20)
    language_code = models.CharField(max_length=5, choices=LanguageCode.choices)
    decided_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [models.Index(fields=['user', 'consent_type', '-decided_at'])]

    def __str__(self):
        return f'{self.consent_type}={self.granted} ({self.user_id})'

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError('Consent records are insert-only; add a new row instead.')
        super().save(*args, **kwargs)

    @classmethod
    def has_active(cls, user, consent_type):
        latest = (
            cls.objects.filter(user=user, consent_type=consent_type)
            .order_by('-decided_at')
            .values_list('granted', flat=True)
            .first()
        )
        return bool(latest)
