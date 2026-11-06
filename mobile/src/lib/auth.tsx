import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { ApiError, apiFetch, apiPost } from './api';

// Mirrors backend accounts.serializers.UserSerializer
export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
};

type Tokens = { access: string; refresh: string };

type AuthContextValue = {
  user: User | null;
  /** true until the stored session has been checked */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const TOKEN_KEY = 'auth_tokens';

// SecureStore is native-only; fall back to localStorage on web.
const storage = {
  get: async (): Promise<Tokens | null> => {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(TOKEN_KEY)
        : await SecureStore.getItemAsync(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  },
  set: async (tokens: Tokens) => {
    const raw = JSON.stringify(tokens);
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(TOKEN_KEY, raw);
    else await SecureStore.setItemAsync(TOKEN_KEY, raw);
  },
  clear: async () => {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

const fetchMe = (access: string) =>
  apiFetch<User>('/auth/me/', { headers: { Authorization: `Bearer ${access}` } });

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on launch; refresh the access token if it has expired.
  useEffect(() => {
    (async () => {
      try {
        const tokens = await storage.get();
        if (!tokens) return;
        try {
          setUser(await fetchMe(tokens.access));
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e;
          const { access } = await apiPost<{ access: string }>('/auth/refresh/', {
            refresh: tokens.refresh,
          });
          await storage.set({ ...tokens, access });
          setUser(await fetchMe(access));
        }
      } catch {
        await storage.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const tokens = await apiPost<Tokens>('/auth/login/', { email: email.trim(), password });
    const me = await fetchMe(tokens.access);
    await storage.set(tokens);
    setUser(me);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await apiPost<Tokens & { user: User }>('/auth/register/', {
      email: email.trim(),
      password,
    });
    await storage.set({ access: res.access, refresh: res.refresh });
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await storage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
