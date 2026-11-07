import { CONSENT_TYPES, type ConsentRecord, type ConsentType } from '@/domain/consent';
import { normalizePhMobile } from '@/domain/mobile-number';
import type { LanguageCode, Sector, SessionIdentity, Sex, UserProfile } from '@/domain/profile';
import { ApiError, apiFetch } from '@/lib/api';
import { NOTICE_VERSION } from '@/content/privacy-notice';

import {
  AuthError,
  type AuthErrorCode,
  type AuthService,
  type RegistrationInput,
  type Session,
} from './auth-service';
import { defaultKv, type KeyValueStore } from './storage';

/*
 * Real-API implementation of AuthService. Backend contract (see docs/backend-handoff.md):
 *   POST /auth/register/ /auth/login/ /auth/refresh/   GET /auth/me/
 *   GET|POST /profile/   GET|POST /consents/           GET /barangays/ (public)
 * Registration is several calls (account, profile, consents). If it stops part-way, calling
 * register again with the same number AND password finishes the setup instead of failing.
 */
const TOKENS_KEY = 'api_tokens';

type Tokens = { access: string; refresh: string };
type ApiUser = {
  user_id: string;
  mobile_number: string;
  display_name: string;
  contact_for_followup: boolean;
  date_joined: string;
};
type ApiProfile = {
  birth_year: number;
  sex: Sex;
  sector: Sector;
  barangay: number;
  language_code: LanguageCode;
  onboarding_completed_at: string | null;
};
type ConsentState = Record<ConsentType, boolean>;
type ConsentRow = {
  decided_at: string;
  notice_version: string;
  language_code: LanguageCode;
};

// Backend field name -> registration form field name
const FIELD_MAP: Record<string, string> = {
  mobile_number: 'mobile',
  password: 'password',
  display_name: 'username',
  first_name: 'first_name',
  last_name: 'last_name',
  birth_year: 'birth_year',
  sex: 'sex',
  sector: 'sector',
  barangay: 'barangay_id',
};

const jsonInit = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

function toAuthError(e: unknown): AuthError {
  if (e instanceof AuthError) return e;
  if (e instanceof TypeError) {
    return new AuthError('NETWORK', 'Could not reach the server. Check your connection and try again.');
  }
  if (e instanceof ApiError && e.status === 400) {
    const fields: Record<string, string> = {};
    for (const [key, messages] of Object.entries(e.fields)) {
      const field = FIELD_MAP[key];
      if (field && messages[0]) fields[field] = messages[0];
    }
    let code: AuthErrorCode = 'INVALID_INPUT';
    if (fields.mobile) code = /already exists/i.test(fields.mobile) ? 'MOBILE_TAKEN' : 'INVALID_MOBILE';
    else if (fields.password) code = 'WEAK_PASSWORD';
    return new AuthError(code, Object.values(fields)[0] ?? e.message, fields);
  }
  if (e instanceof ApiError && e.status === 401) {
    return new AuthError('NOT_SIGNED_IN', 'Your session has expired. Please log in again.');
  }
  return new AuthError('SERVER', 'Something went wrong on our side. Please try again.');
}

