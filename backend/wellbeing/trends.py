"""Mood trend helpers. Pure and rule-based: mood is a tracker, never an assessment, and never sets severity."""

MIN_ENTRIES_FOR_BASELINE = 3
BASELINE_WINDOW_DAYS = 30


def baseline(scores):
    """The user's own average mood, or None until there are enough entries to mean something."""
    scores = list(scores)
    if len(scores) < MIN_ENTRIES_FOR_BASELINE:
        return None
    return round(sum(scores) / len(scores), 1)


USUAL_GAP = 2  # points away from the user's own baseline before it counts as "different from usual"


def trend_label(score, baseline_value):
    """How today's mood compares with the user's own baseline, or None if there is no baseline yet."""
    if baseline_value is None:
        return None
    delta = score - baseline_value
    if delta <= -USUAL_GAP:
        return 'LOWER_THAN_USUAL'
    if delta >= USUAL_GAP:
        return 'HIGHER_THAN_USUAL'
    return 'ABOUT_USUAL'
