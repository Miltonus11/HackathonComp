import uuid

from rest_framework.test import APITestCase

from core.models import Barangay, Consent
from referrals.models import Referral, Service, ServiceLanguage, ServiceSector
from screening import services as screening
from screening.tests.helpers import (GAD7_MINIMAL, ITEM9_NEGATIVE, PHQ9_SEVERE, WHO5_GOOD, WHO5_POOR, make_user,
                                     seed)

SUGGEST = '/api/referrals/suggest/'
PHQ9_MODERATE = {1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 0}  # total 10


def make_service(name='Clinic', languages=(), sectors=(), **kw):
    fields = dict(service_type='CITY_HEALTH_OFFICE', cost_type='FREE', min_severity='LOW')
    fields.update(kw)
    s = Service.objects.create(name=name, **fields)
    for lang in languages:
        ServiceLanguage.objects.create(service=s, language_code=lang)
    for sector in sectors:
        ServiceSector.objects.create(service=s, sector=sector)
    return s


def complete_session(user, path):
    """path: 'LOW' | 'MODERATE' | 'HIGH'. Returns the completed session."""
    s = screening.start_session(user).session
    if path == 'LOW':
        screening.submit_instrument(s, 'WHO5', WHO5_GOOD)
        screening.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        screening.submit_instrument(s, 'PHQ9_ITEM9', ITEM9_NEGATIVE)
    else:
        screening.submit_instrument(s, 'WHO5', WHO5_POOR)
        screening.submit_instrument(s, 'GAD7', GAD7_MINIMAL)
        screening.submit_instrument(s, 'PHQ9', PHQ9_MODERATE if path == 'MODERATE' else PHQ9_SEVERE)
    s.refresh_from_db()
    return s


class ReferralApiBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        seed()
        cls.user = make_user()

    def setUp(self):
        self.client.force_authenticate(self.user)

    def suggest(self, session):
        return self.client.post(SUGGEST, {'session_id': str(session.id)}, format='json')


class SuggestTests(ReferralApiBase):
    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(SUGGEST, {}).status_code, 401)

    def test_returns_ranked_services_with_reasons_and_records_referrals(self):
        brgy = self.user.profile.barangay
        make_service('Far Clinic')
        make_service('Local Clinic', barangay=brgy, languages=['en'])
        res = self.suggest(complete_session(self.user, 'MODERATE'))
        self.assertEqual(res.status_code, 200, res.data)
        names = [r['service']['name'] for r in res.data['referrals']]
        self.assertEqual(names, ['Local Clinic', 'Far Clinic'])
        self.assertTrue(res.data['referrals'][0]['reasons'])
        self.assertEqual({r['status'] for r in res.data['referrals']}, {'SUGGESTED'})
        self.assertEqual(Referral.objects.filter(user=self.user).count(), 2)

    def test_is_idempotent(self):
        make_service('Clinic')
        session = complete_session(self.user, 'MODERATE')
        first = self.suggest(session).data['referrals'][0]['referral_id']
        second = self.suggest(session).data['referrals'][0]['referral_id']
        self.assertEqual(first, second)
        self.assertEqual(Referral.objects.count(), 1)

    def test_capped_at_ten(self):
        for i in range(12):
            make_service(f'Clinic {i:02d}')
        res = self.suggest(complete_session(self.user, 'MODERATE'))
        self.assertEqual(len(res.data['referrals']), 10)

    def test_tier_filters_services_and_records_severity_context(self):
        make_service('Basic')
        make_service('Specialist', min_severity='HIGH')
        low = self.suggest(complete_session(self.user, 'LOW'))
        self.assertEqual([r['service']['name'] for r in low.data['referrals']], ['Basic'])
        high = self.suggest(complete_session(self.user, 'HIGH'))
        self.assertEqual({r['service']['name'] for r in high.data['referrals']}, {'Basic', 'Specialist'})
        self.assertEqual(Referral.objects.filter(service__name='Specialist').get().severity_context, 'HIGH')

    def test_crisis_service_listed_first_at_high_tier(self):
        make_service('Clinic', cost_type='FREE')
        make_service('Hotline', service_type='HOTLINE', is_crisis_service=True)
        res = self.suggest(complete_session(self.user, 'HIGH'))
        self.assertEqual(res.data['referrals'][0]['service']['name'], 'Hotline')

    def test_inactive_services_excluded(self):
        make_service('Gone', is_active=False)
        res = self.suggest(complete_session(self.user, 'MODERATE'))
        self.assertEqual(res.data['referrals'], [])

    def test_incomplete_session_is_400(self):
        session = screening.start_session(self.user).session
        res = self.suggest(session)
        self.assertEqual((res.status_code, res.data['code']), (400, 'session_incomplete'))

    def test_other_users_session_is_404(self):
        session = complete_session(self.user, 'MODERATE')
        self.client.force_authenticate(make_user('+639171230020'))
        self.assertEqual(self.suggest(session).status_code, 404)

    def test_bad_session_id_is_400_or_404(self):
        self.assertEqual(self.client.post(SUGGEST, {}).status_code, 400)
        self.assertEqual(self.client.post(SUGGEST, {'session_id': str(uuid.uuid4())}, format='json').status_code, 404)

    def test_unverified_flag_is_exposed(self):
        make_service('Unverified')
        make_service('Verified', last_verified_at='2026-01-01')
        res = self.suggest(complete_session(self.user, 'MODERATE'))
        flags = {r['service']['name']: r['service']['verified'] for r in res.data['referrals']}
        self.assertEqual(flags, {'Unverified': False, 'Verified': True})


