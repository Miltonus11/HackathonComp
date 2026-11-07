import { getAssessmentUi } from '@/content/assessment-ui';
import type { LanguageCode } from '@/domain/profile';

import { useAuth } from './auth';

/** Assessment text and language for the signed-in user (defaults to English). */
export function useAssessmentUi() {
  const { session } = useAuth();
  const lang: LanguageCode = session?.profile.language_code ?? 'en';
  return { lang, ui: getAssessmentUi(lang) };
}
