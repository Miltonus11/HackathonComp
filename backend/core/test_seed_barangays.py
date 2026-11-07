from django.core.management import call_command
from django.test import TestCase

from core.models import Barangay


class SeedBarangaysTests(TestCase):
    def test_seeds_all_59_barangays_of_san_fernando(self):
        call_command('seed_barangays')
        self.assertEqual(Barangay.objects.count(), 59)
        self.assertEqual(Barangay.objects.exclude(city_municipality='City of San Fernando').count(), 0)
        self.assertEqual(Barangay.objects.exclude(province='La Union').count(), 0)

    def test_names_are_clean_and_include_edge_cases(self):
        call_command('seed_barangays')
        names = set(Barangay.objects.values_list('name', flat=True))
        for expected in ('Barangay I', 'Barangay IV', 'Siboan-Otong', 'Tanquigan', 'Dallangayan Este', 'Poro'):
            self.assertIn(expected, names)
        self.assertFalse([n for n in names if 'San Fernando' in n or n != n.strip()])

    def test_is_idempotent_and_keeps_existing_rows(self):
        existing = Barangay.objects.create(name='Poro', psgc_code='012812034')
        call_command('seed_barangays')
        call_command('seed_barangays')
        self.assertEqual(Barangay.objects.count(), 59)
        existing.refresh_from_db()
        self.assertEqual(existing.psgc_code, '012812034')  # never overwrites a PSGC code already set
