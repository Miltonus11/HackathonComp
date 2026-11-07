"""Keyword layer of crisis detection for free text (layer 1 of 3; the classifier arrives with the AI step).

Matching is deliberately broad: a missed crisis costs far more than an unnecessary prompt, so negated
statements ("I don't want to die") still match. Text is lowercased, accents and punctuation are removed,
and matches must start and end on word boundaries ("skill myself" does not match "kill myself").

Terms are written in normalized form (lowercase, no apostrophes). A trailing '*' means "any word ending".
Only the matched TERMS are returned, never the user's text.

[VERIFY] Filipino/Taglish and especially Ilocano lists with native speakers and a clinician before launch.
Add new terms here; no other code needs to change.
"""
import re
import unicodedata
from dataclasses import dataclass

ENGLISH = [
    'kill myself', 'killing myself', 'kill my self', 'end my life', 'ending my life', 'end it all',
    'take my own life', 'taking my own life', 'want to die', 'wanna die', 'wish i was dead', 'wish i were dead',
    'better off dead', 'better off without me', 'dont want to live', 'do not want to live',
    'dont want to be alive', 'no reason to live', 'not worth living', 'hurt myself', 'hurting myself',
    'harm myself', 'harming myself', 'cut myself', 'cutting myself', 'suicid*', 'overdose on',
]

FILIPINO_TAGLISH = [
    'magpakamatay', 'magpapakamatay', 'pagpapakamatay',
    'gusto kong mamatay', 'gusto ko nang mamatay', 'gusto ko ng mamatay', 'gusto ko na mamatay',
    'gusto ko nang mawala', 'ayoko nang mabuhay', 'ayoko ng mabuhay', 'ayoko na mabuhay',
    'ayaw ko nang mabuhay', 'ayaw ko ng mabuhay', 'ayaw ko na mabuhay',
    'wala nang saysay ang buhay', 'wala nang kwenta ang buhay',
    'mas mabuti pang mamatay', 'mas mabuti pang mawala na lang ako', 'mas mabuti kung mawala na lang ako',
    'sasaktan ko ang sarili ko', 'sasaktan ko sarili ko', 'wakasan ang buhay ko', 'tapusin ang buhay ko',
    'tapusin ko na ang buhay ko', 'tapusin ko na lahat', 'mamatay na lang ako', 'mamatay na ako',
    'patayin ko ang sarili ko', 'magbigti', 'magbibigti',
]

ILOCANO = [  # [VERIFY] with a native speaker
    'kayat ko ti matay', 'kayatko ti matay', 'kayat ko nga matay', 'diak kayat ti agbiag',
    'dikon kayat nga agbiag', 'agpakamatay', 'agpatayak', 'patayek ti bagik', 'patayek ti bagi ko',
]


def normalize(text):
    text = unicodedata.normalize('NFKD', (text or '').lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"['‘’`´]", '', text)
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def _compile(term):
    term = normalize(term.rstrip('*')) + ('*' if term.endswith('*') else '')
    body = re.escape(term.rstrip('*'))
    tail = r'[a-z0-9]*' if term.endswith('*') else r'(?![a-z0-9])'
    return re.compile(r'(?<![a-z0-9])' + body + tail)


ALL_TERMS = ENGLISH + FILIPINO_TAGLISH + ILOCANO
_PATTERNS = [(t, _compile(t)) for t in ALL_TERMS]


@dataclass(frozen=True)
class ScanResult:
    flagged: bool
    matched: tuple


def scan(text):
    normalized = normalize(text)
    matched = tuple(t for t, pattern in _PATTERNS if pattern.search(normalized))
    return ScanResult(flagged=bool(matched), matched=matched)
