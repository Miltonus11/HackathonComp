"""Shapes service objects into API payloads. No business logic here."""
from . import content, flow, services
from .models import Assessment, SeverityBand


def form(user, code):
    inst, items = services.instrument_form(user, code)
    return {
        'instrument': inst.code,
        'name': inst.name,
        'recall_period_days': inst.recall_period_days,
        'min_response': inst.min_response,
        'max_response': inst.max_response,
        'options': content.OPTIONS[inst.code],
        'items': [{'item_no': i.item_no, 'text': i.item_text} for i in items],
    }


def next_form(user, code):
    return form(user, code) if code else None


def result(user, assessment):
    code = assessment.instrument.code
    band = SeverityBand.objects.filter(instrument=assessment.instrument, severity_code=assessment.severity_code).first()
    advice = services.advice_for(user, code, assessment.severity_code)
    return {
        'instrument': code,
        'raw_score': assessment.raw_score,
        'scaled_score': str(assessment.scaled_score) if assessment.scaled_score is not None else None,
        'severity_code': assessment.severity_code,
        'label': band.label if band else assessment.severity_code,
        'advice': {
            'headline': advice.headline,
            'message': advice.message_body,
            'suggested_action': advice.suggested_action,
        } if advice else None,
    }


def session_detail(user, session):
    assessments = list(Assessment.objects.filter(session=session).select_related('instrument').order_by('taken_at'))
    done = {a.instrument.code: a.scaled_score for a in assessments}
    completed = session.completed_at is not None
    return {
        'session_id': str(session.id),
        'started_at': session.started_at,
        'completed_at': session.completed_at,
        'completed': completed,
        'crisis_shown': session.crisis_shown,
        'crisis': services.crisis_payload(user) if session.crisis_shown else None,
        'results': [result(user, a) for a in assessments],
        'next': None if completed else next_form(user, flow.next_instrument(done)),
    }


def session_summary(session):
    return {
        'session_id': str(session.id),
        'started_at': session.started_at,
        'completed_at': session.completed_at,
        'crisis_shown': session.crisis_shown,
        'results': [{'instrument': a.instrument.code, 'severity_code': a.severity_code}
                    for a in session.assessments.select_related('instrument').order_by('taken_at')],
    }
