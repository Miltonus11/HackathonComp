"""Referral orchestration: build candidates, rank them, record suggestions, track what the user does."""
from core.models import Consent
from screening.models import Assessment

from . import matching
from .models import Referral, Service

_ORDER = {Referral.Status.SUGGESTED: 0, Referral.Status.VIEWED: 1, Referral.Status.CONTACT_INITIATED: 2}


class ReferralError(Exception):
    def __init__(self, code, message=''):
        super().__init__(message or code)
        self.code = code
        self.message = message or code


def _candidates():
    services = Service.objects.filter(is_active=True).prefetch_related('languages', 'sectors')
    return {
        s.id: (s, matching.Candidate(
            id=s.id, name=s.name, barangay_id=s.barangay_id,
            languages=frozenset(l.language_code for l in s.languages.all()),
            sectors=frozenset(x.sector for x in s.sectors.all()),
            cost_type=s.cost_type, accepts_walk_in=s.accepts_walk_in,
            min_severity=s.min_severity, is_crisis_service=s.is_crisis_service))
        for s in services
    }


def suggest(user, session):
    """Rank services for a completed session and record them as SUGGESTED (idempotent).

    Returns a list of (Referral, reasons), best first.
    """
    if session.completed_at is None:
        raise ReferralError('session_incomplete', 'Finish the screening before asking for referrals.')

    codes = Assessment.objects.filter(session=session).values_list('severity_code', flat=True)
    tier = matching.tier_for(codes)
    profile = user.profile
    by_id = _candidates()
    ranked = matching.rank([c for _, c in by_id.values()], tier, profile.barangay_id,
                           profile.language_code, profile.sector)

    out = []
    for r in ranked:
        referral, _ = Referral.objects.get_or_create(
            user=user, service_id=r.candidate.id, session=session, defaults={'severity_context': tier})
        referral.service = by_id[r.candidate.id][0]
        out.append((referral, r.reasons))
    return out


def _transition_allowed(current, new):
    if current == new:
        return True
    if new == Referral.Status.SUGGESTED:
        return False
    if new == Referral.Status.DISMISSED:
        return current != Referral.Status.CONTACT_INITIATED
    if current == Referral.Status.DISMISSED:
        return True  # the user changed their mind
    return _ORDER[new] > _ORDER[current]


def update_referral(user, referral, status=None, shared_with_professional=None):
    if status is not None and not _transition_allowed(referral.status, status):
        raise ReferralError('invalid_transition', f'Cannot change {referral.status} to {status}.')
    if shared_with_professional and not Consent.has_active(user, Consent.ConsentType.PROFESSIONAL_SHARING):
        raise ReferralError('consent_required', 'Consent to share with a professional is required.')

    if status is not None:
        referral.status = status
    if shared_with_professional is not None:
        referral.shared_with_professional = shared_with_professional
    referral.save()
    return referral
