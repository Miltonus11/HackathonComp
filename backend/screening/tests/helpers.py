from django.core.management import call_command

from accounts.models import User
from core.models import Barangay, Consent, UserProfile

PASSWORD = 'S3cure-pass-123'


def make_user(mobile='+639171234567', consent=True, profile=True, followup=False):
    user = User.objects.create_user(mobile, PASSWORD, contact_for_followup=followup)
    if profile:
        brgy, _ = Barangay.objects.get_or_create(name='Poro')
        UserProfile.objects.create(
            user=user, birth_year=2000, sex='FEMALE', sector='STUDENT', barangay=brgy, language_code='en'
        )
    if consent:
        Consent.objects.create(user=user, consent_type='APP_USE', granted=True, notice_version='v1',
                               language_code='en')
    return user


def seed():
    call_command('seed_screening')


def uniform(n, value):
    return {i: value for i in range(1, n + 1)}


# WHO-5 (0-5 each): raw*4 = scaled
WHO5_GOOD = uniform(5, 4)      # 80
WHO5_POOR = uniform(5, 2)      # 40
WHO5_VERY_LOW = uniform(5, 1)  # 20 -> LIKELY_DEPRESSION
GAD7_MINIMAL = uniform(7, 0)
GAD7_SEVERE = uniform(7, 3)    # 21
PHQ9_MINIMAL = uniform(9, 0)
PHQ9_SEVERE = uniform(9, 3)    # 27


def phq9_item9_only():
    r = uniform(9, 0)
    r[9] = 1
    return r
