"""Transparent, rule-based referral matching. No DB, no AI.

The "support tier" is a routing label derived from the severity codes of a session's results.
It is not a score and is never combined into a number or shown to the user as one.
"""
from dataclasses import dataclass

DEFAULT_LIMIT = 10

TIER_RANK = {'LOW': 0, 'MILD': 1, 'MODERATE': 2, 'HIGH': 3}

SEVERITY_TIER = {
    'MINIMAL': 'LOW', 'GOOD': 'LOW', 'NEGATIVE': 'LOW',
    'MILD': 'MILD', 'POOR': 'MILD',
    'MODERATE': 'MODERATE',
    'MODERATELY_SEVERE': 'HIGH', 'SEVERE': 'HIGH', 'LIKELY_DEPRESSION': 'HIGH', 'POSITIVE': 'HIGH',
}


@dataclass(frozen=True)
class Candidate:
    id: object
    name: str
    barangay_id: int | None
    languages: frozenset
    sectors: frozenset
    cost_type: str
    accepts_walk_in: bool
    min_severity: str
    is_crisis_service: bool


@dataclass(frozen=True)
class Ranked:
    candidate: Candidate
    score: int
    reasons: list


def tier_for(severity_codes):
    """Highest tier among the codes (LOW if none). Unknown codes raise KeyError on purpose."""
    tiers = [SEVERITY_TIER[c] for c in severity_codes]
    return max(tiers, key=TIER_RANK.__getitem__, default='LOW')


def _score(c, barangay_id, language, sector):
    score, reasons = 0, []
    if c.barangay_id is not None and c.barangay_id == barangay_id:
        score += 3
        reasons.append('In your barangay')
    elif c.barangay_id is None:
        score += 1
        reasons.append('Available city-wide')
    if language in c.languages:
        score += 2
        reasons.append('Offers support in your language')
    if sector in c.sectors:
        score += 2
        reasons.append('Serves people like you')
    if c.cost_type == 'FREE':
        score += 2
        reasons.append('Free of charge')
    elif c.cost_type == 'SUBSIDIZED':
        score += 1
        reasons.append('Subsidized cost')
    if c.accepts_walk_in:
        score += 1
        reasons.append('Accepts walk-ins')
    return score, reasons


def rank(candidates, tier, barangay_id, language, sector, limit=DEFAULT_LIMIT):
    """Eligible candidates, best first. Crisis services appear only at HIGH tier, and first."""
    out = []
    for c in candidates:
        if TIER_RANK[tier] < TIER_RANK[c.min_severity]:
            continue
        if c.is_crisis_service and tier != 'HIGH':
            continue
        score, reasons = _score(c, barangay_id, language, sector)
        out.append(Ranked(candidate=c, score=score, reasons=reasons))
    out.sort(key=lambda r: (not r.candidate.is_crisis_service, -r.score, r.candidate.name))
    return out[:limit]
