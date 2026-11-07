"""Adaptive pre-assessment order. Pure logic.

WHO-5 first, then GAD-7. PHQ-9 follows only when WHO-5 suggests poor wellbeing
(scaled score below 52, i.e. raw below 13). [VERIFY] threshold against the official WHO-5 guide.
"""
from decimal import Decimal

PHQ9_IF_WHO5_BELOW = Decimal('52')


def phq9_needed(who5_scaled):
    return who5_scaled < PHQ9_IF_WHO5_BELOW


def next_instrument(done):
    """`done` maps completed instrument code -> scaled score (WHO5) or None. Returns next code or None."""
    if 'WHO5' not in done:
        return 'WHO5'
    if 'GAD7' not in done:
        return 'GAD7'
    if phq9_needed(done['WHO5']) and 'PHQ9' not in done:
        return 'PHQ9'
    return None
