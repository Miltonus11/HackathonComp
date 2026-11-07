/**
 * Live end-to-end check of the real mobile services against a running backend.
 * Off by default. Run with the backend up, migrated and seeded:
 *
 *     LIVE_API=1 npx jest live-api
 *
 * It creates a throwaway account (display_name "e2e_test") and never answers in a way that
 * raises a crisis flag. Remove the account afterwards with:
 *     python manage.py shell -c "from accounts.models import User; User.objects.filter(display_name='e2e_test').delete()"
 */
import { currentConsent, hasRequiredConsent } from '@/domain/consent';
import { assessmentStatus } from '@/domain/screening';
import { createAuthedClient } from '@/lib/authed-client';
import { createApiAuthService } from '@/services/api-auth-service';
import { createApiScreeningService } from '@/services/api-screening-service';
import { fetchBarangays } from '@/services/barangays';
import { ScreeningError } from '@/services/screening-service';
import type { KeyValueStore } from '@/services/storage';

const live = process.env.LIVE_API === '1';

// The jest React Native environment replaces fetch with a polyfill that cannot reach a real
// server, so this test talks to the backend through Node's http module instead.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require('node:http') as typeof import('node:http');
function nodeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: init.method ?? 'GET', headers: {
          ...(init.headers as Record<string, string>),
          // Django's dev server cannot read chunked request bodies
          ...(init.body ? { 'Content-Length': String(Buffer.byteLength(init.body as string)) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          resolve({ ok: status < 400, status, statusText: res.statusMessage ?? '', json: async () => JSON.parse(body) } as Response);
        });
      },
    );
    req.on('error', (e) => reject(new TypeError(e.message)));
    if (init.body) req.write(init.body as string);
    req.end();
  });
}

function memoryKv(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
  };
}

const answers = (n: number, v: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, v]));
const randomMobile = () => '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