export function createApiAuthService(kv: KeyValueStore = defaultKv): AuthService {
  // Details of consent changes made on this device (the API only returns current state).
  const known = new Map<ConsentType, ConsentRow>();

  async function readTokens(): Promise<Tokens | null> {
    const raw = await kv.get(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  }
  const saveTokens = (t: Tokens) => kv.set(TOKENS_KEY, JSON.stringify(t));

  /** Authenticated request; refreshes the access token once on 401. */
  async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
    let tokens = await readTokens();
    if (!tokens) throw new AuthError('NOT_SIGNED_IN', 'You are not signed in.');
    const call = (access: string) =>
      apiFetch<T>(path, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${access}` },
      });
    try {
      return await call(tokens.access);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const res = await apiFetch<{ access: string; refresh?: string }>(
        '/auth/refresh/',
        jsonInit('POST', { refresh: tokens.refresh }),
      );
      tokens = { access: res.access, refresh: res.refresh ?? tokens.refresh };
      await saveTokens(tokens);
      return call(tokens.access);
    }
  }

  async function login(mobile: string, password: string): Promise<Tokens> {
    const canonical = normalizePhMobile(mobile);
    const bad = new AuthError('BAD_CREDENTIALS', 'Mobile number or password is incorrect.');
    if (!canonical) throw bad;
    try {
      return await apiFetch<Tokens>('/auth/login/', jsonInit('POST', { mobile_number: canonical, password }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw bad;
      throw e;
    }
  }

  async function buildSession(): Promise<Session> {
    const [me, profile, state] = await Promise.all([
      authed<ApiUser>('/auth/me/'),
      authed<ApiProfile>('/profile/'),
      authed<ConsentState>('/consents/'),
    ]);
    // Real names are in the /me payload but are deliberately not copied into the session.
    const identity: SessionIdentity = {
      identity_id: me.user_id,
      user_id: me.user_id,
      display_name: me.display_name,
      mobile_number: me.mobile_number,
      contact_for_followup: me.contact_for_followup,
      status: 'ACTIVE',
      created_at: me.date_joined,
      last_login_at: null,
    };
    const userProfile: UserProfile = {
      user_id: me.user_id,
      birth_year: profile.birth_year,
      sex: profile.sex,
      sector: profile.sector,
      barangay_id: profile.barangay,
      language_code: profile.language_code,
      onboarding_completed_at: profile.onboarding_completed_at,
      created_at: me.date_joined,
    };
    // The API returns current state only, so each type becomes one ledger row.
    const consents: ConsentRecord[] = CONSENT_TYPES.map((type) => ({
      consent_id: `${me.user_id}:${type}`,
      user_id: me.user_id,
      consent_type: type,
      granted: state[type] === true,
      notice_version: known.get(type)?.notice_version ?? '',
      language_code: known.get(type)?.language_code ?? profile.language_code,
      decided_at: known.get(type)?.decided_at ?? '',
    }));
    return { identity, profile: userProfile, consents };
  }

  async function postConsent(type: ConsentType, granted: boolean, language: LanguageCode, version: string) {
    const row = await authed<ConsentRow>(
      '/consents/',
      jsonInit('POST', { consent_type: type, granted, notice_version: version, language_code: language }),
    );
    known.set(type, { decided_at: row.decided_at, notice_version: version, language_code: language });
  }

  return {
    async register(input: RegistrationInput) {
      if (!input.consents.APP_USE) {
        throw new AuthError('CONSENT_REQUIRED', 'You must agree to the privacy notice to continue.');
      }
      const mobile = normalizePhMobile(input.mobile);
      if (!mobile) {
        throw new AuthError('INVALID_MOBILE', 'Enter a valid PH mobile number.', {
          mobile: 'Enter a valid PH mobile number.',
        });
      }
      let accountReady = false;
      try {
        let profileExists = false;
        let tokens: Tokens;
        try {
          const res = await apiFetch<Tokens>(
            '/auth/register/',
            jsonInit('POST', {
              mobile_number: mobile,
              password: input.password,
              first_name: input.first_name.trim(),
              last_name: input.last_name.trim(),
              display_name: input.display_name.trim(),
              contact_for_followup: input.contact_for_followup,
            }),
          );
          tokens = { access: res.access, refresh: res.refresh };
          await saveTokens(tokens);
          accountReady = true;
        } catch (e) {
          const err = toAuthError(e);
          if (err.code !== 'MOBILE_TAKEN') throw err;
          // The number exists. If the password proves it is this person's unfinished signup,
          // resume; otherwise it is genuinely taken.
          try {
            tokens = await login(mobile, input.password);
          } catch {
            throw err;
          }
          await saveTokens(tokens);
          accountReady = true;
          profileExists = await authed('/profile/').then(
            () => true,
            (pe) => {
              if (pe instanceof ApiError && pe.status === 404) return false;
              throw pe;
            },
          );
          const state = await authed<ConsentState>('/consents/');
          if (profileExists && state.APP_USE) {
            await kv.remove(TOKENS_KEY);
            throw err;
          }
        }

        if (!profileExists) {
          await authed('/profile/', jsonInit('POST', {
            birth_year: input.birth_year,
            sex: input.sex,
            sector: input.sector,
            barangay: input.barangay_id,
            language_code: input.language_code,
          }));
        }
        for (const type of CONSENT_TYPES) {
          await postConsent(type, input.consents[type] === true, input.language_code, input.notice_version);
        }
        return await buildSession();
      } catch (e) {
        await kv.remove(TOKENS_KEY);
        const err = toAuthError(e);
        // Stopped by a server/network problem after the account existed: say how to finish.
        // (A 400 stays a field error so the user can correct it and register again.)
        if (accountReady && (err.code === 'SERVER' || err.code === 'NETWORK')) {
          throw new AuthError(
            'SETUP_INCOMPLETE',
            'Your account was created but setup did not finish. Tap "Create account" again to finish.',
          );
        }
        throw err;
      }
    },

    async signIn(mobile, password) {
      try {
        await saveTokens(await login(mobile, password));
        return await buildSession();
      } catch (e) {
        await kv.remove(TOKENS_KEY);
        if (e instanceof ApiError && e.status === 404) {
          throw new AuthError(
            'SETUP_INCOMPLETE',
            'Your account setup is not finished. Choose "Get started" and register again with the same number and password to finish.',
          );
        }
        throw toAuthError(e);
      }
    },

    async restore() {
      if (!(await readTokens())) return null;
      try {
        return await buildSession();
      } catch (e) {
        // Offline at launch: keep the tokens so the next launch can restore. Anything else
        // (expired refresh, missing profile) means the stored session is no longer usable.
        if (!(e instanceof TypeError)) await kv.remove(TOKENS_KEY);
        return null;
      }
    },

    async signOut() {
      await kv.remove(TOKENS_KEY);
      known.clear();
    },

    async setConsent(type, granted, language) {
      try {
        await postConsent(type, granted, language, NOTICE_VERSION);
        return await buildSession();
      } catch (e) {
        throw toAuthError(e);
      }
    },
  };
}
