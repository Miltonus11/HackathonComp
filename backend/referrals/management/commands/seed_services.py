from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Barangay
from referrals.models import Service, ServiceSector

PLACEHOLDER = ' (placeholder)'


class Command(BaseCommand):
    help = (
        'Seed the referral directory with crisis hotlines and clearly-marked PLACEHOLDER entries. '
        'Nothing is marked verified and no contact details are invented. Idempotent; never overwrites edits.'
    )

    @transaction.atomic
    def handle(self, *args, **opts):
        created = 0

        def add(name, sectors=(), **fields):
            nonlocal created
            service, was_created = Service.objects.get_or_create(name=name, defaults=fields)
            if was_created:
                created += 1
                for sector in sectors:
                    ServiceSector.objects.create(service=service, sector=sector)

        # Hotlines come from settings.CRISIS_HOTLINES. [VERIFY] every number before launch.
        for h in settings.CRISIS_HOTLINES:
            add(h['name'], service_type='HOTLINE', phone=h['number'], cost_type='FREE', min_severity='LOW',
                is_crisis_service=True)

        add('City Health Office - San Fernando' + PLACEHOLDER, service_type='CITY_HEALTH_OFFICE',
            cost_type='FREE', min_severity='MILD')
        add('School Guidance Office' + PLACEHOLDER, sectors=['STUDENT'], service_type='SCHOOL_GUIDANCE',
            cost_type='FREE', min_severity='MILD')
        add('Partner Psychologist' + PLACEHOLDER, service_type='PRIVATE_PRACTICE', cost_type='PAID',
            min_severity='MODERATE')

        for b in Barangay.objects.all():
            add(f'Barangay Health Center - {b.name}{PLACEHOLDER}', service_type='BARANGAY_HEALTH_CENTER',
                barangay=b, cost_type='FREE', min_severity='MILD')

        self.stdout.write(self.style.SUCCESS(f'Directory seeded: {created} created. Replace placeholders in the admin.'))
