"""Adaptive pre-assessment order. Pure logic.

WHO-5 first, then GAD-7.
  * WHO-5 good (scaled >= 52): a one-question PHQ-9 item 9 check (PHQ9_ITEM9) follows, then done.
  * WHO-5 not good (scaled < 52): the person is OFFERED the full PHQ-9 ("mood questions"). They may
    accept (PHQ9 follows) or decline (the session ends after GAD-7 and PHQ-9 item 9 is NOT asked).
[VERIFY] the 52 threshold against the official WHO-5 guide.
"""
from decimal import Decimal

PHQ9_IF_WHO5_BELOW = Decimal('52')

# Signalled to the client while the person has to choose; the client owns the wording.
CHOICE_MOOD_QUESTIONS = 'MOOD_QUESTIONS'


def phq9_needed(who5_scaled):
    """True when WHO-5 is not good, i.e. the full PHQ-9 is offered."""
    return who5_scaled < PHQ9_IF_WHO5_BELOW


def pending_choice(done, phq9_accepted):
    """True while WHO-5 and GAD-7 are done, the PHQ-9 is on offer, and the person has not chosen."""
    return (
        'WHO5' in done
        and 'GAD7' in done
        and phq9_needed(done['WHO5'])
        and 'PHQ9' not in done
        and phq9_accepted is None
    )


def next_instrument(done, phq9_accepted=None):
    """`done` maps completed instrument code -> scaled score (WHO5) or None.

    `phq9_accepted` is None (not asked yet), True or False. Returns the next instrument code, or
    None when nothing is due. None also covers "waiting for the choice": see `pending_choice`.
    """
    if 'WHO5' not in done:
        return 'WHO5'
    if 'GAD7' not in done:
        return 'GAD7'
    if phq9_needed(done['WHO5']):
        return 'PHQ9' if phq9_accepted is True and 'PHQ9' not in done else None
    return None if 'PHQ9_ITEM9' in done else 'PHQ9_ITEM9'


def is_complete(done, phq9_accepted=None):
    return next_instrument(done, phq9_accepted) is None and not pending_choice(done, phq9_accepted)
