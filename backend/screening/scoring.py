"""Deterministic, rule-based instrument scoring. No DB access, no AI.

PHQ-9 / GAD-7 are banded on the raw sum; WHO-5 on the scaled (raw x 4, 0-100) score.
Severity is produced here and nowhere else.
"""
from dataclasses import dataclass
from decimal import Decimal

WHO5_SCALE_FACTOR = 4


@dataclass(frozen=True)
class ScoreResult:
    raw_score: int
    scaled_score: Decimal | None
    severity_code: str
    label: str
    band_triggers_crisis: bool
    critical_item_positive: bool


def validate_responses(responses, item_count, min_response, max_response):
    """Require exactly items 1..item_count, each within [min_response, max_response]."""
    expected = set(range(1, item_count + 1))
    given = set(responses)
    if given - expected:
        raise ValueError(f'unknown item(s): {sorted(given - expected)}')
    if expected - given:
        raise ValueError(f'missing item(s): {sorted(expected - given)}')
    for item_no, value in responses.items():
        if not isinstance(value, int) or isinstance(value, bool) or not min_response <= value <= max_response:
            raise ValueError(f'item {item_no}: value {value!r} out of range {min_response}-{max_response}')


def band_for(bands, value):
    """Return the band whose inclusive [min_value, max_value] contains value."""
    for b in bands:
        if b.min_value <= value <= b.max_value:
            return b
    raise LookupError(f'no severity band covers {value}')


def score_instrument(code, responses, bands, critical_items=frozenset()):
    raw = sum(responses.values())
    scaled = Decimal(raw * WHO5_SCALE_FACTOR).quantize(Decimal('0.1')) if code == 'WHO5' else None
    band = band_for(bands, scaled if scaled is not None else Decimal(raw))
    return ScoreResult(
        raw_score=raw,
        scaled_score=scaled,
        severity_code=band.severity_code,
        label=getattr(band, 'label', band.severity_code),
        band_triggers_crisis=band.triggers_crisis_flow,
        critical_item_positive=any(responses.get(n, 0) > 0 for n in critical_items),
    )
