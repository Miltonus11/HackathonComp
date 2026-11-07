import re
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

PH_MOBILE_RE = re.compile(r'^\+639\d{9}$')

mobile_validator = RegexValidator(
    regex=r'^\+639\d{9}$',
    message='Enter a valid PH mobile number, e.g. +639171234567.',
)


def normalize_mobile(value):
    """Normalize 09XXXXXXXXX / 9XXXXXXXXX / 639XXXXXXXXX / +639XXXXXXXXX to +639XXXXXXXXX."""
    if value is None:
        return value
    digits = re.sub(r'[\s\-().]', '', str(value))
    if digits.startswith('+'):
        return digits
    if digits.startswith('09') and len(digits) == 11:
        return '+63' + digits[1:]
    if digits.startswith('639') and len(digits) == 12:
        return '+' + digits
    if digits.startswith('9') and len(digits) == 10:
        return '+63' + digits
    return digits


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, mobile_number, password, **extra):
        if not mobile_number:
            raise ValueError('Mobile number is required')
        mobile_number = normalize_mobile(mobile_number)
        if not PH_MOBILE_RE.match(mobile_number):
            raise ValueError('Mobile number must be a valid PH number (+639XXXXXXXXX)')
        if extra.get('email'):
            extra['email'] = self.normalize_email(extra['email']).lower()
        else:
            extra['email'] = None
        user = self.model(mobile_number=mobile_number, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, mobile_number, password=None, **extra):
        extra.setdefault('is_staff', False)
        extra.setdefault('is_superuser', False)
        return self._create_user(mobile_number, password, **extra)

    def create_superuser(self, mobile_number, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('role', User.Role.ADMIN)
        return self._create_user(mobile_number, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Identity store: residents and staff share this table, split by `role`.

    `user_id` is the pseudonymous ID. Every clinical table references it
    (never the Django PK), so identity data is never joined in analytics.
    """

    class Role(models.TextChoices):
        USER = 'USER'
        ADMIN = 'ADMIN'
        CASE_OFFICER = 'CASE_OFFICER'
        CONTENT_MANAGER = 'CONTENT_MANAGER'
        DPO = 'DPO'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE'
        SUSPENDED = 'SUSPENDED'
        DELETION_REQUESTED = 'DELETION_REQUESTED'
        DELETED = 'DELETED'

    STAFF_ROLES = (Role.ADMIN, Role.CASE_OFFICER, Role.CONTENT_MANAGER, Role.DPO)

    user_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    mobile_number = models.CharField(max_length=20, unique=True, validators=[mobile_validator])
    mobile_verified_at = models.DateTimeField(null=True, blank=True)
    email = models.EmailField(unique=True, null=True, blank=True)

    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    display_name = models.CharField(max_length=100, blank=True, help_text='Nickname shown in the app.')

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    license_no = models.CharField(max_length=50, blank=True)
    contact_for_followup = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    mfa_enabled = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'mobile_number'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.mobile_number

    @property
    def shown_name(self):
        return self.display_name or self.first_name or 'Friend'

    @property
    def is_staff_role(self):
        return self.role in self.STAFF_ROLES

    def clean(self):
        super().clean()
        self.mobile_number = normalize_mobile(self.mobile_number)
        errors = {}
        if self.role in self.STAFF_ROLES:
            if not self.first_name:
                errors['first_name'] = 'Required for staff accounts.'
            if not self.last_name:
                errors['last_name'] = 'Required for staff accounts.'
        if self.role == self.Role.CASE_OFFICER and not self.license_no:
            errors['license_no'] = 'Professional license number is required for case officers.'
        if errors:
            raise ValidationError(errors)
