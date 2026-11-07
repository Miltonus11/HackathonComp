"""Pre-assessment orchestration. Rule-based; the only place severity and risk flags are written."""
from dataclasses import dataclass, field

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import Consent, UserProfile
from safety.models import Escalation, RiskFlag

from . import flow, scoring
from .models import (AdviceContent, Assessment, AssessmentResponse, AssessmentSession, Instrument,
                     InstrumentItem, SeverityBand)

# Used only if no published CRISIS advice row exists: the crisis screen must never come up empty.
FALLBACK_CRISIS = {
    'headline': 'You are not alone, and help is available',
    'message': 'If you are in danger or thinking about hurting yourself, please call one of the numbers below '
               'or go to the nearest emergency room. You can also tap "Talk to a person".',
}

_LEVEL_RANK = {RiskFlag.Level.MODERATE: 0, RiskFlag.Level.HIGH: 1, RiskFlag.Level.CRISIS: 2}


class FlowError(Exception):
    def __init__(self, code, message=''):
        super().__init__(message or code)
        self.code = code
        self.message = message or code


@dataclass
class StartResult:
    session: AssessmentSession
    next_instrument: str | None


@dataclass
class StepResult:
    session: AssessmentSession
    assessment: Assessment
    score: scoring.ScoreResult
    flags: list = field(default_factory=list)
    crisis: bool = False
    next_instrument: str | None = None
    completed: bool = False
    choice_pending: bool = False  # the person must decide whether to take the full PHQ-9


@dataclass
class ChoiceResult:
    session: AssessmentSession
    next_instrument: str | None
    completed: bool


def _language(user):
    profile = getattr(user, 'profile', None)
    return profile.language_code if profile else 'en'


def _done_map(session):
    return {a.instrument.code: a.scaled_score for a in session.assessments.select_related('instrument')}


def start_session(user, session_type=AssessmentSession.SessionType.FULL,
                  trigger_source=AssessmentSession.TriggerSource.INITIAL):
    if not Consent.has_active(user, Consent.ConsentType.APP_USE):
        raise FlowError('consent_required', 'Consent to use the app is required before screening.')
    if not UserProfile.objects.filter(user=user).exists():
        raise FlowError('profile_required', 'Complete registration before screening.')
    if session_type != AssessmentSession.SessionType.FULL:
        raise FlowError('unsupported_session_type', 'Only FULL sessions are available right now.')
    session = AssessmentSession.objects.create(user=user, session_type=session_type, trigger_source=trigger_source)
    return StartResult(session=session, next_instrument=flow.next_instrument({}))


def instrument_form(user, code):
    """Items (user's language, falling back to English) for the instrument form."""
    inst = Instrument.objects.get(code=code, is_active=True)
    lang = _language(user)
    items = InstrumentItem.objects.filter(instrument=inst, language_code=lang)
    if not items.exists():
        items = InstrumentItem.objects.filter(instrument=inst, language_code='en')
    return inst, list(items.order_by('item_no'))


@transaction.atomic
def submit_instrument(session, code, responses):
    session = AssessmentSession.objects.select_for_update().get(pk=session.pk)
    if session.completed_at:
        raise FlowError('session_complete', 'This screening is already complete.')

    done = _done_map(session)
    accepted = session.phq9_accepted
    expected = flow.next_instrument(done, accepted)
    if code != expected:
        if flow.pending_choice(done, accepted):
            raise FlowError('choice_required', 'Choose whether to continue before answering more questions.')
        raise FlowError('wrong_instrument', f'Expected {expected}, got {code}.')

    inst = Instrument.objects.get(code=code, is_active=True)
    try:
        scoring.validate_responses(responses, inst.item_count, inst.min_response, inst.max_response)
    except ValueError as exc:
        raise FlowError('invalid_responses', str(exc)) from exc

    bands = list(SeverityBand.objects.filter(instrument=inst))
    critical = set(InstrumentItem.objects.filter(instrument=inst, is_critical=True)
                   .values_list('item_no', flat=True))
    result = scoring.score_instrument(code, responses, bands, critical_items=critical)

    assessment = Assessment.objects.create(
        session=session, user=session.user, instrument=inst, raw_score=result.raw_score,
        scaled_score=result.scaled_score, severity_code=result.severity_code,
        critical_item_positive=result.critical_item_positive, scoring_version=inst.scoring_version,
    )
    AssessmentResponse.objects.bulk_create(
        [AssessmentResponse(assessment=assessment, item_no=n, response_value=v) for n, v in responses.items()]
    )

    flags = _raise_flags(session.user, code, assessment, result)

    done[code] = result.scaled_score
    next_code = flow.next_instrument(done, accepted)
    pending = flow.pending_choice(done, accepted)
    finished = next_code is None and not pending
    update = []
    if flags:
        session.crisis_shown = True
        update.append('crisis_shown')
    if finished:
        _mark_completed(session, update)
    if update:
        session.save(update_fields=update)

    return StepResult(session=session, assessment=assessment, score=result, flags=flags,
                      crisis=bool(flags), next_instrument=next_code, completed=finished,
                      choice_pending=pending)


