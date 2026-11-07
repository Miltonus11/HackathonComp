"""
Seed Filipino (language_code='fil') pre-assessment questions and advice text.

Run later, from the backend directory, AFTER `python manage.py seed_screening`:

    cd backend
    python ../seed/seed_screening_fil.py --dry-run   # show what would change, write nothing
    python ../seed/seed_screening_fil.py             # write

Idempotent. This file lives outside backend/ on purpose; it adds rows only and changes no code.

DRAFT TRANSLATIONS written by the assistant. [VERIFY] against the validated Filipino versions
of the WHO-5, GAD-7 and PHQ-9 and have a fluent reviewer check them. Rows are published with the
same "pending clinical review" marker as the English seed, so they have NOT been clinically reviewed.
The question lists must stay in the same order and count as the English seed (item_no 1..n).
The WHO5/POOR text assumes the English wording is changed to "no more questions" (see
docs/superpowers/plans/2026-11-07-mobile-pre-assessment.md, Backend ask 1).
"""
import argparse
import os
import sys
from pathlib import Path

BACKEND_DIR = Path.cwd()

ITEMS = {
    'WHO5': [
        'Naging masaya ako at maganda ang aking pakiramdam',
        'Naging kalmado at relaks ako',
        'Naging masigla at aktibo ako',
        'Gumising akong presko at nakapagpahinga nang mabuti',
        'Ang pang-araw-araw kong buhay ay puno ng mga bagay na kinagigiliwan ko',
    ],
    'GAD7': [
        'Pakiramdam na kinakabahan, balisa, o hindi mapakali',
        'Hindi mapigilan o makontrol ang pag-aalala',
        "Sobrang pag-aalala sa iba't ibang bagay",
        'Hirap magrelaks',
        'Sobrang hindi mapakali kaya mahirap umupo nang tahimik',
        'Madaling mairita o mainis',
        'Pakiramdam na takot, na para bang may kakila-kilabot na mangyayari',
    ],
    'PHQ9': [
        'Kaunting interes o kasiyahan sa paggawa ng mga bagay',
        'Pakiramdam na malungkot, nanlulumo, o walang pag-asa',
        'Hirap makatulog o manatiling tulog, o sobrang pagtulog',
        'Pakiramdam na pagod o kaunti ang lakas',
        'Walang gana kumain o sobrang pagkain',
        'Masama ang pakiramdam sa sarili, o pakiramdam na ikaw ay pumalpak o nabigo mo ang sarili o ang pamilya mo',
        'Hirap mag-concentrate sa mga bagay, tulad ng pagbabasa o panonood ng telebisyon',
        'Napakabagal kumilos o magsalita na napansin ng ibang tao, o kabaligtaran: sobrang hindi mapakali kaya mas madalas kang gumagalaw kaysa karaniwan',
        'Mga kaisipang mas mabuti pang mamatay ka na, o ang saktan ang sarili sa anumang paraan',
    ],
    'PHQ9_ITEM9': [
        'Mga kaisipang mas mabuti pang mamatay ka na, o ang saktan ang sarili sa anumang paraan',
    ],
}

