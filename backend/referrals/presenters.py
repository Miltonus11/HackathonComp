def service(s):
    return {
        'id': s.id,
        'name': s.name,
        'service_type': s.service_type,
        'barangay_name': s.barangay.name if s.barangay_id else None,
        'address': s.address,
        'phone': s.phone,
        'email': s.email,
        'schedule_text': s.schedule_text,
        'cost_type': s.cost_type,
        'accepts_walk_in': s.accepts_walk_in,
        'is_crisis_service': s.is_crisis_service,
        'languages': sorted(l.language_code for l in s.languages.all()),
        'sectors': sorted(x.sector for x in s.sectors.all()),
        'verified': s.last_verified_at is not None,
        'last_verified_at': s.last_verified_at,
    }


def referral(r, reasons=None):
    return {
        'referral_id': str(r.id),
        'session_id': str(r.session_id) if r.session_id else None,
        'status': r.status,
        'shared_with_professional': r.shared_with_professional,
        'reasons': reasons or [],
        'created_at': r.created_at,
        'service': service(r.service),
    }
