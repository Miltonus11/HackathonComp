"""Deterministic guards around the AI: scrub what goes in, check what comes out. No AI here.

A model follows its instructions most of the time, not every time, so nothing it writes reaches a user
until these rules pass. A reply that fails is discarded, never "fixed".
"""
import re

from safety import crisis_terms

MAX_MESSAGE = 600
MAX_NUDGE = 200
MAX_LEAD_IN = 140

# ------------------------------------------------------------------------------------- input: redaction

_URL = re.compile(r'(?:https?://|www\.)\S+', re.I)
_EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
_PHONE = re.compile(r'(?<!\w)\+?\d(?:[\s().-]{0,2}\d){6,}(?!\w)')  # 7+ digits, with common separators


def redact(text):
    """Replace links, emails and phone numbers. Names and places the user writes cannot be removed reliably."""
    text = _URL.sub('[link]', text or '')
    text = _EMAIL.sub('[email]', text)
    return _PHONE.sub('[number]', text)


# ------------------------------------------------------------------------------------ output: validation

_BANNED = [re.compile(p, re.I) for p in [
    # diagnosis
    r'diagnos', r'disorder', r'depress', r'bipolar', r'schizo', r'ptsd', r'\bocd\b', r'\badhd\b',
    r'mental illness', r'clinical',
    # medication and treatment
    r'medicat', r'antidepress', r'prescri', r'\bdos(?:e|es|age)\b', r'\bpills?\b', r'\bssris?\b',
    # severity and scores
    r'severe', r'severity', r'\bscores?\b', r'\bphq', r'\bgad(?:[\s-]?7)?\b', r'\bwho[\s-]?5\b',
    # claiming to be a professional
    r"\bi(?:'m| am)\s+(?:a|an|your)\s+(?:\w+\s+){0,2}(?:therapist|psychologist|psychiatrist|doctor|counsel+or|clinician|nurse)\b",
    r"\bas\s+(?:a|an|your)\s+(?:\w+\s+)?(?:therapist|psychologist|psychiatrist|counsel+or|doctor)\b",
    # contact details and links
    r'https?://', r'www\.', r'[\w.+-]+@[\w-]+\.[\w.-]+', r'\d(?:[\s().-]*\d){6}',
    # self-harm language addressed to the reader (the keyword list covers first person)
    r'(?:hurt|harm|kill|cut)(?:ting|ing)?\s+your\s?self', r'end(?:ing)?\s+your\s+life', r'self[\s-]?harm',
]]


def _violates(text):
    text = text.replace('’', "'").replace('‘', "'")
    return any(p.search(text) for p in _BANNED) or crisis_terms.scan(text).flagged


def check_reflection(data):
    """The encouraging reply: {'message': str, 'nudge': str|None} or None if it breaks any rule."""
    if not isinstance(data, dict):
        return None
    message = data.get('message')
    if not isinstance(message, str):
        return None
    message = message.strip()
    if not message or len(message) > MAX_MESSAGE:
        return None
    nudge = data.get('nudge')
    if nudge is not None:
        if not isinstance(nudge, str):
            return None
        nudge = nudge.strip() or None
        if nudge and len(nudge) > MAX_NUDGE:
            return None
    if _violates(message) or (nudge and _violates(nudge)):
        return None
    return {'message': message, 'nudge': nudge}


def check_lead_in(data):
    """A short warm sentence placed before a reviewed question. It may not ask anything itself."""
    if not isinstance(data, dict):
        return None
    lead = data.get('lead_in')
    if not isinstance(lead, str):
        return None
    lead = lead.strip()
    if not lead or len(lead) > MAX_LEAD_IN or '\n' in lead or '?' in lead or _violates(lead):
        return None
    return lead


def check_risk(data):
    """True / False from the AI risk check, or None if the answer is not a real boolean."""
    if isinstance(data, dict) and isinstance(data.get('risk'), bool):
        return data['risk']
    return None