# (instrument, severity_code) -> (headline, message)
ADVICE = {
    ('PHQ9', 'MINIMAL'): ('Kaunti o walang senyales ng mababang mood',
        'Ipinapahiwatig ng iyong mga sagot na kaunti o walang senyales ng mababang mood sa ngayon. Ipagpatuloy ang mga gawi na nakakatulong sa iyo, at muling magsuri pagkalipas ng halos dalawang linggo.'),
    ('PHQ9', 'MILD'): ('Ilang senyales ng mababang mood',
        'Ipinapahiwatig ng iyong mga sagot ang banayad na senyales ng mababang mood. Makakatulong ang maliliit na hakbang tulad ng regular na tulog, paggalaw, at pakikipag-usap sa taong pinagkakatiwalaan mo. May suporta kung nais mo.'),
    ('PHQ9', 'MODERATE'): ('Senyales ng katamtamang mababang mood',
        'Ipinapahiwatig ng iyong mga sagot ang katamtamang senyales ng mababang mood. Ito ay resulta ng screening, hindi konklusyon tungkol sa iyo. Makakatulong ang pakikipag-usap sa isang propesyonal sa kalusugan, at maipapakita namin ang mga opsyon malapit sa iyo.'),
    ('PHQ9', 'MODERATELY_SEVERE'): ('Senyales ng malaking pagbaba ng mood',
        'Ipinapahiwatig ng iyong mga sagot ang malaking senyales ng mababang mood. Mariin naming hinihikayat kang kumausap ng propesyonal sa kalusugan sa lalong madaling panahon. Maipapakita namin ang mga serbisyo at matutulungan kang makipag-ugnayan sa mga ito.'),
    ('PHQ9', 'SEVERE'): ('Senyales ng matinding mababang mood',
        'Ipinapahiwatig ng iyong mga sagot ang matinding senyales ng mababang mood. Mangyaring lumapit sa propesyonal sa kalusugan o sa taong pinagkakatiwalaan mo sa lalong madaling panahon. Hindi mo kailangang harapin ito nang mag-isa.'),
    ('PHQ9_ITEM9', 'NEGATIVE'): ('Salamat sa pagsagot',
        'Ipinapahiwatig ng iyong sagot na wala kang naging pag-iisip na saktan ang sarili kamakailan. Kung magbago ito, laging may suporta at maaari kang lumapit anumang oras.'),
    ('PHQ9_ITEM9', 'POSITIVE'): ('Salamat sa pagsasabi sa amin',
        'Ipinapahiwatig ng iyong sagot na nagkaroon ka ng pag-iisip na saktan ang sarili. Karapat-dapat kang tulungan, at hindi mo kailangang harapin ito nang mag-isa. Pakitingnan ang mga opsyon sa tulong na ipinapakita kasama ng resultang ito.'),
    ('GAD7', 'MINIMAL'): ('Kaunti o walang senyales ng pagkabalisa',
        'Ipinapahiwatig ng iyong mga sagot na kaunti o walang senyales ng pagkabalisa sa ngayon. Ipagpatuloy ang mga bagay na nakakatulong sa iyong maging mapayapa.'),
    ('GAD7', 'MILD'): ('Ilang senyales ng pagkabalisa',
        'Ipinapahiwatig ng iyong mga sagot ang banayad na senyales ng pagkabalisa. Makakatulong ang mabagal na paghinga, tuloy-tuloy na routine, at paglimita sa mga nagdudulot ng stress. May suporta kung nais mo.'),
    ('GAD7', 'MODERATE'): ('Senyales ng katamtamang pagkabalisa',
        'Ipinapahiwatig ng iyong mga sagot ang katamtamang senyales ng pagkabalisa. Ito ay resulta ng screening, hindi konklusyon tungkol sa iyo. Makakatulong ang pakikipag-usap sa propesyonal sa kalusugan, at maipapakita namin ang mga opsyon malapit sa iyo.'),
    ('GAD7', 'SEVERE'): ('Senyales ng matinding pagkabalisa',
        'Ipinapahiwatig ng iyong mga sagot ang matinding senyales ng pagkabalisa. Mariin naming hinihikayat kang kumausap ng propesyonal sa kalusugan sa lalong madaling panahon. Maipapakita namin ang mga serbisyo at matutulungan kang makipag-ugnayan sa mga ito.'),
    ('WHO5', 'GOOD'): ('Mukhang maganda ang iyong kagalingan',
        'Ipinapahiwatig ng iyong mga sagot ang magandang kagalingan sa nakalipas na dalawang linggo. Ipagpatuloy ang mga bagay na gumagana para sa iyo, at muling magsuri pagkalipas ng halos dalawang linggo.'),
    ('WHO5', 'POOR'): ('Mukhang mababa ang iyong kagalingan',
        'Ipinapahiwatig ng iyong mga sagot na mababa ang iyong kagalingan sa nakalipas na dalawang linggo. Makakatulong ang maliliit na hakbang tulad ng sapat na pahinga, paggalaw, at pakikipag-usap sa taong pinagkakatiwalaan mo. May suporta kung nais mo.'),
    ('WHO5', 'LIKELY_DEPRESSION'): ('Mukhang napakababa ng iyong kagalingan',
        'Ipinapahiwatig ng iyong mga sagot na napakababa ng iyong kagalingan sa nakalipas na dalawang linggo. Mariin naming hinihikayat kang kumausap ng propesyonal sa kalusugan o ng taong pinagkakatiwalaan mo.'),
}

CRISIS = ('Hindi ka nag-iisa, at may tulong na makukuha',
    'Salamat sa pagiging tapat. Maaaring dumaranas ka ng napakahirap na bagay, at karapat-dapat kang makatanggap ng suporta ngayon. Kung ikaw ay nasa panganib o may iniisip na saktan ang sarili, mangyaring tumawag sa isa sa mga numero sa ibaba o pumunta sa pinakamalapit na emergency room. Maaari ka ring magsabi sa taong pinagkakatiwalaan mo, o pindutin ang "Talk to a person" para makipag-ugnayan sa isang sinanay na responder.')


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
    from django.utils import timezone

    from screening import seed_data
    from screening.models import AdviceContent, Instrument, InstrumentItem

    instruments = {i.code: i for i in Instrument.objects.all()}
    missing = sorted(set(ITEMS) - set(instruments))
    if missing:
        print(f'Instruments not found: {missing}. Run `python manage.py seed_screening` first.', file=sys.stderr)
        return 1

    counts = {'items': 0, 'advice': 0}
    with transaction.atomic():
        for code, texts in ITEMS.items():
            inst = instruments[code]
            if inst.item_count != len(texts):
                print(f'{code}: server has {inst.item_count} items, translation has {len(texts)}. Aborting.', file=sys.stderr)
                return 1
            critical = set(seed_data.INSTRUMENTS[code].get('critical_items', []))
            for n, text in enumerate(texts, start=1):
                counts['items'] += 1
                if not args.dry_run:
                    InstrumentItem.objects.update_or_create(
                        instrument=inst, item_no=n, language_code='fil',
                        defaults={'item_text': text, 'is_critical': n in critical})

        common = dict(language_code='fil', version=1, review_status=AdviceContent.ReviewStatus.PUBLISHED,
                      reviewed_by=seed_data.SEED_REVIEWER, reviewed_at=timezone.now(), is_active=True)
        english = {(code, sev): action for code, sev, action, _h, _b in seed_data.ADVICE}
        for (code, sev), (headline, body) in ADVICE.items():
            counts['advice'] += 1
            if not args.dry_run:
                AdviceContent.objects.update_or_create(
                    instrument=instruments[code], severity_code=sev, language_code='fil', version=1,
                    defaults=dict(common, suggested_action=english[(code, sev)], headline=headline, message_body=body))
        counts['advice'] += 1
        if not args.dry_run:
            AdviceContent.objects.update_or_create(
                instrument=None, severity_code='CRISIS', language_code='fil', version=1,
                defaults=dict(common, suggested_action='CRISIS_SUPPORT', headline=CRISIS[0], message_body=CRISIS[1]))
        if args.dry_run:
            transaction.set_rollback(True)

    mode = 'DRY RUN - nothing written. ' if args.dry_run else ''
    print(f"{mode}Filipino rows: {counts['items']} questions, {counts['advice']} advice texts.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
