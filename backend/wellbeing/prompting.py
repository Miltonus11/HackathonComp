"""Rule-based journal prompt selection. No DB, no AI: which domain to ask about is decided here.

Signals, strongest first: today's mood reason, the user's top PHQ-9 domain, then rotation so the same
domain is not asked again right away. PHQ-9 item 9 (self-harm) is never mapped to a domain.
"""

from .trends import USUAL_GAP

DOMAINS = ['MOOD', 'INTEREST', 'SLEEP', 'ENERGY', 'WORRY', 'CONCENTRATION', 'SELF_WORTH']  # also the tie-break order

# PHQ-9 items that map to a journal domain. Item 5 (appetite) and 8 (psychomotor) have none; 9 is excluded on purpose.
PHQ9_ITEM_DOMAIN = {1: 'INTEREST', 2: 'MOOD', 3: 'SLEEP', 4: 'ENERGY', 6: 'SELF_WORTH', 7: 'CONCENTRATION'}

REASON_DOMAIN = {
    'SLEEP': 'SLEEP', 'WORK': 'WORRY', 'SCHOOL': 'CONCENTRATION', 'FAMILY': 'MOOD',
    'HEALTH': 'ENERGY', 'RELATIONSHIP': 'MOOD', 'FINANCES': 'WORRY',
}

REASON_WEIGHT = 3
PHQ9_WEIGHT = 2
AVOID_REPEAT_LAST = 3  # the most recent N domains are tried last


def top_phq9_domain(responses):
    """Domain of the highest-scoring mappable PHQ-9 item (> 0). Ties go to the lower item number."""
    scored = [(value, -item) for item, value in responses.items() if item in PHQ9_ITEM_DOMAIN and value > 0]
    if not scored:
        return None
    _, neg_item = max(scored)
    return PHQ9_ITEM_DOMAIN[-neg_item]


def rank_domains(recent_domains, mood_reason, phq9_domain):
    """All domains, best first. `recent_domains` is newest first."""
    score = dict.fromkeys(DOMAINS, 0)
    if REASON_DOMAIN.get(mood_reason):
        score[REASON_DOMAIN[mood_reason]] += REASON_WEIGHT
    if phq9_domain in score:
        score[phq9_domain] += PHQ9_WEIGHT

    def age(domain):  # how long ago it was last used; never used counts as oldest
        return recent_domains.index(domain) if domain in recent_domains else len(recent_domains) + len(DOMAINS)

    def key(domain):
        return (-score[domain], -age(domain), DOMAINS.index(domain))

    held_back = set(recent_domains[:AVOID_REPEAT_LAST])
    fresh = sorted((d for d in DOMAINS if d not in held_back), key=key)
    return fresh + sorted((d for d in DOMAINS if d in held_back), key=key)


LOW_MOOD_MAX = 4
HIGH_MOOD_MIN = 8


def mood_band(score, baseline=None):
    """LOW / MID / HIGH from today's mood score, or None if there is none.

    A score well under the user's own baseline counts as LOW even if it is not low in absolute terms,
    and LOW wins over HIGH. This only tunes the TONE of a prompt; it is never an assessment.
    """
    if score is None:
        return None
    if score <= LOW_MOOD_MAX or (baseline is not None and score <= baseline - USUAL_GAP):
        return 'LOW'
    if score >= HIGH_MOOD_MIN:
        return 'HIGH'
    return 'MID'


def preferred_tone(band):
    return {'LOW': 'GENTLE', 'HIGH': 'UPBEAT'}.get(band)


def choose_prompt(prompts, recent_ids, preferred_tone=None):
    """`prompts` is [(id, rotation_weight, tone)]; `recent_ids` is newest first. Returns an id, or None.

    Prompts with the preferred tone are used if any exist, otherwise any prompt. Within that pool the
    highest-weight prompt not used recently wins; if all were used recently, the one used longest ago.
    """
    if not prompts:
        return None
    pool = prompts
    if preferred_tone:
        pool = [p for p in prompts if p[2] == preferred_tone] or prompts
    unused = [p for p in pool if p[0] not in recent_ids]
    if unused:
        return min(unused, key=lambda p: (-p[1], p[0]))[0]
    return max(pool, key=lambda p: recent_ids.index(p[0]))[0]
