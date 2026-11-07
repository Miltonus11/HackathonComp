"""Journal orchestration: pick a prompt, save an entry (encrypt, scan, flag), then optionally ask the AI.

Order of events for an entry, and why:
  1. Save + keyword crisis scan + flag, in ONE database transaction. Nothing the user wrote is ever lost.
  2. Only after that commits, and only with AI_ANALYSIS consent, call the AI (never inside a transaction,
     so a slow API call cannot hold database locks).
  3. AI risk check first; the encouraging reply is generated only if it says the writer is not at risk.
"""
import logging
from dataclasses import dataclass
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from core.models import Consent
from safety import crisis_terms
from safety.models import RiskFlag
from safety.services import raise_flag
from screening import services as screening
from screening.models import Assessment, AssessmentResponse

from . import ai, ai_client, prompting, trends
from .clock import today_ph
from .models import JournalEntry, JournalPrompt, MoodEntry

logger = logging.getLogger(__name__)

PHQ9_FRESH_DAYS = 60
RECENT_ENTRIES_CONSIDERED = 14
REWORDED_PROMPT_TTL = 24 * 3600
AI_FAILURE_PAUSE = 60  # after a failed wording attempt, don't make the screen wait again for a minute


@dataclass
class Saved:
    entry: JournalEntry
    ai_status: str  # crisis | no_consent | pending (eligible for AI) -> ok | unavailable once the AI step has run
    crisis: dict | None
    reflection: dict | None = None


def _language(user):
    profile = getattr(user, 'profile', None)
    return profile.language_code if profile else 'en'


def _ai_allowed(user):
    return Consent.has_active(user, Consent.ConsentType.AI_ANALYSIS)


def _fresh_phq9_responses(user):
    cutoff = timezone.now() - timedelta(days=PHQ9_FRESH_DAYS)
    latest = (Assessment.objects.filter(user=user, instrument__code='PHQ9', taken_at__gte=cutoff)
              .order_by('-taken_at').first())
    if not latest:
        return {}
    return dict(AssessmentResponse.objects.filter(assessment=latest).values_list('item_no', 'response_value'))


def mood_context(user):
    """Today's mood and how it compares with the user's own recent baseline, or None if not logged.

    The baseline excludes today, so today's entry is not compared with itself.
    """
    today = today_ph()
    entry = MoodEntry.objects.filter(user=user, entry_date=today).first()
    if entry is None:
        return None
    prior = MoodEntry.objects.filter(
        user=user, entry_date__gte=today - timedelta(days=trends.BASELINE_WINDOW_DAYS), entry_date__lt=today,
    ).values_list('mood_score', flat=True)
    base = trends.baseline(prior)
    return {
        'score': entry.mood_score,
        'reason': entry.reason_code,
        'trend': trends.trend_label(entry.mood_score, base),
        'band': prompting.mood_band(entry.mood_score, base),
    }


# ------------------------------------------------------------------------------------------------ prompt

def current_prompt(user):
    """Today's prompt: chosen by rules from the reviewed bank, optionally with a warmer AI lead-in."""
    recent = list(JournalEntry.objects.filter(user=user, prompt__isnull=False)
                  .order_by('-written_at').values_list('prompt_id', 'prompt__domain_code')[:RECENT_ENTRIES_CONSIDERED])
    mood = mood_context(user)
    ranked = prompting.rank_domains(
        [domain for _, domain in recent],
        mood['reason'] if mood else None,
        prompting.top_phq9_domain(_fresh_phq9_responses(user)),
    )

    bank = JournalPrompt.objects.filter(review_status=JournalPrompt.ReviewStatus.PUBLISHED, is_active=True)
    lang = _language(user)
    for domain in ranked:
        candidates = list(bank.filter(domain_code=domain, language_code=lang))
        if not candidates and lang != 'en':
            candidates = list(bank.filter(domain_code=domain, language_code='en'))
        chosen = prompting.choose_prompt(
            [(p.id, p.rotation_weight, p.tone) for p in candidates], [pid for pid, _ in recent],
            preferred_tone=prompting.preferred_tone(mood['band'] if mood else None))
        if chosen is not None:
            p = next(c for c in candidates if c.id == chosen)
            result = {'prompt_id': p.id, 'domain': p.domain_code, 'text': p.prompt_text, 'source': 'bank'}
            return _personalize(user, result, mood)
    return {'prompt_id': None, 'domain': None, 'text': None, 'source': 'none'}


