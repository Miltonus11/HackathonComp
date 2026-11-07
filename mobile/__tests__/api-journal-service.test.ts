import { createAuthedClient } from '@/lib/authed-client';
import {
  createApiJournalService,
  findAfterUnsureSave,
  LIST_LIMIT,
  SAVE_TIMEOUT_MS,
  saveWithRecovery,
} from '@/services/journal-service';
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
const TODAY = '2026-11-07';
const NOW = '2026-11-07T03:00:00Z';

const reply = (over: Json = {}) => ({
  ai_status: 'ok',
  reflection: { message: 'That sounds tiring.', nudge: null },
  crisis: null,
  ...over,
});

/** Fake of backend/wellbeing's journal endpoints. `saveReply` decides what POST returns. */
function fakeJournal(opts: { saveReply?: Json; failPostAfterSaving?: boolean } = {}) {
  const entries: Json[] = [];
  const posts: Json[] = [];
  const paths: string[] = [];
  let n = 0;
  const respond = (status: number, body: unknown) =>
    ({ ok: status < 400, status, statusText: '', json: async () => body }) as Response;

  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+\/api/, '');
    const method = init?.method ?? 'GET';
    paths.push(`${method} ${path}`);
    if (method === 'GET' && path === '/journal/prompt/') {
      return respond(200, { prompt_id: 12, domain: 'SLEEP', text: 'How has your rest been?', source: 'bank' });
    }
    if (method === 'GET' && path.startsWith('/journal/?')) return respond(200, entries);
    if (method === 'POST' && path === '/journal/') {
      const body = JSON.parse(String(init?.body));
      posts.push(body);
      const text = typeof body.body === 'string' ? body.body.trim() : '';
      if (!text) return respond(400, { body: ['This field may not be blank.'] });
      const id = `e${++n}`;
      entries.unshift({ entry_id: id, written_at: NOW, prompt_text: null, body: text, reflection: null });
      if (opts.failPostAfterSaving) throw new TypeError('Network request failed');
      return respond(201, { entry_id: id, written_at: NOW, ...reply(opts.saveReply) });
    }
    const del = path.match(/^\/journal\/([^/]+)\/$/);
    if (method === 'DELETE' && del) {
      const i = entries.findIndex((e) => e.entry_id === del[1]);
      if (i < 0) return respond(404, { detail: 'Not found.' });
      entries.splice(i, 1);
      return respond(204, null);
    }
    return respond(404, { detail: 'nope' });
  });
  return { fetchMock, entries, posts, paths };
}

async function setup(opts?: Parameters<typeof fakeJournal>[0]) {
  const fake = fakeJournal(opts);
  global.fetch = fake.fetchMock as unknown as typeof fetch;
  const client = createAuthedClient(memoryKv());
  await client.saveTokens({ access: 'a', refresh: 'r' });
  return { service: createApiJournalService(client), ...fake };
}

describe('journal service', () => {
  it('loads the prompt', async () => {
    const { service } = await setup();
    expect((await service.prompt()).prompt_id).toBe(12);
  });

  it('saves with the prompt id, or without one for free writing', async () => {
    const { service, posts } = await setup();
    const saved = await service.save('I slept badly.', 12);
    expect(saved.ai_status).toBe('ok');
    expect(saved.reflection?.message).toBe('That sounds tiring.');
    await service.save('Free writing.', null);
    expect(posts).toEqual([{ body: 'I slept badly.', prompt_id: 12 }, { body: 'Free writing.' }]);
  });

  it('passes the crisis payload through untouched', async () => {
    const crisis = { headline: 'H', message: 'M', hotlines: [{ name: 'NCMH', number: '1553', note: '' }], talk_to_a_person: true };
    const { service } = await setup({ saveReply: { ai_status: 'crisis', reflection: null, crisis } });
    const saved = await service.save('text', null);
    expect(saved.ai_status).toBe('crisis');
    expect(saved.crisis).toEqual(crisis);
  });

  it('lists with the server maximum and deletes (204, no body)', async () => {
    const { service, paths } = await setup();
    await service.save('one', null);
    const [first] = await service.list();
    expect(paths).toContain(`GET /journal/?limit=${LIST_LIMIT}`);
    await expect(service.remove(first.entry_id)).resolves.toBeUndefined();
    expect(await service.list()).toEqual([]);
  });

  it('treats deleting an entry that is already gone as done', async () => {
    const { service } = await setup();
    await expect(service.remove('missing')).resolves.toBeUndefined();
  });

  it('maps 400 to INVALID and a network failure to NETWORK', async () => {
    const { service, fetchMock } = await setup();
    await expect(service.save('   ', null)).rejects.toMatchObject({ code: 'INVALID' });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(service.prompt()).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('gives the save a longer time limit than other requests', async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          }),
      ) as unknown as typeof fetch;
      const client = createAuthedClient(memoryKv());
      await client.saveTokens({ access: 'a', refresh: 'r' });
      const service = createApiJournalService(client);

      let settled = false;
      const p = service.save('slow', null).catch((e) => {
        settled = true;
        return e;
      });
      await jest.advanceTimersByTimeAsync(15_000); // past the normal 10 s limit
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS);
      expect(await p).toMatchObject({ code: 'NETWORK' });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('saveWithRecovery', () => {
  it('returns the full answer normally', async () => {
    const { service } = await setup();
    const out = await saveWithRecovery(service, 'hello', 12, TODAY);
    expect(out.kind).toBe('saved');
  });

  it('finds the entry when the answer was lost after the server saved it, and posts only once', async () => {
    const { service, posts } = await setup({ failPostAfterSaving: true });
    const out = await saveWithRecovery(service, '  hello  ', 12, TODAY);
    expect(out).toMatchObject({ kind: 'recovered', entry: { body: 'hello' } });
    expect(posts).toHaveLength(1);
  });

  it('reports a plain failure when nothing was saved', async () => {
    const { service, fetchMock } = await setup();
    fetchMock.mockRejectedValueOnce(new TypeError('offline')); // the POST never reached the server
    const out = await saveWithRecovery(service, 'hello', null, TODAY);
    expect(out).toMatchObject({ kind: 'failed', unsure: false, error: { code: 'NETWORK' } });
  });

  it('is unsure when it cannot even check, and the later check finds it', async () => {
    const { service, fetchMock } = await setup({ failPostAfterSaving: true });
    fetchMock.mockImplementationOnce(fetchMock.getMockImplementation()!); // the POST (saves, then drops)
    fetchMock.mockRejectedValueOnce(new TypeError('offline')); // the check
    const out = await saveWithRecovery(service, 'hello', null, TODAY);
    expect(out).toMatchObject({ kind: 'failed', unsure: true });
    expect((await findAfterUnsureSave(service, 'hello', TODAY))?.body).toBe('hello');
  });

  it('does not look for an entry the server rejected', async () => {
    const { service, paths } = await setup();
    const out = await saveWithRecovery(service, '  ', null, TODAY);
    expect(out).toMatchObject({ kind: 'failed', unsure: false, error: { code: 'INVALID' } });
    expect(paths.filter((p) => p.startsWith('GET'))).toEqual([]);
  });
});
