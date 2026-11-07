import { createAuthedClient } from '@/lib/authed-client';
import { createApiScreeningService } from '@/services/api-screening-service';
import { ScreeningError } from '@/services/screening-service';
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

const FORM_BASE = { name: 'x', recall_period_days: 14, min_response: 0, options: ['a', 'b', 'c', 'd'], items: [] };
const form = (code: string) => ({ ...FORM_BASE, instrument: code, max_response: code === 'WHO5' ? 5 : 3 });

/** Fake of /api/screening/* that mirrors backend/screening/flow.py. */
function fakeScreening() {
  const done = new Map<string, number | null>(); // instrument -> WHO5 scaled
  let accepted: boolean | null = null; // the "more mood questions" choice
  const bodies: Json[] = [];
  const force: { next?: [number, Json] } = {};
  let calls = 0;

  const nextCode = () => {
    if (!done.has('WHO5')) return 'WHO5';
    if (!done.has('GAD7')) return 'GAD7';
    if ((done.get('WHO5') as number) < 52) return accepted === true && !done.has('PHQ9') ? 'PHQ9' : null;
    return done.has('PHQ9_ITEM9') ? null : 'PHQ9_ITEM9';
  };
  const pending = () =>
    done.has('WHO5') && done.has('GAD7') && (done.get('WHO5') as number) < 52 && !done.has('PHQ9') && accepted === null;

  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    calls++;
    const path = url.replace(/^https?:\/\/[^/]+\/api/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    let out: [number, Json];
    if (force.next) {
      out = force.next;
      force.next = undefined;
    } else if (method === 'POST' && path === '/screening/sessions/') {
      out = [201, { session_id: 'sess-1', next: form('WHO5') }];
    } else if (method === 'GET' && path === '/screening/sessions/') {
      out = [200, [{ session_id: 'sess-1', started_at: 't', completed_at: null, crisis_shown: false, results: [] }]];
    } else if (method === 'GET' && path === '/screening/sessions/sess-1/') {
      out = [200, { session_id: 'sess-1', started_at: 't', completed_at: null, completed: false, crisis_shown: false, crisis: null, results: [], next: form('WHO5') }];
    } else if (method === 'POST' && path === '/screening/sessions/sess-1/answers/') {
      bodies.push(body);
      const code: string = body.instrument;
      const raw = body.responses.reduce((s: number, r: Json) => s + r.value, 0);
      const scaled = code === 'WHO5' ? raw * 4 : null;
      done.set(code, scaled);
      const n = nextCode();
      const crisis =
        (code === 'WHO5' && scaled! <= 28) || (code === 'PHQ9_ITEM9' && raw > 0)
          ? { headline: 'h', message: 'm', hotlines: [{ name: 'NCMH', number: '1553', note: '' }], talk_to_a_person: true }
          : null;
      out = [200, { crisis, result: { instrument: code, raw_score: raw, scaled_score: scaled === null ? null : String(scaled), severity_code: 'X', label: 'X', advice: null }, next: n ? form(n) : null, choice: pending() ? 'MOOD_QUESTIONS' : null, completed: n === null && !pending() }];
    } else if (method === 'POST' && path === '/screening/sessions/sess-1/choice/') {
      bodies.push(body);
      if (!pending()) {
        out = [400, { code: 'no_choice_pending', detail: 'x' }];
      } else {
        accepted = body.accept === true;
        const n = nextCode();
        out = [200, { next: n ? form(n) : null, choice: null, completed: n === null }];
      }
    } else {
      out = [404, { detail: 'nope' }];
    }
    return { ok: out[0] < 400, status: out[0], statusText: String(out[0]), json: async () => out[1] } as Response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { bodies, force, calls: () => calls };
}

async function signedInService() {
  const kv = memoryKv();
  const client = createAuthedClient(kv);
  await client.saveTokens({ access: 'a', refresh: 'r' });
  return createApiScreeningService(client);
}

const answers = (n: number, v: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, v]));
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as ScreeningError;
  }
  throw new Error('expected a rejection');
};

