"""
Seed the core.Barangay lookup table from barangays.json.

Run it later, from the backend directory (with the same environment/.env you use for runserver):

    cd backend
    python ../seed/seed_barangays.py            # create/update the barangays
    python ../seed/seed_barangays.py --dry-run  # show what would change, write nothing

Safe to run repeatedly: rows are matched on (name, city_municipality) and updated in place.
This file lives outside backend/ on purpose; it does not modify any backend code.
"""
import argparse
import json
import os
import sys
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent
BACKEND_DIR = Path.cwd()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument('--dry-run', action='store_true', help='report changes without writing')
    args = parser.parse_args()

    if not (BACKEND_DIR / 'manage.py').exists():
        print('Run this from the backend directory (the one containing manage.py).', file=sys.stderr)
        return 1

    sys.path.insert(0, str(BACKEND_DIR))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    import django

    django.setup()
    from django.db import transaction

    from core.models import Barangay

    data = json.loads((SEED_DIR / 'barangays.json').read_text(encoding='utf-8'))
    city, province = data['city_municipality'], data['province']

    created = updated = unchanged = 0
    with transaction.atomic():
        for item in data['barangays']:
            defaults = {'province': province, 'psgc_code': item.get('psgc_code')}
            obj = Barangay.objects.filter(name=item['name'], city_municipality=city).first()
            if obj is None:
                created += 1
                if not args.dry_run:
                    Barangay.objects.create(name=item['name'], city_municipality=city, **defaults)
            elif any(getattr(obj, k) != v for k, v in defaults.items()):
                updated += 1
                if not args.dry_run:
                    for k, v in defaults.items():
                        setattr(obj, k, v)
                    obj.save()
            else:
                unchanged += 1
        if args.dry_run:
            transaction.set_rollback(True)

    mode = 'DRY RUN - nothing written. ' if args.dry_run else ''
    print(f'{mode}barangays: {created} created, {updated} updated, {unchanged} unchanged '
          f'({len(data["barangays"])} in file).')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
