import Constants from 'expo-constants';
import { Platform } from 'react-native';

// In dev, Expo knows the PC's LAN address (hostUri = "192.168.x.x:8081"), which works for
// both physical devices and emulators. Fall back to 10.0.2.2 (Android emulator -> host).
// Set EXPO_PUBLIC_API_URL to override.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const DEFAULT_HOST = devHost ?? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${DEFAULT_HOST}:8000/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** DRF field errors, e.g. { mobile_number: ['…'] }; empty for non-field errors */
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

// DRF validation errors look like { field: ['message', …] }; `detail` is a non-field error.
function fieldErrors(body: unknown): Record<string, string[]> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === 'detail') continue;
    out[key] = Array.isArray(value) ? value.map(String) : [String(value)];
  }
  return out;
}

// DRF returns `{detail}` or `{field: [messages]}`; flatten either into one string.
function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const parts = Object.values(body as Record<string, unknown>).flatMap((v) =>
    Array.isArray(v) ? v.map(String) : [String(v)],
  );
  return parts.join('\n') || fallback;
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // fetch has no default timeout, so an unreachable address would hang forever.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    // Reported as a TypeError so callers treat it like any other network failure.
    if (e instanceof Error && e.name === 'AbortError') {
      throw new TypeError(`Request to ${API_URL} timed out`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorMessage(body, `API ${res.status}: ${res.statusText}`),
      fieldErrors(body),
    );
  }
  return res.json() as Promise<T>;
}

export function apiPost<T>(path: string, data: unknown, token?: string): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
}

export const jsonInit = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
