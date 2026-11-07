import uuid

from django.test import SimpleTestCase, override_settings

from wellbeing import crypto


class JournalCryptoTests(SimpleTestCase):
    def setUp(self):
        self.user = uuid.uuid4()

    def test_round_trip_including_unicode(self):
        text = 'Pagod ako ngayon. 😔 Tapos na ang trabaho ko.'
        self.assertEqual(crypto.decrypt(self.user, crypto.encrypt(self.user, text)), text)

    def test_ciphertext_does_not_contain_plaintext(self):
        token = crypto.encrypt(self.user, 'my secret thoughts')
        self.assertNotIn('secret', token)

    def test_same_text_encrypts_differently_each_time(self):
        self.assertNotEqual(crypto.encrypt(self.user, 'hello'), crypto.encrypt(self.user, 'hello'))

    def test_another_users_key_cannot_decrypt(self):
        token = crypto.encrypt(self.user, 'private')
        with self.assertRaises(crypto.DecryptionError):
            crypto.decrypt(uuid.uuid4(), token)

    def test_garbage_raises_decryption_error(self):
        with self.assertRaises(crypto.DecryptionError):
            crypto.decrypt(self.user, 'not-a-token')

    @override_settings(JOURNAL_ENCRYPTION_KEY='master-one')
    def test_changing_the_master_key_makes_old_entries_unreadable(self):
        token = crypto.encrypt(self.user, 'private')
        with override_settings(JOURNAL_ENCRYPTION_KEY='master-two'):
            with self.assertRaises(crypto.DecryptionError):
                crypto.decrypt(self.user, token)

    @override_settings(JOURNAL_ENCRYPTION_KEY='')
    def test_falls_back_to_secret_key_when_no_dedicated_key(self):
        self.assertEqual(crypto.decrypt(self.user, crypto.encrypt(self.user, 'x')), 'x')
