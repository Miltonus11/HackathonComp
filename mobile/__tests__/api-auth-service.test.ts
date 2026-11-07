import { currentConsent, hasRequiredConsent } from '@/domain/consent';
import { AuthError, type RegistrationInput } from '@/services/auth-service';
import { createApiAuthService } from '@/services/api-auth-service';
import type { KeyValueStore } from '@/services/storage';

function memoryKv(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
  };
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** In-memory stand-in for the Django API (same paths, payloads and error shapes). */
function fakeBackend() {
  const users: Json[] = [];
  const profiles = new Map<string, Json>();
  const consents = new Map<string, Json[]>();
  const access = new Map<string, string>(); // access token -> user_id
  const refresh = new Map<string, string>();
  const calls: string[] = [];
  let n = 0;
  const failNext: { profilePost: boolean } = { profilePost: false };

  const canon = (m: string) => {
    const d = m.replace(/[\s\-().]/g, '');
    return /^09\d{9}$/.test(d) ? '+63' + d.slice(1) : /^\+639\d{9}$/.test(d) ? d : d;
  };
  const issue = (userId: string) => {
    const a = `acc-${++n}`;
    const r = `ref-${++n}`;
    access.set(a, userId);
    refresh.set(r, userId);
    return { access: a, refresh: r };
  };
  const publicUser = (u: Json) => ({
    user_id: u.user_id,
    mobile_number: u.mobile_number,
    email: null,
    first_name: u.first_name,
    last_name: u.last_name,
    display_name: u.display_name,
    role: 'USER',
    contact_for_followup: u.contact_for_followup,
    date_joined: u.date_joined,
  });

  function handle(method: string, path: string, body: Json, auth: string | null): [number, any] {
    if (method === 'GET' && path === '/barangays/') return [200, [{ id: 7, name: 'Biday', district: '' }]];
    if (method === 'POST' && path === '/auth/register/') {
      const mobile = canon(body.mobile_number ?? '');
      if (users.some((u) => u.mobile_number === mobile)) {
        return [400, { mobile_number: ['A user with this mobile number already exists.'] }];
      }
      if ((body.password ?? '').length < 8) {
        return [400, { password: ['This password is too short. It must contain at least 8 characters.'] }];
      }
      const u = { ...body, mobile_number: mobile, user_id: `uid-${users.length + 1}`, date_joined: '2026-11-07T00:00:00Z' };
      users.push(u);
      return [201, { user: publicUser(u), ...issue(u.user_id) }];
    }
    if (method === 'POST' && path === '/auth/login/') {
      const u = users.find((x) => x.mobile_number === canon(body.mobile_number ?? '') && x.password === body.password);
      return u ? [200, issue(u.user_id)] : [401, { detail: 'No active account found with the given credentials' }];
    }
    if (method === 'POST' && path === '/auth/refresh/') {
      const uid = refresh.get(body.refresh);
      if (!uid) return [401, { detail: 'Token is invalid or expired' }];
      const a = `acc-${++n}`;
      access.set(a, uid);
      return [200, { access: a }];
    }
    const uid = auth ? access.get(auth.replace('Bearer ', '')) : undefined;
    if (!uid) return [401, { detail: 'Given token not valid for any token type' }];
    const me = users.find((u) => u.user_id === uid)!;
    if (method === 'GET' && path === '/auth/me/') return [200, publicUser(me)];
    if (path === '/profile/') {
      if (method === 'GET') return profiles.has(uid) ? [200, profiles.get(uid)] : [404, { detail: 'Profile not created yet.' }];
      if (failNext.profilePost) {
        failNext.profilePost = false;
        return [500, { detail: 'boom' }];
      }
      profiles.set(uid, { ...body, barangay_name: 'Biday', age_band: '18_24', onboarding_completed_at: null });
      return [201, profiles.get(uid)];
    }
    if (path === '/consents/') {
      const rows = consents.get(uid) ?? [];
      if (method === 'GET') {
        const state: Json = { APP_USE: false, AI_ANALYSIS: false, PROFESSIONAL_SHARING: false };
        for (const r of rows) state[r.consent_type] = r.granted;
        return [200, state];
      }
      const row = { ...body, decided_at: `2026-11-07T00:00:0${rows.length}Z` };
      consents.set(uid, [...rows, row]);
      return [201, row];
    }
    return [404, { detail: 'Not found' }];
  }

  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+\/api/, '');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const [status, json] = handle(method, path, init?.body ? JSON.parse(String(init.body)) : {}, headers.Authorization ?? null);
    return { ok: status < 400, status, statusText: String(status), json: async () => json } as Response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return {
    users,
    profiles,
    consents,
    calls,
    failNext,
    fetchMock,
    expireAccessTokens: () => access.clear(),
    dropProfile: () => profiles.clear(),
  };
}

const input = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
  mobile: '0917 123 4567',
  password: 'longenough1',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  display_name: 'juan_dc',
  contact_for_followup: false,
  birth_year: 2001,
  sex: 'MALE',
  sector: 'STUDENT',
  barangay_id: 7,
  language_code: 'fil',
  consents: { APP_USE: true, AI_ANALYSIS: false, PROFESSIONAL_SHARING: true },
  notice_version: 'v-test',
  ...over,
});

const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected a rejection');
};

