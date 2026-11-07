from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from screening import seed_data as sd
from screening.models import AdviceContent, Instrument, InstrumentItem, SeverityBand


class Command(BaseCommand):
    help = 'Seed PHQ-9 / GAD-7 / WHO-5 instruments, items, severity bands and advice (idempotent).'

    @transaction.atomic
    def handle(self, *args, **opts):
        lang = 'en'
        by_code = {}
        for code, spec in sd.INSTRUMENTS.items():
            inst, _ = Instrument.objects.update_or_create(
                code=code,
                defaults=dict(
                    name=spec['name'], item_count=len(spec['items']), min_response=spec['min_response'],
                    max_response=spec['max_response'], score_direction=spec['score_direction'],
                    recall_period_days=spec['recall_period_days'], scoring_version=spec['scoring_version'],
                    source_citation=spec['source_citation'], is_active=True,
                ),
            )
            by_code[code] = inst
            critical = set(spec.get('critical_items', []))
            for n, text in enumerate(spec['items'], start=1):
                InstrumentItem.objects.update_or_create(
                    instrument=inst, item_no=n, language_code=lang,
                    defaults=dict(item_text=text, is_critical=n in critical),
                )
            SeverityBand.objects.filter(instrument=inst).delete()
            for lo, hi, sev, label, crisis in sd.BANDS[code]:
                SeverityBand.objects.create(
                    instrument=inst, min_value=Decimal(str(lo)), max_value=Decimal(str(hi)),
                    severity_code=sev, label=label, triggers_crisis_flow=crisis,
                )

        now = timezone.now()
        common = dict(language_code=lang, version=1, review_status=AdviceContent.ReviewStatus.PUBLISHED,
                      reviewed_by=sd.SEED_REVIEWER, reviewed_at=now, is_active=True)
        for code, sev, action, headline, body in sd.ADVICE:
            AdviceContent.objects.update_or_create(
                instrument=by_code[code], severity_code=sev, language_code=lang, version=1,
                defaults=dict(common, suggested_action=action, headline=headline, message_body=body),
            )
        sev, action, headline, body = sd.CRISIS_ADVICE
        AdviceContent.objects.update_or_create(
            instrument=None, severity_code=sev, language_code=lang, version=1,
            defaults=dict(common, suggested_action=action, headline=headline, message_body=body),
        )
        self.stdout.write(self.style.SUCCESS('Screening content seeded.'))
