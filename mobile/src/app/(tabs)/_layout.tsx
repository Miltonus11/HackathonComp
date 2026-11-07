import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { shouldAutoStartAssessment } from '@/domain/screening';
import { isAssessmentPromptDismissed } from '@/lib/assessment-prompt';
import { useAuth } from '@/lib/auth';
import { USE_MOCK } from '@/services/config';

export default function TabsLayout() {
  const { session } = useAuth();

  // First time (the server has not marked onboarding complete): go straight to the
  // check-in. "Maybe later" is remembered until the next sign-in. No mock mode for screening.
  const autoStart =
    !USE_MOCK &&
    !!session &&
    shouldAutoStartAssessment({
      onboardingCompletedAt: session.profile.onboarding_completed_at,
      dismissedThisSession: isAssessmentPromptDismissed(),
    });
  if (autoStart) return <Redirect href="/assessment" />;

  return <AppTabs />;
}
