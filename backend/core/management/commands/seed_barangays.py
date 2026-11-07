from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Barangay

CITY = 'City of San Fernando'
PROVINCE = 'La Union'

# The 59 barangays of the City of San Fernando, La Union (list supplied by the team).
# PSGC codes are not included yet: add them in the admin or here once confirmed. [VERIFY]
BARANGAYS = [
    'Abut', 'Apaleng', 'Bacsil', 'Bangbangolan', 'Bangcusay',
    'Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV',
    'Baraoas', 'Bato', 'Biday', 'Birunget', 'Bungro',
    'Cabaroan', 'Cabarsican', 'Cadaclan', 'Calabugao', 'Camansi', 'Canaoay', 'Carlatan', 'Catbangen',
    'Dallangayan Este', 'Dallangayan Oeste', 'Dalumpinas Este', 'Dalumpinas Oeste',
    'Ilocanos Norte', 'Ilocanos Sur', 'Langcuas', 'Lingsat',
    'Madayegdeg', 'Mameltac', 'Masicong',
    'Nagyubuyuban', 'Namtutan', 'Narra Este', 'Narra Oeste',
    'Pacpaco', 'Pagdalagan', 'Pagdaraoan', 'Pagudpud', 'Pao Norte', 'Pao Sur', 'Parian', 'Pias', 'Poro', 'Puspus',
    'Sacyud', 'Sagayad', 'San Agustin', 'San Francisco', 'San Vicente', 'Santiago Norte', 'Santiago Sur',
    'Saoay', 'Sevilla', 'Siboan-Otong', 'Tanqui', 'Tanquigan',
]


class Command(BaseCommand):
    help = 'Seed the barangays of the City of San Fernando, La Union (idempotent).'

    @transaction.atomic
    def handle(self, *args, **opts):
        created = 0
        for name in BARANGAYS:
            # get_or_create: never overwrite fields (e.g. a PSGC code) that were filled in later.
            _, was_created = Barangay.objects.get_or_create(
                name=name, city_municipality=CITY, defaults={'province': PROVINCE})
            created += was_created
        self.stdout.write(self.style.SUCCESS(
            f'Barangays: {created} created, {len(BARANGAYS) - created} already present.'))
