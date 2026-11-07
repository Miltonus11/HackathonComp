import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { hasRequiredConsent as ledgerHasRequired, type ConsentType } from '@/domain/consent';
import type { LanguageCode } from '@/domain/profile';
import type { RegistrationInput, Session } from '@/services/auth-service';
import { resetAssessmentPrompt } from './assessment-prompt';
import { createApiAuthService } from '@/services/api-auth-service';
import { USE_MOCK } from '@/services/config';
import { createMockAuthService } from '@/services/mock-auth-service';

// Real API by default; set EXPO_PUBLIC_USE_MOCK=1 to run offline against the on-device mock.
const authService = USE_MOCK ? createMockAuthService() : createApiAuthService();

type AuthContextValue = {
  session: Session | null;
  /** true until the stored session has been checked */
  loading: boolean;
  /** Signed in AND the APP_USE consent is currently granted */
  hasRequiredConsent: boolean;
  signIn: (mobile: string, password: string) => Promise<void>;
  signUp: (input: RegistrationInput) => Promise<void>;
  signOut: () => Promise<void>;
  setConsent: (type: ConsentType, granted: boolean, language: LanguageCode) => Promise<void>;
  /** Re-reads the account from the server (e.g. onboarding_completed_at after the assessment). */
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService
      .restore()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (mobile: string, password: string) => {
    resetAssessmentPrompt();
    setSession(await authService.signIn(mobile, password));
  }, []);

  const signUp = useCallback(async (input: RegistrationInput) => {
    resetAssessmentPrompt();
    setSession(await authService.register(input));
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    resetAssessmentPrompt();
    setSession(null);
  }, []);

  const setConsent = useCallback(
    async (type: ConsentType, granted: boolean, language: LanguageCode) => {
      setSession(await authService.setConsent(type, granted, language));
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    const fresh = await authService.restore();
    if (fresh) setSession(fresh);
  }, []);

  const hasRequiredConsent = !!session && ledgerHasRequired(session.consents, session.identity.user_id);

  const value = useMemo(
    () => ({ session, loading, hasRequiredConsent, signIn, signUp, signOut, setConsent, refreshSession }),
    [session, loading, hasRequiredConsent, signIn, signUp, signOut, setConsent, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
