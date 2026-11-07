import type { KeyValueStore } from '@/services/storage';

import { ApiError, apiFetch, jsonInit } from './api';

export const TOKENS_KEY = 'api_tokens';

export type Tokens = { access: string; refresh: string };

export type AuthedClient = {
  readTokens(): Promise<Tokens | null>;
  saveTokens(tokens: Tokens): Promise<void>;
  clearTokens(): Promise<void>;
  /** Authenticated request; refreshes the access token once on 401. */
  authed<T>(path: string, init?: RequestInit): Promise<T>;
};

/**
 * Shared by every service that calls the API as the signed-in user. Tokens live in the
 * key-value store (not in memory), so separate client instances over the same store agree.
 */
export function createAuthedClient(kv: KeyValueStore): AuthedClient {
  async function readTokens(): Promise<Tokens | null> {
    const raw = await kv.get(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  }
  const saveTokens = (tokens: Tokens) => kv.set(TOKENS_KEY, JSON.stringify(tokens));
  const clearTokens = () => kv.remove(TOKENS_KEY);

  async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
    let tokens = await readTokens();
    if (!tokens) throw new ApiError(401, 'You are not signed in.');
    const call = (access: string) =>
      apiFetch<T>(path, {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${access}`,
        },
      });
    try {
      return await call(tokens.access);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      const res = await apiFetch<{ access: string; refresh?: string }>(
        '/auth/refresh/',
        jsonInit('POST', { refresh: tokens.refresh }),
      );
      tokens = { access: res.access, refresh: res.refresh ?? tokens.refresh };
      await saveTokens(tokens);
      return call(tokens.access);
    }
  }

  return { readTokens, saveTokens, clearTokens, authed };
}
