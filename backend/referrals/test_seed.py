from django.core.management import call_command
from django.test import TestCase

from core.models import Barangay
from referrals.models import Service


class SeedServicesTests(TestCase):
    def test_seeds_crisis_hotlines_from_settings_and_placeholders(self):
        call_command('seed_barangays')
        call_command('seed_services')
        hotlines = Service.objects.filter(is_crisis_service=True)
        self.assertGreaterEqual(hotlines.count(), 3)
        self.assertTrue(all(h.service_type == 'HOTLINE' and h.phone for h in hotlines))
        centers = Service.objects.filter(service_type='BARANGAY_HEALTH_CENTER')
        self.assertEqual(centers.count(), Barangay.objects.count())
        self.assertTrue(Service.objects.filter(service_type='CITY_HEALTH_OFFICE').exists())

    def test_nothing_is_marked_verified_and_placeholders_are_labelled(self):
        call_command('seed_barangays')
        call_command('seed_services')
        self.assertFalse(Service.objects.exclude(last_verified_at=None).exists())
        for s in Service.objects.filter(is_crisis_service=False):
            self.assertIn('placeholder', s.name.lower())
            self.assertEqual(s.phone, '')  # no invented contact details

    def test_works_without_barangays_and_is_idempotent(self):
        call_command('seed_services')
        before = Service.objects.count()
        call_command('seed_services')
        self.assertEqual(Service.objects.count(), before)
        self.assertFalse(Service.objects.filter(service_type='BARANGAY_HEALTH_CENTER').exists())

    def test_reseed_does_not_overwrite_edits_made_in_admin(self):
        call_command('seed_services')
        s = Service.objects.get(service_type='CITY_HEALTH_OFFICE')
        s.phone = '072-123-4567'
        s.save()
        call_command('seed_services')
        s.refresh_from_db()
        self.assertEqual(s.phone, '072-123-4567')
