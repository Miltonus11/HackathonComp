import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { getFallbackCrisis, telUrl } from '@/content/crisis';
import { useAssessmentFlow } from '@/lib/assessment-flow';
import { useAssessmentUi } from '@/lib/use-assessment-ui';

function call(number: string) {
  // Devices without telephony reject tel: links; there is nothing more to do in that case.
  Linking.openURL(telUrl(number)).catch(() => {});
}

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
  const primary = crisis.hotlines.find((h) => /NCMH/i.test(h.name)) ?? crisis.hotlines[0];

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
      <View className="gap-3 pt-4">
        <Text className="text-2xl font-bold text-foreground">{crisis.headline}</Text>
        <Text className="text-base text-foreground">{crisis.message}</Text>
      </View>

      <View className="gap-3 pt-2">
        {crisis.hotlines.map((h) => (
          <View
            key={`${h.name}-${h.number}`}
            className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-foreground">{h.name}</Text>
              <Text className="text-lg font-bold text-primary">{h.number}</Text>
              {h.note ? <Text className="text-sm text-muted-foreground">{h.note}</Text> : null}
            </View>
            <View className="w-24">
              <Button title={ui.crisis.call} onPress={() => call(h.number)} />
            </View>
          </View>
        ))}
      </View>

      {crisis.talk_to_a_person && primary ? (
        <View className="gap-2 pt-2">
          <Button title={ui.crisis.talk} onPress={() => call(primary.number)} />
          <Text className="text-sm text-muted-foreground">{ui.crisis.talkNote}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