describe('api auth service', () => {
  it('registers: account, profile and three consents; session never exposes real names', async () => {
    const be = fakeBackend();
    const svc = createApiAuthService(memoryKv());
    const s = await svc.register(input());
    expect(be.calls).toEqual([
      'POST /auth/register/',
      'POST /profile/',
      'POST /consents/',
      'POST /consents/',
      'POST /consents/',
      'GET /auth/me/',
      'GET /profile/',
      'GET /consents/',
    ]);
    expect(be.users[0].mobile_number).toBe('+639171234567');
    expect(be.users[0].first_name).toBe('Juan');
    expect(be.profiles.get('uid-1')).toMatchObject({ birth_year: 2001, sex: 'MALE', barangay: 7, language_code: 'fil' });
    expect(s.identity.display_name).toBe('juan_dc');
    expect(s.profile.barangay_id).toBe(7);
    const uid = s.identity.user_id;
    expect(currentConsent(s.consents, uid, 'APP_USE')).toBe(true);
    expect(currentConsent(s.consents, uid, 'AI_ANALYSIS')).toBe(false);
    expect(currentConsent(s.consents, uid, 'PROFESSIONAL_SHARING')).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/Juan|Dela Cruz|first_name|last_name|password/);
  });

  it('refuses without APP_USE and makes no request', async () => {
    const be = fakeBackend();
    const svc = createApiAuthService(memoryKv());
    const err = await failure(
      svc.register(input({ consents: { APP_USE: false, AI_ANALYSIS: true, PROFESSIONAL_SHARING: true } })),
    );
    expect(err.code).toBe('CONSENT_REQUIRED');
    expect(be.fetchMock).not.toHaveBeenCalled();
  });

  it('maps a duplicate number to MOBILE_TAKEN on the mobile field and stays signed out', async () => {
    fakeBackend();
    const svc = createApiAuthService(memoryKv());
    await svc.register(input());
    await svc.signOut();
    const err = await failure(svc.register(input({ password: 'another-pass1' })));
    expect(err.code).toBe('MOBILE_TAKEN');
    expect(err.fields.mobile).toMatch(/already/i);
    expect(await svc.restore()).toBeNull();
  });

  it('maps server password rules onto the password field', async () => {
    fakeBackend();
    const svc = createApiAuthService(memoryKv());
    const err = await failure(svc.register(input({ password: 'short' })));
    expect(err.code).toBe('WEAK_PASSWORD');
    expect(err.fields.password).toMatch(/too short/i);
  });

  it('finishes setup when registering again after a failed profile save', async () => {
    const be = fakeBackend();
    const svc = createApiAuthService(memoryKv());
    be.failNext.profilePost = true;
    const first = await failure(svc.register(input()));
    expect(first.code).toBe('SETUP_INCOMPLETE');
    const s = await svc.register(input());
    expect(be.users).toHaveLength(1);
    expect(hasRequiredConsent(s.consents, s.identity.user_id)).toBe(true);
    expect(s.profile.birth_year).toBe(2001);
  });

  it('a wrong password cannot take over an unfinished account', async () => {
    const be = fakeBackend();
    const svc = createApiAuthService(memoryKv());
    be.failNext.profilePost = true;
    await failure(svc.register(input()));
    const err = await failure(svc.register(input({ password: 'not-the-password' })));
    expect(err.code).toBe('MOBILE_TAKEN');
    expect(be.profiles.size).toBe(0);
  });

  it('signIn: generic BAD_CREDENTIALS, then success with a different number format', async () => {
    fakeBackend();
    const svc = createApiAuthService(memoryKv());
    await svc.register(input());
    await svc.signOut();
    expect((await failure(svc.signIn('09171234567', 'wrongpass1'))).code).toBe('BAD_CREDENTIALS');
    expect((await failure(svc.signIn('09181234567', 'longenough1'))).code).toBe('BAD_CREDENTIALS');
    const s = await svc.signIn('+63 917-123-4567', 'longenough1');
    expect(s.identity.display_name).toBe('juan_dc');
  });

  it('signIn on an account with no profile gives SETUP_INCOMPLETE and stays signed out', async () => {
    const be = fakeBackend();
    const svc = createApiAuthService(memoryKv());
    await svc.register(input());
    await svc.signOut();
    be.dropProfile();
    expect((await failure(svc.signIn('09171234567', 'longenough1'))).code).toBe('SETUP_INCOMPLETE');
    expect(await svc.restore()).toBeNull();
  });

  it('restore refreshes an expired access token', async () => {
    const be = fakeBackend();
    const kv = memoryKv();
    await createApiAuthService(kv).register(input());
    be.expireAccessTokens();
    const s = await createApiAuthService(kv).restore();
    expect(s?.identity.display_name).toBe('juan_dc');
    expect(be.calls).toContain('POST /auth/refresh/');
  });

  it('restore keeps tokens when the network is down, and returns null after signOut', async () => {
    fakeBackend();
    const kv = memoryKv();
    const svc = createApiAuthService(kv);
    await svc.register(input());
    const down = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    globalThis.fetch = down as unknown as typeof fetch;
    expect(await svc.restore()).toBeNull();
    fakeBackend(); // network back, but a fresh server has no such tokens → refresh fails, tokens cleared
    await svc.signOut();
    expect(await svc.restore()).toBeNull();
  });

  it('setConsent withdraws APP_USE, re-grants it, and records when it changed', async () => {
    fakeBackend();
    const svc = createApiAuthService(memoryKv());
    const reg = await svc.register(input());
    const uid = reg.identity.user_id;
    let s = await svc.setConsent('APP_USE', false, 'en');
    expect(hasRequiredConsent(s.consents, uid)).toBe(false);
    expect(s.consents.find((c) => c.consent_type === 'APP_USE')?.decided_at).not.toBe('');
    s = await svc.setConsent('APP_USE', true, 'en');
    expect(hasRequiredConsent(s.consents, uid)).toBe(true);
  });

  it('reports NETWORK when the server cannot be reached', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const svc = createApiAuthService(memoryKv());
    expect((await failure(svc.signIn('09171234567', 'longenough1'))).code).toBe('NETWORK');
    expect((await failure(svc.register(input()))).code).toBe('NETWORK');
  });
});