class DirectoryTests(ReferralApiBase):
    def names(self, query=''):
        res = self.client.get('/api/services/' + query)
        self.assertEqual(res.status_code, 200)
        return sorted(s['name'] for s in res.data)

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/services/').status_code, 401)

    def test_lists_active_only(self):
        make_service('A')
        make_service('B', is_active=False)
        self.assertEqual(self.names(), ['A'])

    def test_filters(self):
        here = Barangay.objects.get(name='Poro')
        other = Barangay.objects.create(name='Elsewhere')
        make_service('Local', barangay=here, service_type='BARANGAY_HEALTH_CENTER')
        make_service('Remote', barangay=other)
        make_service('CityWide', languages=['fil'], sectors=['STUDENT'], cost_type='PAID')
        make_service('Hotline', service_type='HOTLINE', is_crisis_service=True)
        self.assertEqual(self.names(f'?barangay={here.id}'), ['CityWide', 'Hotline', 'Local'])  # + city-wide
        self.assertEqual(self.names('?service_type=BARANGAY_HEALTH_CENTER'), ['Local'])
        self.assertEqual(self.names('?language=fil'), ['CityWide'])
        self.assertEqual(self.names('?sector=STUDENT'), ['CityWide', 'Hotline', 'Local', 'Remote'])  # no restriction
        self.assertEqual(self.names('?sector=EMPLOYEE'), ['Hotline', 'Local', 'Remote'])
        self.assertEqual(self.names('?cost_type=PAID'), ['CityWide'])
        self.assertEqual(self.names('?crisis=true'), ['Hotline'])

    def test_payload_shape(self):
        make_service('Full', languages=['en', 'fil'], sectors=['STUDENT'], phone='123', accepts_walk_in=True)
        s = self.client.get('/api/services/').data[0]
        self.assertEqual(sorted(s['languages']), ['en', 'fil'])
        self.assertEqual(s['sectors'], ['STUDENT'])
        for key in ('id', 'name', 'service_type', 'barangay_name', 'address', 'phone', 'email', 'schedule_text',
                    'cost_type', 'accepts_walk_in', 'is_crisis_service', 'verified'):
            self.assertIn(key, s)


class ReferralUpdateTests(ReferralApiBase):
    def setUp(self):
        super().setUp()
        make_service('Clinic')
        res = self.suggest(complete_session(self.user, 'MODERATE'))
        self.rid = res.data['referrals'][0]['referral_id']
        self.url = f'/api/referrals/{self.rid}/'

    def patch(self, **data):
        return self.client.patch(self.url, data, format='json')

    def test_list_shows_own_referrals_only(self):
        self.assertEqual(len(self.client.get('/api/referrals/').data), 1)
        self.client.force_authenticate(make_user('+639171230021'))
        self.assertEqual(self.client.get('/api/referrals/').data, [])

    def test_forward_transitions(self):
        self.assertEqual(self.patch(status='VIEWED').data['status'], 'VIEWED')
        self.assertEqual(self.patch(status='CONTACT_INITIATED').data['status'], 'CONTACT_INITIATED')

    def test_cannot_go_backwards_after_contact(self):
        self.patch(status='CONTACT_INITIATED')
        for bad in ('VIEWED', 'SUGGESTED', 'DISMISSED'):
            res = self.patch(status=bad)
            self.assertEqual((res.status_code, res.data['code']), (400, 'invalid_transition'), bad)

    def test_dismiss_then_change_of_mind(self):
        self.assertEqual(self.patch(status='DISMISSED').status_code, 200)
        self.assertEqual(self.patch(status='VIEWED').status_code, 200)

    def test_repeating_same_status_is_fine(self):
        self.patch(status='VIEWED')
        self.assertEqual(self.patch(status='VIEWED').status_code, 200)

    def test_invalid_status_value_rejected(self):
        self.assertEqual(self.patch(status='BOGUS').status_code, 400)

    def test_sharing_requires_professional_sharing_consent(self):
        res = self.patch(shared_with_professional=True)
        self.assertEqual((res.status_code, res.data['code']), (403, 'consent_required'))
        self.assertFalse(Referral.objects.get().shared_with_professional)

    def test_sharing_allowed_with_consent_and_blocked_after_withdrawal(self):
        kw = dict(user=self.user, consent_type='PROFESSIONAL_SHARING', notice_version='v1', language_code='en')
        Consent.objects.create(granted=True, **kw)
        self.assertTrue(self.patch(shared_with_professional=True).data['shared_with_professional'])
        Consent.objects.create(granted=False, **kw)
        self.assertEqual(self.patch(shared_with_professional=True).status_code, 403)

    def test_other_users_referral_is_404(self):
        self.client.force_authenticate(make_user('+639171230022'))
        self.assertEqual(self.patch(status='VIEWED').status_code, 404)

    def test_other_fields_cannot_be_changed(self):
        other = make_service('Other')
        self.patch(service=other.id, user='nope')
        self.assertEqual(Referral.objects.get().service.name, 'Clinic')