def _mark_completed(session, update):
    """Stamp completion on the session and mark the person's onboarding done. The caller saves the update list."""
    session.completed_at = timezone.now()
    update.append('completed_at')
    UserProfile.objects.filter(user=session.user, onboarding_completed_at__isnull=True).update(
        onboarding_completed_at=session.completed_at)


@transaction.atomic
def answer_phq9_choice(session, accept):
    """Record whether a not-good-WHO-5 person wants the full PHQ-9.

    Accepting makes PHQ9 the next instrument. Declining ends the session now: no PHQ-9 questions
    and no separate item 9 check are asked, and the results are just WHO-5 and GAD-7.
    """
    session = AssessmentSession.objects.select_for_update().get(pk=session.pk)
    if session.completed_at:
        raise FlowError('session_complete', 'This screening is already complete.')
    done = _done_map(session)
    if not flow.pending_choice(done, session.phq9_accepted):
        raise FlowError('no_choice_pending', 'There is no choice to make right now.')

    session.phq9_accepted = bool(accept)
    update = ['phq9_accepted']
    next_code = flow.next_instrument(done, session.phq9_accepted)
    if next_code is None:
        _mark_completed(session, update)
    session.save(update_fields=update)
    return ChoiceResult(session=session, next_instrument=next_code, completed=next_code is None)


def _raise_flags(user, code, assessment, result):
    flags = []

    def add(source, level):
        flags.append(RiskFlag.objects.create(
            user=user, source=source, level=level, source_ref_type=RiskFlag.RefType.ASSESSMENT,
            source_ref_id=assessment.id))

    if result.critical_item_positive:  # PHQ-9 item 9 > 0, whatever the total
        add(RiskFlag.Source.PHQ9_ITEM9, RiskFlag.Level.CRISIS)
    if result.band_triggers_crisis:
        add(RiskFlag.Source.WHO5_LOW if code == 'WHO5' else RiskFlag.Source.SEVERE_SCORE, RiskFlag.Level.HIGH)

    if flags:  # one queue item per submission, on the most serious flag
        top = max(flags, key=lambda f: _LEVEL_RANK[f.level])
        Escalation.objects.create(flag=top, user_contactable=user.contact_for_followup)
    return flags


def advice_for(user, code, severity_code):
    lang = _language(user)
    qs = AdviceContent.objects.filter(
        instrument__code=code, severity_code=severity_code, is_active=True,
        review_status=AdviceContent.ReviewStatus.PUBLISHED,
    ).order_by('-version')
    return qs.filter(language_code=lang).first() or qs.filter(language_code='en').first()


def crisis_payload(user):
    qs = AdviceContent.objects.filter(
        instrument__isnull=True, severity_code='CRISIS', is_active=True,
        review_status=AdviceContent.ReviewStatus.PUBLISHED,
    ).order_by('-version')
    row = qs.filter(language_code=_language(user)).first() or qs.filter(language_code='en').first()
    return {
        'headline': row.headline if row else FALLBACK_CRISIS['headline'],
        'message': row.message_body if row else FALLBACK_CRISIS['message'],
        'hotlines': _hotlines(),
        'talk_to_a_person': True,
    }


def _hotlines():
    """Crisis contacts from the referral directory; settings.CRISIS_HOTLINES if the directory has none."""
    from referrals.models import Service
    rows = Service.objects.filter(is_crisis_service=True, is_active=True).exclude(phone='').order_by('name')
    found = [{'name': s.name, 'number': s.phone, 'note': s.schedule_text} for s in rows]
    return found or list(settings.CRISIS_HOTLINES)
