import Constants from 'expo-constants';
import { Platform } from 'react-native';

// In dev, Expo knows the PC's LAN address (hostUri = "192.168.x.x:8081"), which works for
// both physical devices and emulators. Fall back to 10.0.2.2 (Android emulator -> host).
// Set EXPO_PUBLIC_API_URL to override.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const DEFAULT_HOST = devHost ?? (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${DEFAULT_HOST}:8000/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// DRF returns `{detail}` or `{field: [messages]}`; flatten either into one string.
function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const parts = Object.values(body as Record<string, unknown>).flatMap((v) =>
    Array.isArray(v) ? v.map(String) : [String(v)],
  );
  return parts.join('\n') || fallback;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(body, `API ${res.status}: ${res.statusText}`));
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
