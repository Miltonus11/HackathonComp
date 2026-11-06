const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export type AuthTokens = { access: string; refresh: string };

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
};

/** Error carrying DRF's response body: `detail` and/or per-field message lists. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown> | null,
  ) {
    super(ApiError.format(status, body));
  }

  /** Per-field messages, e.g. { email: "A user with this email already exists." } */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.body ?? {})) {
      if (k === "detail") continue;
      out[k] = Array.isArray(v) ? v.join(" ") : String(v);
    }
    return out;
  }

  private static format(status: number, body: Record<string, unknown> | null) {
    if (typeof body?.detail === "string") return body.detail;
    const first = body && Object.values(body)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    return `Request failed (${status})`;
  }
}

// --- token storage (localStorage; guarded for SSR) ---

const ACCESS = "access";
const REFRESH = "refresh";

export function getAccessToken() {
  return typeof window === "undefined" ? null : localStorage.getItem(ACCESS);
}

export function isLoggedIn() {
  return getAccessToken() !== null;
}

function saveTokens(t: Partial<AuthTokens>) {
  if (t.access) localStorage.setItem(ACCESS, t.access);
  if (t.refresh) localStorage.setItem(REFRESH, t.refresh);
}

export function logout() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

// --- requests ---

async function request<T>(path: string, init: RequestInit = {}, token?: string | null) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, { detail: "Cannot reach the server. Is the backend running?" });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function apiFetch<T>(path: string, init?: RequestInit) {
  return request<T>(path, init);
}

/** Authenticated request: refreshes the access token once on 401, logs out if that fails. */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init, getAccessToken());
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const refresh = localStorage.getItem(REFRESH);
  if (!refresh) {
    logout();
    throw new ApiError(401, { detail: "Session expired. Please log in again." });
  }
  try {
    const t = await request<{ access: string; refresh?: string }>("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    });
    saveTokens(t);
    return await request<T>(path, init, t.access);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) logout();
    throw err;
  }
}

// --- auth ---

export async function login(email: string, password: string) {
  const tokens = await request<AuthTokens>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  saveTokens(tokens);
  return tokens;
}

export async function register(data: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}) {
  const res = await request<{ user: User } & AuthTokens>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({ ...data, email: data.email.trim().toLowerCase() }),
  });
  saveTokens(res);
  return res.user;
}

export function getMe() {
  return authFetch<User>("/auth/me/");
}
