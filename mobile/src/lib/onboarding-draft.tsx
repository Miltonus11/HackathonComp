import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { ConsentType } from '@/domain/consent';
import type { LanguageCode } from '@/domain/profile';

/**
 * Choices made before an account exists. Nothing here is persisted: consents are written
 * only when registration succeeds, so backing out leaves no trace.
 */
type Draft = {
  language: LanguageCode;
  setLanguage: (l: LanguageCode) => void;
  consents: Record<ConsentType, boolean>;
  setConsent: (type: ConsentType, granted: boolean) => void;
  reset: () => void;
};

const INITIAL_CONSENTS: Record<ConsentType, boolean> = {
  APP_USE: false,
  AI_ANALYSIS: false,
  PROFESSIONAL_SHARING: false,
};

const DraftContext = createContext<Draft | null>(null);

export function OnboardingDraftProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [consents, setConsents] = useState(INITIAL_CONSENTS);

  const setConsent = useCallback(
    (type: ConsentType, granted: boolean) => setConsents((c) => ({ ...c, [type]: granted })),
    [],
  );
  const reset = useCallback(() => {
    setLanguage('en');
    setConsents(INITIAL_CONSENTS);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage, consents, setConsent, reset }),
    [language, consents, setConsent, reset],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useOnboardingDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used within OnboardingDraftProvider');
  return ctx;
}
