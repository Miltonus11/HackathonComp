import { useCallback, useEffect, useRef, useState } from 'react';

import type { JournalEntry, JournalPrompt, SaveResponse } from '@/domain/journal';
import {
  findAfterUnsureSave,
  JournalError,
  saveWithRecovery,
  type JournalService,
  type SaveOutcome,
} from '@/services/journal-service';

/**
 * What came back when an entry was saved in this app session. Kept in memory only: the list
 * endpoint returns the reflection again later, but not the crisis or "unavailable" outcome.
 */
export type ReplyState = { kind: 'response'; response: SaveResponse } | { kind: 'recovered' };

type Phase = 'loading' | 'ready' | 'error';
export type PromptState = { status: 'loading' } | { status: 'ready'; prompt: JournalPrompt | null };

/**
 * Journal data for one Philippine day. Does nothing until `enabled` (today's mood is logged and
 * the server's date is known), because the prompt's tone depends on today's mood.
 * Nothing the person writes is stored on the phone; drafts live in screen state only.
 */
export function useJournal({
  today,
  enabled,
  service,
}: {
  today: string | null;
  enabled: boolean;
  /** Usually `journalService` from '@/lib/journal'; injected so tests need no native storage. */
  service: JournalService;
}) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  // Keyed by day, so a new day reads as "loading" without setting state inside an effect.
  const [loaded, setLoaded] = useState<{ day: string; prompt: JournalPrompt | null } | null>(null);
  const prompt: PromptState =
    loaded && loaded.day === today ? { status: 'ready', prompt: loaded.prompt } : { status: 'loading' };
  const [replies, setReplies] = useState<Record<string, ReplyState>>({});
  // After an "unsure" failure, the next save checks the server first (no duplicates).
  const unsureBody = useRef<string | null>(null);
  // Deleted in this session: a list request that started before the delete must not bring it back.
  const deleted = useRef(new Set<string>());

  /** `quiet`: a background re-check that keeps what is on screen if it fails. */
  const reload = useCallback(
    async (quiet = false) => {
      if (!enabled) return;
      try {
        const list = await service.list();
        setEntries(list.filter((e) => !deleted.current.has(e.entry_id)));
        setPhase('ready');
      } catch {
        // A quiet re-check keeps what is already on screen.
        setPhase((p) => (quiet && p === 'ready' ? p : 'error'));
      }
    },
    [enabled, service],
  );

  /** For the "Try again" button after a failed load. */
  const retry = useCallback(() => {
    setPhase('loading');
    return reload();
  }, [reload]);

  // List: first load, and again whenever the day changes.
  useEffect(() => {
    if (enabled && today) reload();
  }, [enabled, today, reload]);

  // Prompt: once per day. A failure is not an error for the screen; it falls back to free writing.
  useEffect(() => {
    if (!enabled || !today) return;
    let cancelled = false;
    const day = today;
    service
      .prompt()
      .then((p) => {
        if (!cancelled) setLoaded({ day, prompt: p.prompt_id == null || !p.text ? null : p });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ day, prompt: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, today, service]);

  const remember = useCallback((entry: JournalEntry, reply: ReplyState) => {
    setEntries((list) => [entry, ...list.filter((e) => e.entry_id !== entry.entry_id)]);
    setReplies((r) => ({ ...r, [entry.entry_id]: reply }));
  }, []);

  const save = useCallback(
    async (body: string, promptId: number | null, promptText: string | null): Promise<SaveOutcome> => {
      if (!today) return { kind: 'failed', error: new JournalError('SERVER', 'Not ready yet.'), unsure: false };

      if (unsureBody.current === body) {
        try {
          const found = await findAfterUnsureSave(service, body, today);
          if (found) {
            unsureBody.current = null;
            remember(found, { kind: 'recovered' });
            return { kind: 'recovered', entry: found };
          }
        } catch (e) {
          const error = e instanceof JournalError ? e : new JournalError('NETWORK', 'Could not reach the server.');
          return { kind: 'failed', error, unsure: true }; // still cannot tell, so do not send again
        }
        unsureBody.current = null; // checked: it is not there, safe to send
      }

      const outcome = await saveWithRecovery(service, body, promptId, today);
      if (outcome.kind === 'saved') {
        const r = outcome.response;
        remember(
          { entry_id: r.entry_id, written_at: r.written_at, prompt_text: promptText, body: body.trim(), reflection: r.reflection },
          { kind: 'response', response: r },
        );
        reload(true); // pick up the server's copy (e.g. the reviewed prompt text)
      } else if (outcome.kind === 'recovered') {
        remember(outcome.entry, { kind: 'recovered' });
      } else if (outcome.unsure) {
        unsureBody.current = body;
      }
      return outcome;
    },
    [today, service, remember, reload],
  );

  /** Throws a JournalError if it could not be deleted. */
  const remove = useCallback(
    async (entryId: string) => {
      await service.remove(entryId);
      deleted.current.add(entryId);
      setEntries((list) => list.filter((e) => e.entry_id !== entryId));
      setReplies((r) => {
        const next = { ...r };
        delete next[entryId];
        return next;
      });
    },
    [service],
  );

  return { phase, entries, prompt, replies, reload, retry, save, remove };
}
