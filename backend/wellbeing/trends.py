"""Mood trend helpers. Pure and rule-based: mood is a tracker, never an assessment, and never sets severity."""

MIN_ENTRIES_FOR_BASELINE = 3
BASELINE_WINDOW_DAYS = 30


def baseline(scores):
    """The user's own average mood, or None until there are enough entries to mean something."""
    scores = list(scores)
    if len(scores) < MIN_ENTRIES_FOR_BASELINE:
        return None
    return round(sum(scores) / len(scores), 1)
