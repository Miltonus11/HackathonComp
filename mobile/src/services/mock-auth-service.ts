import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';

import {
  appendConsent,
  CONSENT_TYPES,
  type ConsentRecord,
  type ConsentType,
} from '@/domain/consent';
import { normalizePhMobile } from '@/domain/mobile-number';
import type { Identity, LanguageCode, UserProfile } from '@/domain/profile';
import {
  validateBirthYear,
  validateName,
  validatePassword,
  validateUsername,
} from '@/domain/validation';

import {
  AuthError,
  type AuthService,
  type Session,
} from './auth-service';
import { defaultKv, type KeyValueStore } from './storage';

/*
 * MOCK ONLY. Stands in for the backend while it does not exist.
 *  - identity_store: who the person is + password hash. Never returned to the UI.
 *  - clinical_store: profile + consent ledger, keyed by the pseudonymous user_id.
 *  - session: which user_id is signed in.
 * Password hashing here is salted SHA-256; the real backend must use Argon2id.
 * Values live in SecureStore, which suits a few demo users, not real data volumes.
 */
const IDENTITY_KEY = 'identity_store';
const CLINICAL_KEY = 'clinical_store';
const SESSION_KEY = 'session';

type StoredIdentity = Identity & { password_salt: string; password_hash: string };
type IdentityStore = { identities: StoredIdentity[] };
type ClinicalStore = { profiles: UserProfile[]; consents: ConsentRecord[] };

const hashPassword = (salt: string, password: string) =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

export function createMockAuthService(kv: KeyValueStore = defaultKv): AuthService {
  async function read<T>(key: string, empty: T): Promise<T> {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as T) : empty;
  }
  const write = (key: string, value: unknown) => kv.set(key, JSON.stringify(value));

  const readIdentities = () => read<IdentityStore>(IDENTITY_KEY, { identities: [] });
  const readClinical = () => read<ClinicalStore>(CLINICAL_KEY, { profiles: [], consents: [] });

  async function buildSession(userId: string): Promise<Session | null> {
    const [{ identities }, { profiles, consents }] = await Promise.all([
      readIdentities(),
      readClinical(),
    ]);
    const stored = identities.find((i) => i.user_id === userId);
    const profile = profiles.find((p) => p.user_id === userId);
    if (!stored || !profile) return null;
    // Strip secrets and the real names: the UI only ever sees the username (display_name).
    const { password_salt, password_hash, first_name, last_name, ...identity } = stored;
    void [password_salt, password_hash, first_name, last_name];
    return { identity, profile, consents: consents.filter((c) => c.user_id === userId) };
  }

  async function requireUserId(): Promise<string> {
    const userId = await kv.get(SESSION_KEY);
    if (!userId) throw new AuthError('NOT_SIGNED_IN', 'You are not signed in.');
    return userId;
  }

  return {
    async register(input) {
      if (!input.consents.APP_USE) {
        throw new AuthError('CONSENT_REQUIRED', 'You must agree to the privacy notice to continue.');
      }
      const mobile = normalizePhMobile(input.mobile);
      if (!mobile) throw new AuthError('INVALID_MOBILE', 'Enter a valid PH mobile number.');
      const pwError = validatePassword(input.password);
      if (pwError) throw new AuthError('WEAK_PASSWORD', pwError);
      const fieldError =
        validateUsername(input.display_name) ??
        validateName(input.first_name) ??
        validateName(input.last_name) ??
        validateBirthYear(String(input.birth_year));
      if (fieldError) throw new AuthError('INVALID_INPUT', fieldError);

      const identityStore = await readIdentities();
      if (identityStore.identities.some((i) => i.mobile_number === mobile)) {
        throw new AuthError('MOBILE_TAKEN', 'This mobile number is already registered.');
      }

      const now = new Date().toISOString();
      const userId = randomUUID();
      const salt = randomUUID();
      const stored: StoredIdentity = {
        identity_id: randomUUID(),
        user_id: userId,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        display_name: input.display_name.trim(),
        mobile_number: mobile,
        contact_for_followup: input.contact_for_followup,
        status: 'ACTIVE',
        created_at: now,
        last_login_at: now,
        password_salt: salt,
        password_hash: await hashPassword(salt, input.password),
      };
      const profile: UserProfile = {
        user_id: userId,
        birth_year: input.birth_year,
        sex: input.sex,
        sector: input.sector,
        barangay_id: input.barangay_id,
        language_code: input.language_code,
        onboarding_completed_at: null,
        created_at: now,
      };

      let ledger: ConsentRecord[] = [];
      for (const type of CONSENT_TYPES) {
        ledger = appendConsent(ledger, {
          user_id: userId,
          consent_type: type,
          granted: input.consents[type] === true,
          notice_version: input.notice_version,
          language_code: input.language_code,
        });
      }

      const clinical = await readClinical();
      // All validation is done; write everything together.
      await write(IDENTITY_KEY, { identities: [...identityStore.identities, stored] });
      await write(CLINICAL_KEY, {
        profiles: [...clinical.profiles, profile],
        consents: [...clinical.consents, ...ledger],
      });
      await kv.set(SESSION_KEY, userId);
      return (await buildSession(userId))!;
    },

    async signIn(mobile, password) {
      const bad = new AuthError('BAD_CREDENTIALS', 'Mobile number or password is incorrect.');
      const normalized = normalizePhMobile(mobile);
      if (!normalized) throw bad;
      const store = await readIdentities();
      const found = store.identities.find((i) => i.mobile_number === normalized);
      if (!found || found.status !== 'ACTIVE') throw bad;
      if ((await hashPassword(found.password_salt, password)) !== found.password_hash) throw bad;

      found.last_login_at = new Date().toISOString();
      await write(IDENTITY_KEY, store);
      await kv.set(SESSION_KEY, found.user_id);
      return (await buildSession(found.user_id))!;
    },

    async restore() {
      const userId = await kv.get(SESSION_KEY);
      return userId ? buildSession(userId) : null;
    },

    async signOut() {
      await kv.remove(SESSION_KEY);
    },

    async setConsent(type: ConsentType, granted: boolean, language: LanguageCode) {
      const userId = await requireUserId();
      const clinical = await readClinical();
      const last = [...clinical.consents].reverse().find((c) => c.user_id === userId);
      const noticeVersion = last?.notice_version ?? 'unknown';
      const consents = appendConsent(clinical.consents, {
        user_id: userId,
        consent_type: type,
        granted,
        notice_version: noticeVersion,
        language_code: language,
      });
      await write(CLINICAL_KEY, { ...clinical, consents });
      return (await buildSession(userId))!;
    },
  };
}
