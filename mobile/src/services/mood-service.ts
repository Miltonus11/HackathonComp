import type { MoodEntry, MoodReason, MoodToday } from '@/domain/mood';
import { toSubmission } from '@/domain/mood';
import { ApiError, jsonInit } from '@/lib/api';
import type { AuthedClient } from '@/lib/authed-client';

export type MoodErrorCode = 'INVALID' | 'NOT_SIGNED_IN' | 'NETWORK' | 'SERVER';

export class MoodError extends Error {
  constructor(
    public code: MoodErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MoodError';
  }
}

export interface MoodService {
  today(): Promise<MoodToday>;
  /**
   * Save today's mood. If the server says it is already logged (409), that is not a failure: the
   * existing entry is loaded and returned, so the dialog just closes.
   */
  log(score: number, reason: MoodReason | null): Promise<MoodEntry>;
}

function toMoodError(e: unknown): MoodError {
  if (e instanceof MoodError) return e;
  if (e instanceof TypeError) {
    return new MoodError('NETWORK', 'Could not reach the server. Check your connection and try again.');
  }
  if (e instanceof ApiError) {
    if (e.status === 401) return new MoodError('NOT_SIGNED_IN', 'Your session has expired. Please log in again.');
    if (e.status === 400) return new MoodError('INVALID', e.message);
  }
  return new MoodError('SERVER', 'Something went wrong on our side. Please try again.');
}

export function createApiMoodService(client: AuthedClient): MoodService {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      return await client.authed<T>(path, init);
    } catch (e) {
      throw e instanceof ApiError && e.status === 409 ? e : toMoodError(e);
    }
  }

  const today = () => call<MoodToday>('/mood/today/');

  return {
    today,

    async log(score, reason) {
      try {
        return await call<MoodEntry>('/mood/', jsonInit('POST', toSubmission(score, reason)));
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && e.fields.code?.[0] === 'already_logged') {
          const t = await today();
          if (t.entry) return t.entry;
        }
        throw toMoodError(e);
      }
    },
  };
}
