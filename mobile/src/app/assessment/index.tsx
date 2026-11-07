import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useAssessmentFlow } from '@/lib/assessment-flow';
import { dismissAssessmentPrompt } from '@/lib/assessment-prompt';
import { useAssessmentUi } from '@/lib/use-assessment-ui';
import { ScreeningError } from '@/services/screening-service';

export default function AssessmentIntro() {
  const router = useRouter();
  const { begin, busy } = useAssessmentFlow();
  const { ui } = useAssessmentUi();
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      await begin();
      router.replace('/assessment/question');
    } catch (e) {
      setError(e instanceof ScreeningError ? ui.errors[e.code] : ui.errors.SERVER);
    }
  };

  return (
    <Screen
      footer={
        <>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <Button title={ui.intro.start} loading={busy} onPress={start} />
          <Button title={ui.intro.later} variant="ghost" disabled={busy}
            onPress={() => {
              // Remembered until the next sign-in; Home keeps the check-in card.
              dismissAssessmentPrompt();
              router.replace('/');
            }}
          />
        </>
      }>
      <View className="gap-4 pt-6">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary">
          <Text className="text-3xl text-primary-foreground">✓</Text>
        </View>
        <Text className="text-3xl font-bold text-foreground">{ui.intro.title}</Text>
        <Text className="text-base text-foreground">{ui.intro.lead}</Text>
        <View className="gap-2">
          {ui.intro.points.map((p) => (
            <Text key={p} className="text-base text-muted-foreground">
              •  {p}
            </Text>
          ))}
        </View>
        <Text className="text-sm text-muted-foreground">{ui.intro.notDiagnosis}</Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/assessment/crisis', params: { mode: 'help' } })}>
          <Text className="text-base font-semibold text-primary">{ui.intro.needHelp}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
