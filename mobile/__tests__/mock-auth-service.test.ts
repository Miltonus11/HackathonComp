import { currentConsent, hasRequiredConsent } from '@/domain/consent';
import { AuthError, type RegistrationInput } from '@/services/auth-service';
import { createMockAuthService } from '@/services/mock-auth-service';
import type { KeyValueStore } from '@/services/storage';

function memoryKv(): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const input = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
  mobile: '09171234567',
  password: 'longenough1',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  display_name: 'juan_dc',
  contact_for_followup: false,
  birth_year: 2001,
  sex: 'MALE',
  sector: 'STUDENT',
  barangay_id: 1,
  language_code: 'en',
  consents: { APP_USE: true, AI_ANALYSIS: false, PROFESSIONAL_SHARING: false },
  notice_version: 'v-test',
  ...over,
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof AuthError ? e.code : `non-AuthError: ${String(e)}`;
  }
  return 'no error';
};

describe('mock auth service', () => {
  it('registers: UUID user_id, canonical mobile, three consent rows', async () => {
    const svc = createMockAuthService(memoryKv());
    const s = await svc.register(input());
    expect(s.identity.user_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.profile.user_id).toBe(s.identity.user_id);
    expect(s.identity.mobile_number).toBe('+639171234567');
    expect(s.consents).toHaveLength(3);
    expect(currentConsent(s.consents, s.identity.user_id, 'APP_USE')).toBe(true);
    expect(currentConsent(s.consents, s.identity.user_id, 'AI_ANALYSIS')).toBe(false);
    expect(s.consents.every((c) => c.notice_version === 'v-test' && c.language_code === 'en')).toBe(true);
  });

  it('never stores the plaintext password and keeps names out of the clinical store', async () => {
    const kv = memoryKv();
    const svc = createMockAuthService(kv);
    const s = await svc.register(input());
    const raw = JSON.stringify(kv.dump());
    expect(raw).not.toContain('longenough1');
    expect(JSON.stringify(s)).not.toMatch(/password|salt|hash/i);
    expect(kv.dump().clinical_store).not.toContain('Dela Cruz');
    expect(kv.dump().clinical_store).not.toContain('+639171234567');
  });

  it('shows the username as display name and never exposes real names to the UI', async () => {
    const svc = createMockAuthService(memoryKv());
    const s = await svc.register(input());
    expect(s.identity.display_name).toBe('juan_dc');
    expect(JSON.stringify(s)).not.toMatch(/Juan|Dela Cruz|first_name|last_name/);
    const restored = await svc.restore();
    expect(JSON.stringify(restored)).not.toMatch(/Dela Cruz|first_name|last_name/);
  });

  it('requires a username', async () => {
    const svc = createMockAuthService(memoryKv());
    expect(await code(svc.register(input({ display_name: '' })))).toBe('INVALID_INPUT');
    expect(await code(svc.register(input({ display_name: 'ab' })))).toBe('INVALID_INPUT');
  });

  it('rejects a duplicate number in a different format and writes nothing more', async () => {
    const kv = memoryKv();
    const svc = createMockAuthService(kv);
    await svc.register(input());
    const before = JSON.stringify(kv.dump());
    expect(await code(svc.register(input({ mobile: '+63 917 123 4567' })))).toBe('MOBILE_TAKEN');
    expect(JSON.stringify(kv.dump())).toBe(before);
  });

  it('rejects registration without APP_USE consent and writes nothing', async () => {
    const kv = memoryKv();
    const svc = createMockAuthService(kv);
    const c = await code(
      svc.register(input({ consents: { APP_USE: false, AI_ANALYSIS: true, PROFESSIONAL_SHARING: true } })),
    );
    expect(c).toBe('CONSENT_REQUIRED');
    expect(kv.dump()).toEqual({});
  });

  it('rejects bad mobile, weak password and invalid fields', async () => {
    const svc = createMockAuthService(memoryKv());
    expect(await code(svc.register(input({ mobile: '0817 123 4567' })))).toBe('INVALID_MOBILE');
    expect(await code(svc.register(input({ password: 'short' })))).toBe('WEAK_PASSWORD');
    expect(await code(svc.register(input({ birth_year: 2999 })))).toBe('INVALID_INPUT');
    expect(await code(svc.register(input({ first_name: '  ' })))).toBe('INVALID_INPUT');
  });

  it('signs in with a differently formatted number', async () => {
    const svc = createMockAuthService(memoryKv());
    const reg = await svc.register(input());
    await svc.signOut();
    const s = await svc.signIn('+63 917-123-4567', 'longenough1');
    expect(s.identity.user_id).toBe(reg.identity.user_id);
    expect(s.identity.last_login_at).not.toBeNull();
  });

  it('gives the same BAD_CREDENTIALS for wrong password and unknown number', async () => {
    const svc = createMockAuthService(memoryKv());
    await svc.register(input());
    expect(await code(svc.signIn('09171234567', 'wrongpass1'))).toBe('BAD_CREDENTIALS');
    expect(await code(svc.signIn('09181234567', 'longenough1'))).toBe('BAD_CREDENTIALS');
  });

  it('setConsent appends a row (grant, withdraw, re-grant) and latest wins', async () => {
    const svc = createMockAuthService(memoryKv());
    const reg = await svc.register(input());
    const uid = reg.identity.user_id;
    let s = await svc.setConsent('AI_ANALYSIS', true, 'fil');
    expect(s.consents).toHaveLength(4);
    expect(s.consents[3].language_code).toBe('fil');
    s = await svc.setConsent('AI_ANALYSIS', false, 'en');
    expect(currentConsent(s.consents, uid, 'AI_ANALYSIS')).toBe(false);
    s = await svc.setConsent('AI_ANALYSIS', true, 'en');
    expect(currentConsent(s.consents, uid, 'AI_ANALYSIS')).toBe(true);
    expect(s.consents).toHaveLength(6);
  });

  it('withdrawing APP_USE leaves a restorable session with required consent false', async () => {
    const svc = createMockAuthService(memoryKv());
    const reg = await svc.register(input());
    await svc.setConsent('APP_USE', false, 'en');
    const restored = await svc.restore();
    expect(restored).not.toBeNull();
    expect(hasRequiredConsent(restored!.consents, reg.identity.user_id)).toBe(false);
  });

  it('restores a session after "relaunch" and returns null after signOut', async () => {
    const kv = memoryKv();
    await createMockAuthService(kv).register(input());
    const relaunched = createMockAuthService(kv);
    expect(await relaunched.restore()).not.toBeNull();
    await relaunched.signOut();
    expect(await relaunched.restore()).toBeNull();
  });

  it('keeps two users separate', async () => {
    const svc = createMockAuthService(memoryKv());
    const a = await svc.register(input());
    await svc.signOut();
    const b = await svc.register(input({ mobile: '09181234567', first_name: 'Maria', display_name: 'maria_s' }));
    expect(b.identity.user_id).not.toBe(a.identity.user_id);
    expect(b.consents.every((c) => c.user_id === b.identity.user_id)).toBe(true);
    expect(b.consents).toHaveLength(3);
  });
});
