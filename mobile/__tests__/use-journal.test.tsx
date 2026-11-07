import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { JournalEntry, SaveResponse } from '@/domain/journal';
import { useJournal } from '@/lib/use-journal';
import { JournalError, type JournalService } from '@/services/journal-service';

const TODAY = '2026-11-07';
const NOW = '2026-11-07T03:00:00Z';

/** In-memory service. `dropNextSave` saves but then loses the answer, like a dropped connection. */
function fakeService() {
  const entries: JournalEntry[] = [];
  const state = { dropNextSave: false, listDown: false, saves: 0 };
  let n = 0;
  const service: JournalService = {
    prompt: jest.fn(async () => ({ prompt_id: 3, domain: 'SLEEP' as const, text: 'How did you sleep?', source: 'bank' as const })),
    list: jest.fn(async () => {
      if (state.listDown) throw new JournalError('NETWORK', 'offline');
      return [...entries];
    }),
    save: jest.fn(async (body: string): Promise<SaveResponse> => {
      state.saves++;
      const e: JournalEntry = { entry_id: `e${++n}`, written_at: NOW, prompt_text: null, body: body.trim(), reflection: null };
      entries.unshift(e);
      if (state.dropNextSave) {
        state.dropNextSave = false;
        throw new JournalError('NETWORK', 'dropped');
      }
      return { entry_id: e.entry_id, written_at: NOW, reflection: null, ai_status: 'crisis', crisis: null };
    }),
    remove: jest.fn(async (id: string) => {
      const i = entries.findIndex((e) => e.entry_id === id);
      if (i >= 0) entries.splice(i, 1);
    }),
  };
  return { service, entries, state };
}

async function setup() {
  const fake = fakeService();
  const hook = await renderHook(() => useJournal({ today: TODAY, enabled: true, service: fake.service }));
  await waitFor(() => expect(hook.result.current.phase).toBe('ready'));
  await waitFor(() => expect(hook.result.current.prompt.status).toBe('ready'));
  return { ...fake, hook };
}

describe('useJournal', () => {
  it('waits for the mood (does nothing while disabled)', async () => {
    const { service } = fakeService();
    await renderHook(() => useJournal({ today: TODAY, enabled: false, service }));
    expect(service.list).not.toHaveBeenCalled();
    expect(service.prompt).not.toHaveBeenCalled();
  });

  it('remembers the crisis outcome for the saved entry', async () => {
    const { hook } = await setup();
    await act(async () => {
      await hook.result.current.save('hello', 3, 'How did you sleep?');
    });
    const [entry] = hook.result.current.entries;
    expect(entry.body).toBe('hello');
    expect(hook.result.current.replies[entry.entry_id]).toMatchObject({ kind: 'response', response: { ai_status: 'crisis' } });
  });

  it('after an unsure failure, checks the server first and never sends a duplicate', async () => {
    const { hook, state, service } = await setup();
    state.dropNextSave = true;
    state.listDown = true; // the check right after the drop fails too
    let first;
    await act(async () => {
      first = await hook.result.current.save('hello', null, null);
    });
    expect(first).toMatchObject({ kind: 'failed', unsure: true });

    state.listDown = false;
    let second;
    await act(async () => {
      second = await hook.result.current.save('hello', null, null);
    });
    expect(second).toMatchObject({ kind: 'recovered' });
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(hook.result.current.entries).toHaveLength(1);
  });

  it('deleting removes the entry and its remembered reply', async () => {
    const { hook } = await setup();
    await act(async () => {
      await hook.result.current.save('hello', null, null);
    });
    const id = hook.result.current.entries[0].entry_id;
    await act(async () => {
      await hook.result.current.remove(id);
    });
    expect(hook.result.current.entries).toEqual([]);
    expect(hook.result.current.replies[id]).toBeUndefined();
  });
});
