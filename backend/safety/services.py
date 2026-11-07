from .models import Escalation, RiskFlag


def raise_flag(user, source, level, ref_type=None, ref_id=None):
    """Create a risk flag and queue it for a human. No user text is ever copied; only a pointer is stored.

    Callers run this inside the same transaction as the record that triggered it.
    """
    flag = RiskFlag.objects.create(user=user, source=source, level=level, source_ref_type=ref_type,
                                   source_ref_id=ref_id)
    Escalation.objects.create(flag=flag, user_contactable=user.contact_for_followup)
    return flag
