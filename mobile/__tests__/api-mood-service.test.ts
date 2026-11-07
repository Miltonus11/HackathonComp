import { createAuthedClient } from '@/lib/authed-client';
import { createApiMoodService } from '@/services/mood-service';
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
const entry = (score: number, reason: string | null = null) => ({
  id: 'e1', entry_date: '2026-11-07', mood_score: score, reason_code: reason, logged_at: 't',
});

/** Fake of backend/wellbeing: one entry per day, 409 on a second POST. */
function fakeMood(opts: { preLogged?: Json } = {}) {
  let saved: Json | null = opts.preLogged ?? null;
  const posts: Json[] = [];
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+\/api/, '');
    const method = init?.method ?? 'GET';
    let out: [number, Json];
    if (method === 'GET' && path === '/mood/today/') {
      out = [200, { date: '2026-11-07', logged: !!saved, entry: saved }];
    } else if (method === 'POST' && path === '/mood/') {
      const body = JSON.parse(String(init?.body));
      posts.push(body);
      if (body.mood_score < 1 || body.mood_score > 10) out = [400, { mood_score: ['Out of range.'] }];
      else if (saved) out = [409, { code: 'already_logged', detail: "Today's mood is already logged." }];
      else {
        saved = entry(body.mood_score, body.reason_code ?? null);
        out = [201, saved];
      }
    } else out = [404, { detail: 'nope' }];
    return { ok: out[0] < 400, status: out[0], statusText: '', json: async () => out[1] } as Response;
  });
  return { fetchMock, posts };
}

async function setup(opts?: Parameters<typeof fakeMood>[0]) {
  const fake = fakeMood(opts);
  global.fetch = fake.fetchMock as unknown as typeof fetch;
  const client = createAuthedClient(memoryKv());
  await client.saveTokens({ access: 'a', refresh: 'r' });
  return { service: createApiMoodService(client), ...fake };
}

describe('mood service', () => {
  it('reports not logged, then logged after saving', async () => {
    const { service, posts } = await setup();
    expect((await service.today()).logged).toBe(false);
    const saved = await service.log(7, 'SLEEP');
    expect(saved.mood_score).toBe(7);
    expect(posts[0]).toEqual({ mood_score: 7, reason_code: 'SLEEP' });
    expect((await service.today()).logged).toBe(true);
  });

  it('sends no reason_code when none is chosen', async () => {
    const { service, posts } = await setup();
    await service.log(4, null);
    expect(posts[0]).toEqual({ mood_score: 4 });
  });

  it('treats 409 already_logged as success and returns the existing entry', async () => {
    const { service } = await setup({ preLogged: entry(9) });
    const e = await service.log(2, null);
    expect(e.mood_score).toBe(9);
  });

  it('maps a network failure to NETWORK', async () => {
    const { service, fetchMock } = await setup();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(service.today()).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('maps 400 to INVALID and 500 to SERVER', async () => {
    const { service, fetchMock } = await setup();
    // The app clamps to 1..10 itself, so force a server-side 400 to check the mapping.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, statusText: '', json: async () => ({ mood_score: ['Bad.'] }) } as Response);
    await expect(service.log(5, null)).rejects.toMatchObject({ code: 'INVALID' });
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, statusText: 'x', json: async () => ({}) }) as Response) as unknown as typeof fetch;
    await expect(service.today()).rejects.toMatchObject({ code: 'SERVER' });
  });
});
