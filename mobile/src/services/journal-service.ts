import { findSavedEntry, type JournalEntry, type JournalPrompt, type SaveResponse } from '@/domain/journal';
import { ApiError, jsonInit } from '@/lib/api';
import type { AuthedClient } from '@/lib/authed-client';

export type JournalErrorCode = 'INVALID' | 'NOT_SIGNED_IN' | 'NETWORK' | 'SERVER';

export class JournalError extends Error {
  constructor(
    public code: JournalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'JournalError';
  }
}

/**
 * The save waits for the server's AI steps (risk check about 5 s, then the reply about 10 s), so it
 * gets a longer limit than the usual 10 s. It is never retried automatically: see `saveWithRecovery`.
 */
export const SAVE_TIMEOUT_MS = 30_000;

/** The server's own ceiling; enough to cover every day back to registration in practice. */
export const LIST_LIMIT = 200;

export interface JournalService {
  prompt(): Promise<JournalPrompt>;
  /** Newest first. */
  list(): Promise<JournalEntry[]>;
  save(body: string, promptId: number | null): Promise<SaveResponse>;
  /** Hard delete. Deleting something already gone counts as done. */
  remove(entryId: string): Promise<void>;
}

function toJournalError(e: unknown): JournalError {
  if (e instanceof JournalError) return e;
  if (e instanceof TypeError) {
    return new JournalError('NETWORK', 'Could not reach the server. Check your connection and try again.');
  }
  if (e instanceof ApiError) {
    if (e.status === 401) return new JournalError('NOT_SIGNED_IN', 'Your session has expired. Please log in again.');
    if (e.status === 400) return new JournalError('INVALID', e.message);
  }
  return new JournalError('SERVER', 'Something went wrong on our side. Please try again.');
}

export function createApiJournalService(client: AuthedClient): JournalService {
  async function call<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
    try {
      return await client.authed<T>(path, init, timeoutMs ? { timeoutMs } : undefined);
    } catch (e) {
      throw toJournalError(e);
    }
  }

  return {
    prompt: () => call<JournalPrompt>('/journal/prompt/'),
    list: () => call<JournalEntry[]>(`/journal/?limit=${LIST_LIMIT}`),
    save: (body, promptId) =>
      call<SaveResponse>(
        '/journal/',
        jsonInit('POST', promptId == null ? { body } : { body, prompt_id: promptId }),
        SAVE_TIMEOUT_MS,
      ),
    async remove(entryId) {
      try {
        await client.authed<void>(`/journal/${encodeURIComponent(entryId)}/`, { method: 'DELETE' });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return;
        throw toJournalError(e);
      }
    },
  };
}

export type SaveOutcome =
  /** The normal case: the server's full answer, including any reply or crisis help. */
  | { kind: 'saved'; response: SaveResponse }
  /** The answer was lost, but the entry is on the server. There is no reply to show. */
  | { kind: 'recovered'; entry: JournalEntry }
  /**
   * Not saved, or we could not find out. `unsure` is true when the server may have it after all,
   * in which case the screen re-checks before offering to send it again.
   */
  | { kind: 'failed'; error: JournalError; unsure: boolean };

/**
 * Save once, never retrying by itself. If the request fails in a way that could have happened after
 * the server saved it (network drop, timeout, server error), reload the list and look for it, so a
 * "Try again" never creates a duplicate.
 */
export async function saveWithRecovery(
  service: JournalService,
  body: string,
  promptId: number | null,
  today: string,
): Promise<SaveOutcome> {
  try {
    return { kind: 'saved', response: await service.save(body, promptId) };
  } catch (e) {
    const error = toJournalError(e);
    // Rejected before saving: nothing to look for.
    if (error.code === 'INVALID' || error.code === 'NOT_SIGNED_IN') return { kind: 'failed', error, unsure: false };
    try {
      const found = findSavedEntry(await service.list(), body, today);
      return found ? { kind: 'recovered', entry: found } : { kind: 'failed', error, unsure: false };
    } catch {
      return { kind: 'failed', error, unsure: true };
    }
  }
}

/** Use before re-sending after an `unsure` failure. */
export async function findAfterUnsureSave(
  service: JournalService,
  body: string,
  today: string,
): Promise<JournalEntry | null> {
  return findSavedEntry(await service.list(), body, today);
}
