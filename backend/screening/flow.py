"""Adaptive pre-assessment order. Pure logic.

WHO-5 first, then GAD-7. PHQ-9 follows only when WHO-5 suggests poor wellbeing
(scaled score below 52, i.e. raw below 13). [VERIFY] threshold against the official WHO-5 guide.
Otherwise a one-question PHQ-9 item 9 check (PHQ9_ITEM9) is asked, so self-harm thoughts are
screened for every user whatever their WHO-5 score.
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
    if phq9_needed(done['WHO5']):
        return None if 'PHQ9' in done else 'PHQ9'
    # PHQ-9 is skipped, but the self-harm question is never skipped: ask item 9 on its own.
    return None if 'PHQ9_ITEM9' in done else 'PHQ9_ITEM9'
