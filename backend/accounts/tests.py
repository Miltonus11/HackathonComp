from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase

from .models import User, normalize_mobile

CREDS = {'mobile_number': '0917 123 4567', 'password': 'S3cure-pass-123'}


class MobileNormalizationTests(APITestCase):
    def test_formats(self):
        for raw in ['09171234567', '9171234567', '639171234567', '+639171234567', '0917-123-4567']:
            self.assertEqual(normalize_mobile(raw), '+639171234567')


class AuthFlowTests(APITestCase):
    def test_register_login_me(self):
        res = self.client.post('/api/auth/register/', {**CREDS, 'first_name': 'Jane', 'display_name': 'Jay'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['user']['mobile_number'], '+639171234567')
        self.assertEqual(res.data['user']['role'], 'USER')
        self.assertNotIn('password', res.data['user'])

        res = self.client.post('/api/auth/login/', {'mobile_number': '09171234567', 'password': CREDS['password']})
        self.assertEqual(res.status_code, 200)
        access, refresh = res.data['access'], res.data['refresh']

        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.data['first_name'], 'Jane')
        self.assertEqual(me.data['display_name'], 'Jay')

        self.client.credentials()
        res = self.client.post('/api/auth/refresh/', {'refresh': refresh})
        self.assertEqual(res.status_code, 200)

    def test_register_cannot_self_assign_role(self):
        res = self.client.post('/api/auth/register/', {**CREDS, 'role': 'ADMIN'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['user']['role'], 'USER')

    def test_register_rejects_duplicate_invalid_and_weak_password(self):
        self.client.post('/api/auth/register/', CREDS)
        dup = self.client.post('/api/auth/register/', {**CREDS, 'mobile_number': '+639171234567'})
        self.assertEqual(dup.status_code, 400)
        bad = self.client.post('/api/auth/register/', {**CREDS, 'mobile_number': '12345'})
        self.assertEqual(bad.status_code, 400)
        weak = self.client.post('/api/auth/register/', {'mobile_number': '09181234567', 'password': '123'})
        self.assertEqual(weak.status_code, 400)

    def test_stale_token_does_not_block_register_or_login(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer stale.token.value')
        res = self.client.post('/api/auth/register/', CREDS)
        self.assertEqual(res.status_code, 201)
        res = self.client.post('/api/auth/login/', {'mobile_number': CREDS['mobile_number'], 'password': CREDS['password']})
        self.assertEqual(res.status_code, 200)

    def test_bad_login(self):
        res = self.client.post('/api/auth/login/', {'mobile_number': '09170000000', 'password': 'nope'})
        self.assertEqual(res.status_code, 401)


class StaffRulesTests(APITestCase):
    def test_case_officer_needs_names_and_license(self):
        u = User(mobile_number='+639171234567', role=User.Role.CASE_OFFICER)
        with self.assertRaises(ValidationError) as ctx:
            u.clean()
        self.assertEqual(set(ctx.exception.message_dict), {'first_name', 'last_name', 'license_no'})

    def test_resident_names_optional(self):
        User(mobile_number='+639171234567').clean()
