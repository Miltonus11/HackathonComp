import { Stack } from 'expo-router';

import { AssessmentFlowProvider } from '@/lib/assessment-flow';

export default function AssessmentLayout() {
  return (
    <AssessmentFlowProvider>
      {/* Swipe-back is off so a submitted instrument cannot be re-answered and the crisis
          screen cannot be skipped by accident. */}
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
    </AssessmentFlowProvider>
  );
}