(live ? describe : describe.skip)('live API end to end', () => {
  jest.setTimeout(90_000);
  beforeAll(() => {
    globalThis.fetch = nodeFetch as unknown as typeof fetch;
  });

  it('register, first check-in (good path), re-take (low path), consent gate', async () => {
    const kv = memoryKv();
    const auth = createApiAuthService(kv);
    const screening = createApiScreeningService(createAuthedClient(kv));
    const mobile = randomMobile();

    // Registration form data comes from the real API
    const barangays = await fetchBarangays();
    expect(barangays.length).toBeGreaterThan(0);

    const reg = await auth.register({
      mobile,
      password: 'E2e-test-pass-123',
      first_name: 'Test',
      last_name: 'Account',
      display_name: 'e2e_test',
      contact_for_followup: false,
      birth_year: 1995,
      sex: 'PREFER_NOT_TO_SAY',
      sector: 'OTHER',
      barangay_id: barangays[0].barangay_id,
      language_code: 'en',
      consents: { APP_USE: true, AI_ANALYSIS: false, PROFESSIONAL_SHARING: false },
      notice_version: 'e2e',
    });
    const uid = reg.identity.user_id;
    expect(reg.identity.display_name).toBe('e2e_test');
    expect(JSON.stringify(reg)).not.toMatch(/"Account"|first_name|last_name/);
    expect(hasRequiredConsent(reg.consents, uid)).toBe(true);
    // First time: the server has not marked onboarding complete, so the app would auto-start
    expect(reg.profile.onboarding_completed_at).toBeNull();
    expect(assessmentStatus(await screening.list())).toEqual({ kind: 'none' });

    // --- first check-in, good wellbeing: WHO-5 -> GAD-7 -> item 9 only
    const started = await screening.start();
    expect(started.next.instrument).toBe('WHO5');
    expect(started.next.items).toHaveLength(5);
    expect(started.next.options).toHaveLength(6);
    const a = await screening.submit(started.sessionId, 'WHO5', answers(5, 4)); // 80
    expect(a.crisis).toBeNull();
    expect(a.next?.instrument).toBe('GAD7');
    const b = await screening.submit(started.sessionId, 'GAD7', answers(7, 0));
    expect(b.next?.instrument).toBe('PHQ9_ITEM9'); // full PHQ-9 skipped, item 9 still asked
    const c = await screening.submit(started.sessionId, 'PHQ9_ITEM9', { 1: 0 });
    expect(c.completed).toBe(true);
    expect(c.crisis).toBeNull();

    const detail = await screening.get(started.sessionId);
    expect(detail.results.map((r) => r.instrument)).toEqual(['WHO5', 'GAD7', 'PHQ9_ITEM9']);

    // Completing marks onboarding done, so the next launch does not auto-start again
    const restored = await auth.restore();
    expect(restored?.profile.onboarding_completed_at).not.toBeNull();
    expect(assessmentStatus(await screening.list()).kind).toBe('done');

    // --- take it again, lower wellbeing: WHO-5 40 -> GAD-7 -> choice -> (accept) longer questions
    const again = await screening.start();
    expect(again.sessionId).not.toBe(started.sessionId);
    const a2 = await screening.submit(again.sessionId, 'WHO5', answers(5, 2)); // 40
    expect(a2.crisis).toBeNull();
    expect(a2.choice).toBeNull();
    const b2 = await screening.submit(again.sessionId, 'GAD7', answers(7, 1));
    expect(b2.choice).toBe('MOOD_QUESTIONS'); // asked, not forced
    expect(b2.next).toBeNull();
    expect(b2.completed).toBe(false);
    // The server will not take the longer questions before the person has chosen
    await expect(screening.submit(again.sessionId, 'PHQ9', answers(9, 0))).rejects.toMatchObject({
      code: 'CHOICE_REQUIRED',
    });
    // A resumed session lands back on the choice
    const waiting = await screening.get(again.sessionId);
    expect(waiting.choice).toBe('MOOD_QUESTIONS');
    expect(waiting.completed).toBe(false);
    const accepted = await screening.chooseMoodQuestions(again.sessionId, true);
    expect(accepted.next?.instrument).toBe('PHQ9');
    expect(accepted.next?.items).toHaveLength(9);
    const c2 = await screening.submit(again.sessionId, 'PHQ9', answers(9, 0));
    expect(c2.completed).toBe(true);

    // --- lower wellbeing again, but decline the longer questions: results are WHO-5 and GAD-7 only
    const third = await screening.start();
    await screening.submit(third.sessionId, 'WHO5', answers(5, 2));
    const b3 = await screening.submit(third.sessionId, 'GAD7', answers(7, 1));
    expect(b3.choice).toBe('MOOD_QUESTIONS');
    const declined = await screening.chooseMoodQuestions(third.sessionId, false);
    expect(declined.completed).toBe(true);
    expect(declined.next).toBeNull();
    const thirdDetail = await screening.get(third.sessionId);
    expect(thirdDetail.results.map((r) => r.instrument)).toEqual(['WHO5', 'GAD7']);
    await expect(screening.chooseMoodQuestions(third.sessionId, true)).rejects.toMatchObject({
      code: 'SESSION_COMPLETE',
    });

    // The server rejects an instrument out of order (the app resyncs on this)
    await expect(screening.submit(again.sessionId, 'WHO5', answers(5, 3))).rejects.toMatchObject({
      code: expect.stringMatching(/WRONG_INSTRUMENT|SESSION_COMPLETE/),
    });

    // --- consent gate: withdrawing APP_USE blocks screening, re-granting restores it
    const off = await auth.setConsent('APP_USE', false, 'en');
    expect(currentConsent(off.consents, uid, 'APP_USE')).toBe(false);
    await expect(screening.start()).rejects.toBeInstanceOf(ScreeningError);
    await expect(screening.start()).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    const on = await auth.setConsent('APP_USE', true, 'en');
    expect(hasRequiredConsent(on.consents, uid)).toBe(true);
    expect((await screening.start()).next.instrument).toBe('WHO5');

    // --- login from a fresh device with the same credentials
    const fresh = createApiAuthService(memoryKv());
    const loggedIn = await fresh.signIn(mobile, 'E2e-test-pass-123');
    expect(loggedIn.identity.user_id).toBe(uid);
  });
});
