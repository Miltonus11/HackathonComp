import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { CrisisHelp } from '@/components/crisis-help';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { getFallbackCrisis } from '@/content/crisis';
import { useAssessmentFlow } from '@/lib/assessment-flow';
import { useAssessmentUi } from '@/lib/use-assessment-ui';

/**
 * Crisis help. Shown before the next questionnaire when an answer triggers it, and on demand
 * (`?mode=help`) from the intro. Content comes from the server, or bundled hotlines if absent.
 */
export default function CrisisScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const flow = useAssessmentFlow();
  const { lang, ui } = useAssessmentUi();

  const helpOnly = mode === 'help' || !flow.crisis;
  const crisis = helpOnly ? getFallbackCrisis(lang) : flow.crisis!;

  const carryOn = () => {
    if (helpOnly) {
      router.back();
      return;
    }
    if (flow.dismissCrisis() === 'results') router.replace('/assessment/results');
    else router.back();
  };

  return (
    <Screen
      footer={<Button title={helpOnly ? ui.crisis.back : ui.crisis.continue} variant="secondary" onPress={carryOn} />}>
      <View className="pt-4">
        <CrisisHelp crisis={crisis} labels={ui.crisis} />
      </View>
    </Screen>
  );
}