def _personalize(user, result, mood):
    """Put a short warm AI sentence before the reviewed question. The question itself is never changed."""
    if not ai_client.enabled() or not _ai_allowed(user):
        return result
    key = (f"journal-lead:{user.user_id}:{today_ph()}:{result['prompt_id']}:"
           f"{mood['band'] if mood else '-'}:{mood['trend'] if mood else '-'}")
    lead = cache.get(key)
    if lead is None:  # not tried yet (a cached '' means "tried and failed recently")
        try:
            lead = ai.reword_prompt(result['text'], _language(user), mood)
            cache.set(key, lead, REWORDED_PROMPT_TTL)
        except Exception as exc:  # whatever went wrong, the reviewed prompt is a complete answer
            logger.warning('Prompt wording skipped: %s', type(exc).__name__)
            lead = ''
            cache.set(key, '', AI_FAILURE_PAUSE)
    if not lead:
        return result
    return {**result, 'text': f"{lead} {result['text']}", 'source': 'personalized'}


# ------------------------------------------------------------------------------------------------- entry

@transaction.atomic
def save_entry(user, text, prompt=None):
    """Encrypt and save, run the keyword crisis scan (always, whatever the consent), flag it, all together."""
    scan = crisis_terms.scan(text)
    entry = JournalEntry(user=user, prompt=prompt, risk_scanned_at=timezone.now())
    entry.set_text(text)
    entry.save()

    if scan.flagged:
        raise_flag(user, RiskFlag.Source.JOURNAL_KEYWORD, RiskFlag.Level.CRISIS,
                   ref_type=RiskFlag.RefType.JOURNAL_ENTRY, ref_id=entry.id)
        return Saved(entry, 'crisis', screening.crisis_payload(user))
    if _ai_allowed(user):
        return Saved(entry, 'pending', None)
    return Saved(entry, 'no_consent', None)


def complete_with_ai(user, saved, text):
    """Run the AI risk check and, if clear, the encouraging reply. Never raises for an AI problem."""
    if saved.ai_status != 'pending':
        return saved
    if not ai_client.enabled():
        saved.ai_status = 'unavailable'
        return saved

    entry = saved.entry
    entry.ai_analyzed = True  # recorded before the call: from here on the text may have left the system
    entry.save(update_fields=['ai_analyzed'])

    try:
        at_risk = ai.classify_risk(text)
    except Exception as exc:  # no answer means no reply: we cannot tell the entry is safe
        logger.warning('AI risk check unavailable: %s', type(exc).__name__)
        saved.ai_status = 'unavailable'
        return saved
    if at_risk:
        _record_ai_crisis(user, entry)
        saved.ai_status = 'crisis'
        saved.crisis = screening.crisis_payload(user)
        return saved

    try:
        reflection = ai.make_reflection(
            text, entry.prompt.prompt_text if entry.prompt_id else None, _language(user), mood_context(user))
    except Exception as exc:
        logger.warning('AI reflection unavailable: %s', type(exc).__name__)
        saved.ai_status = 'unavailable'
        return saved

    entry.set_reflection(reflection)
    entry.save(update_fields=['ai_reflection'])
    saved.reflection = reflection
    saved.ai_status = 'ok'
    return saved


def _record_ai_crisis(user, entry):
    """If recording fails, the user must still see the crisis screen, so the failure is logged, not raised."""
    try:
        with transaction.atomic():
            raise_flag(user, RiskFlag.Source.JOURNAL_CLASSIFIER, RiskFlag.Level.CRISIS,
                       ref_type=RiskFlag.RefType.JOURNAL_ENTRY, ref_id=entry.id)
    except Exception as exc:
        logger.error('Could not record an AI-detected crisis flag: %s', type(exc).__name__)