describe('api screening service', () => {
  it('start returns the session id and the WHO-5 form', async () => {
    fakeScreening();
    const svc = await signedInService();
    const s = await svc.start();
    expect(s.sessionId).toBe('sess-1');
    expect(s.next.instrument).toBe('WHO5');
  });

  it('good wellbeing: WHO5 -> GAD7 -> item 9 only -> completed', async () => {
    fakeScreening();
    const svc = await signedInService();
    const a = await svc.submit('sess-1', 'WHO5', answers(5, 4));
    expect(a.next?.instrument).toBe('GAD7');
    const b = await svc.submit('sess-1', 'GAD7', answers(7, 0));
    expect(b.next?.instrument).toBe('PHQ9_ITEM9');
    const c = await svc.submit('sess-1', 'PHQ9_ITEM9', { 1: 0 });
    expect(c.completed).toBe(true);
    expect(c.next).toBeNull();
    expect(c.crisis).toBeNull();
  });

  it('low wellbeing: GAD7 is followed by the choice, not by the questions', async () => {
    fakeScreening();
    const svc = await signedInService();
    await svc.submit('sess-1', 'WHO5', answers(5, 2)); // raw 10 -> 40
    const b = await svc.submit('sess-1', 'GAD7', answers(7, 1));
    expect(b.choice).toBe('MOOD_QUESTIONS');
    expect(b.next).toBeNull();
    expect(b.completed).toBe(false);
  });

  it('accepting the choice returns the longer mood questions, then completes', async () => {
    const be = fakeScreening();
    const svc = await signedInService();
    await svc.submit('sess-1', 'WHO5', answers(5, 2));
    await svc.submit('sess-1', 'GAD7', answers(7, 1));
    const c = await svc.chooseMoodQuestions('sess-1', true);
    expect(be.bodies[be.bodies.length - 1]).toEqual({ accept: true });
    expect(c.next?.instrument).toBe('PHQ9');
    expect(c.completed).toBe(false);
    const d = await svc.submit('sess-1', 'PHQ9', answers(9, 0));
    expect(d.completed).toBe(true);
    expect(d.choice).toBeNull();
  });

  it('declining the choice completes with no more questions', async () => {
    fakeScreening();
    const svc = await signedInService();
    await svc.submit('sess-1', 'WHO5', answers(5, 2));
    await svc.submit('sess-1', 'GAD7', answers(7, 1));
    const c = await svc.chooseMoodQuestions('sess-1', false);
    expect(c.completed).toBe(true);
    expect(c.next).toBeNull();
  });

  it('good wellbeing is never offered the choice', async () => {
    fakeScreening();
    const svc = await signedInService();
    const a = await svc.submit('sess-1', 'WHO5', answers(5, 4));
    const b = await svc.submit('sess-1', 'GAD7', answers(7, 0));
    expect(a.choice).toBeNull();
    expect(b.choice).toBeNull();
    await expect(svc.chooseMoodQuestions('sess-1', true)).rejects.toMatchObject({ code: 'NO_CHOICE_PENDING' });
  });

  it('passes the crisis block through (very low WHO-5 and positive item 9)', async () => {
    fakeScreening();
    const svc = await signedInService();
    const a = await svc.submit('sess-1', 'WHO5', answers(5, 1)); // raw 5 -> 20
    expect(a.crisis?.hotlines[0].number).toBe('1553');
    expect(a.next?.instrument).toBe('GAD7');
  });

  it('sends answers as a list of {item_no, value} ordered by item', async () => {
    const be = fakeScreening();
    const svc = await signedInService();
    await svc.submit('sess-1', 'WHO5', { 3: 1, 1: 5, 2: 4, 5: 0, 4: 2 });
    expect(be.bodies[0]).toEqual({
      instrument: 'WHO5',
      responses: [
        { item_no: 1, value: 5 },
        { item_no: 2, value: 4 },
        { item_no: 3, value: 1 },
        { item_no: 4, value: 2 },
        { item_no: 5, value: 0 },
      ],
    });
  });

  it('lists and fetches sessions', async () => {
    fakeScreening();
    const svc = await signedInService();
    expect((await svc.list())[0].session_id).toBe('sess-1');
    const d = await svc.get('sess-1');
    expect(d.completed).toBe(false);
    expect(d.next?.instrument).toBe('WHO5');
  });

  it.each([
    [403, { code: 'consent_required', detail: 'x' }, 'CONSENT_REQUIRED'],
    [403, { code: 'profile_required', detail: 'x' }, 'PROFILE_REQUIRED'],
    [400, { code: 'wrong_instrument', detail: 'x' }, 'WRONG_INSTRUMENT'],
    [400, { code: 'invalid_responses', detail: 'x' }, 'INVALID_RESPONSES'],
    [400, { code: 'choice_required', detail: 'x' }, 'CHOICE_REQUIRED'],
    [400, { code: 'no_choice_pending', detail: 'x' }, 'NO_CHOICE_PENDING'],
    [409, { code: 'session_complete', detail: 'x' }, 'SESSION_COMPLETE'],
    [500, { detail: 'boom' }, 'SERVER'],
  ])('maps %i %j to %s', async (status, body, code) => {
    const be = fakeScreening();
    const svc = await signedInService();
    be.force.next = [status, body];
    expect((await failure(svc.start())).code).toBe(code);
  });

  it('reports NETWORK when the server cannot be reached', async () => {
    fakeScreening();
    const svc = await signedInService();
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect((await failure(svc.submit('sess-1', 'WHO5', answers(5, 3)))).code).toBe('NETWORK');
  });

  it('reports NOT_SIGNED_IN without tokens and makes no request', async () => {
    const be = fakeScreening();
    const svc = createApiScreeningService(createAuthedClient(memoryKv()));
    expect((await failure(svc.start())).code).toBe('NOT_SIGNED_IN');
    expect(be.calls()).toBe(0);
  });
});
