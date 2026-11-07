from rest_framework.test import APITestCase

from accounts.models import User
from core.models import Barangay, Consent, UserProfile


def authed(test, mobile='+639171234567'):
    user = User.objects.create_user(mobile, 'S3cure-pass-123')
    test.client.force_authenticate(user)
    return user


class BarangayTests(APITestCase):
    def test_requires_auth(self):
        self.assertEqual(self.client.get('/api/barangays/').status_code, 401)

    def test_lists_barangays_without_psgc_noise(self):
        authed(self)
        Barangay.objects.create(name='Poro')
        res = self.client.get('/api/barangays/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([b['name'] for b in res.data], ['Poro'])


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = authed(self)
        self.brgy = Barangay.objects.create(name='Poro')
        self.payload = {'birth_year': 2001, 'sex': 'FEMALE', 'sector': 'STUDENT', 'barangay': self.brgy.id}

    def test_get_before_create_is_404(self):
        self.assertEqual(self.client.get('/api/profile/').status_code, 404)

    def test_create_then_get(self):
        res = self.client.post('/api/profile/', self.payload)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(UserProfile.objects.get().user_id, self.user.user_id)
        got = self.client.get('/api/profile/').data
        self.assertEqual(got['barangay_name'], 'Poro')
        self.assertIn('age_band', got)
        self.assertEqual(got['language_code'], 'en')

    def test_duplicate_create_rejected(self):
        self.client.post('/api/profile/', self.payload)
        self.assertEqual(self.client.post('/api/profile/', self.payload).status_code, 400)

    def test_invalid_values_rejected(self):
        for bad in ({'birth_year': 1850}, {'birth_year': 2999}, {'sex': 'X'}, {'sector': 'ALIEN'}, {'barangay': 9999}):
            res = self.client.post('/api/profile/', {**self.payload, **bad})
            self.assertEqual(res.status_code, 400, bad)

    def test_patch_updates_but_cannot_change_owner(self):
        self.client.post('/api/profile/', self.payload)
        res = self.client.patch('/api/profile/', {'sector': 'EMPLOYEE', 'user': 'ignored'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(UserProfile.objects.get().sector, 'EMPLOYEE')


class ConsentTests(APITestCase):
    def setUp(self):
        self.user = authed(self)
        self.base = {'notice_version': 'v1', 'language_code': 'en'}

    def test_initial_state_all_false(self):
        res = self.client.get('/api/consents/')
        self.assertEqual(res.data, {'APP_USE': False, 'AI_ANALYSIS': False, 'PROFESSIONAL_SHARING': False})

    def test_grant_and_withdraw_are_new_rows(self):
        self.assertEqual(self.client.post('/api/consents/', {**self.base, 'consent_type': 'AI_ANALYSIS', 'granted': True}).status_code, 201)
        self.assertTrue(self.client.get('/api/consents/').data['AI_ANALYSIS'])
        self.client.post('/api/consents/', {**self.base, 'consent_type': 'AI_ANALYSIS', 'granted': False})
        self.assertFalse(self.client.get('/api/consents/').data['AI_ANALYSIS'])
        self.assertEqual(Consent.objects.filter(user=self.user, consent_type='AI_ANALYSIS').count(), 2)

    def test_invalid_type_rejected(self):
        res = self.client.post('/api/consents/', {**self.base, 'consent_type': 'NOPE', 'granted': True})
        self.assertEqual(res.status_code, 400)

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/consents/').status_code, 401)
