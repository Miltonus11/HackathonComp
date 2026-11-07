import { Stack } from 'expo-router';

import { OnboardingDraftProvider } from '@/lib/onboarding-draft';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingDraftProvider>
  );
}
