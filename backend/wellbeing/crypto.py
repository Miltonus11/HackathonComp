"""Per-user encryption for journal text.

Each user gets their own key, derived (HKDF) from one master key plus their pseudonymous user_id,
so one user's key never decrypts another user's entries and no per-user keys are stored.

The master key is JOURNAL_ENCRYPTION_KEY from .env. If it is unset, SECRET_KEY is used so that local
development works. In production set a dedicated key and never change it: changing the master key
makes every existing entry unreadable.
"""
import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings


class DecryptionError(Exception):
    pass


def _fernet(user_id):
    master = (getattr(settings, 'JOURNAL_ENCRYPTION_KEY', '') or settings.SECRET_KEY).encode()
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=f'journal:{user_id}'.encode()).derive(master)
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(user_id, text):
    return _fernet(user_id).encrypt(text.encode('utf-8')).decode('ascii')


def decrypt(user_id, token):
    try:
        return _fernet(user_id).decrypt(token.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError, UnicodeError) as exc:
        raise DecryptionError('Could not decrypt this value.') from exc
