from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase

from screening import scoring
from screening.models import AdviceContent, Instrument, InstrumentItem, SeverityBand


class SeedScreeningTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_screening')

    def test_instruments_and_item_counts(self):
        counts = {i.code: i.items.filter(language_code='en').count() for i in Instrument.objects.all()}
        self.assertEqual(counts, {'WHO5': 5, 'GAD7': 7, 'PHQ9': 9, 'PHQ9_ITEM9': 1})
        for i in Instrument.objects.all():
            self.assertEqual(i.item_count, counts[i.code])

    def test_only_phq9_item9_is_critical(self):
        critical = InstrumentItem.objects.filter(is_critical=True)
        self.assertEqual([(c.instrument.code, c.item_no) for c in critical], [('PHQ9', 9), ('PHQ9_ITEM9', 1)])

    def test_response_ranges(self):
        r = {i.code: (i.min_response, i.max_response) for i in Instrument.objects.all()}
        self.assertEqual(r, {'WHO5': (0, 5), 'GAD7': (0, 3), 'PHQ9': (0, 3), 'PHQ9_ITEM9': (0, 3)})

    def test_bands_cover_every_possible_score_exactly_once(self):
        possible = {
            'PHQ9': [Decimal(n) for n in range(0, 28)],
            'GAD7': [Decimal(n) for n in range(0, 22)],
            'WHO5': [Decimal(n * 4) for n in range(0, 26)],  # scaled scores are multiples of 4
            'PHQ9_ITEM9': [Decimal(n) for n in range(0, 4)],
        }
        for code, values in possible.items():
            bands = list(SeverityBand.objects.filter(instrument__code=code))
            for v in values:
                hits = [b for b in bands if b.min_value <= v <= b.max_value]
                self.assertEqual(len(hits), 1, f'{code} {v}: {len(hits)} bands')
                scoring.band_for(bands, v)

    def test_severe_and_low_wellbeing_bands_trigger_crisis_flow(self):
        triggers = set(
            SeverityBand.objects.filter(triggers_crisis_flow=True).values_list('instrument__code', 'severity_code')
        )
        self.assertEqual(triggers, {('PHQ9', 'SEVERE'), ('GAD7', 'SEVERE'), ('WHO5', 'LIKELY_DEPRESSION')})

    def test_advice_exists_for_every_band_and_crisis(self):
        for b in SeverityBand.objects.select_related('instrument'):
            self.assertTrue(
                AdviceContent.objects.filter(
                    instrument=b.instrument, severity_code=b.severity_code, language_code='en', review_status='PUBLISHED'
                ).exists(),
                f'no advice for {b.instrument.code} {b.severity_code}',
            )
        self.assertTrue(AdviceContent.objects.filter(severity_code='CRISIS', language_code='en').exists())

    def test_advice_avoids_diagnosis_wording(self):
        for a in AdviceContent.objects.all():
            text = (a.headline + ' ' + a.message_body).lower()
            self.assertNotIn('you have depression', text)
            self.assertNotIn('you have anxiety', text)
            self.assertNotIn('diagnos', text.replace('not a diagnosis', '').replace('is not diagnos', ''))

    def test_is_idempotent(self):
        before = (Instrument.objects.count(), InstrumentItem.objects.count(),
                  SeverityBand.objects.count(), AdviceContent.objects.count())
        call_command('seed_screening')
        after = (Instrument.objects.count(), InstrumentItem.objects.count(),
                 SeverityBand.objects.count(), AdviceContent.objects.count())
        self.assertEqual(before, after)
