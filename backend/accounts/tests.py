from rest_framework.test import APITestCase

CREDS = {'email': 'Jane@Example.com', 'password': 'S3cure-pass-123'}


class AuthFlowTests(APITestCase):
    def test_register_login_me(self):
        res = self.client.post('/api/auth/register/', {**CREDS, 'first_name': 'Jane'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['user']['email'], 'jane@example.com')
        self.assertNotIn('password', res.data['user'])

        res = self.client.post('/api/auth/login/', {**CREDS, 'email': 'jane@example.com'})
        self.assertEqual(res.status_code, 200)
        access, refresh = res.data['access'], res.data['refresh']

        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.data['first_name'], 'Jane')

        self.client.credentials()
        res = self.client.post('/api/auth/refresh/', {'refresh': refresh})
        self.assertEqual(res.status_code, 200)

    def test_register_rejects_duplicate_and_weak_password(self):
        self.client.post('/api/auth/register/', CREDS)
        dup = self.client.post('/api/auth/register/', {**CREDS, 'email': 'jane@example.com'})
        self.assertEqual(dup.status_code, 400)
        weak = self.client.post('/api/auth/register/', {'email': 'a@b.com', 'password': '123'})
        self.assertEqual(weak.status_code, 400)

    def test_bad_login(self):
        res = self.client.post('/api/auth/login/', {'email': 'x@y.com', 'password': 'nope'})
        self.assertEqual(res.status_code, 401)
