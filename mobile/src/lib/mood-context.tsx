import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import type { MoodEntry, MoodReason } from '@/domain/mood';

import { useAuth } from './auth';
import { moodService } from './mood';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type MoodContextValue = {
  status: Status;
  /** null until the server has answered */
  logged: boolean | null;
  /** Today's saved entry, once known. Later features (journal prompts) can read it. */
  entry: MoodEntry | null;
  refresh: () => Promise<void>;
  /** Throws a MoodError on failure so the dialog can keep the person's answer. */
  submit: (score: number, reason: MoodReason | null) => Promise<void>;
};

const MoodContext = createContext<MoodContextValue | null>(null);

/**
 * Knows whether today's mood is logged. Checked when the person is signed in, whenever the app
 * comes back to the foreground (so a new day is noticed), and when a screen asks (Home and Journal
 * call `refresh` on focus). "Today" is decided by the server (Philippine time), never the phone.
 */
export function MoodProvider({ children }: { children: React.ReactNode }) {
  const { session, hasRequiredConsent } = useAuth();
  const signedIn = !!session && hasRequiredConsent;
  // A new key remounts the inner provider, so every sign-in/out starts from a clean state.
  return (
    <MoodInner key={signedIn ? session.identity.user_id : 'signed-out'} signedIn={signedIn}>
      {children}
    </MoodInner>
  );
}

function MoodInner({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>(signedIn ? 'loading' : 'idle');
  const [logged, setLogged] = useState<boolean | null>(null);
  const [entry, setEntry] = useState<MoodEntry | null>(null);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const t = await moodService.today();
      setLogged(t.logged);
      setEntry(t.entry);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error')); // keep the last good answer if re-checking fails
    }
  }, [signedIn]);

  const submit = useCallback(async (score: number, reason: MoodReason | null) => {
    const saved = await moodService.log(score, reason);
    setEntry(saved);
    setLogged(true);
    setStatus('ready');
  }, []);

  // First check for this sign-in. (Later checks come from screens and the foreground listener.)
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    moodService
      .today()
      .then((t) => {
        if (cancelled) return;
        setLogged(t.logged);
        setEntry(t.entry);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({ status, logged, entry, refresh, submit }),
    [status, logged, entry, refresh, submit],
  );
  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error('useMood must be used within MoodProvider');
  return ctx;
}
