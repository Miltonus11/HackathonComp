import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import type { Result } from '@/domain/screening';
import { useAssessmentFlow } from '@/lib/assessment-flow';
import { dismissAssessmentPrompt } from '@/lib/assessment-prompt';
import { gentleAdvice } from '../../../gentle-results';
import { useAuth } from '@/lib/auth';
import { useAssessmentUi } from '@/lib/use-assessment-ui';

export default function Results() {
  const router = useRouter();
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const { results, refreshResults, viewResults, reset } = useAssessmentFlow();
  const { refreshSession } = useAuth();
  const { ui } = useAssessmentUi();

  // Opened from Home for an earlier check-in: load that session. Otherwise prefer the server's
  // copy of the one just finished over what we accumulated locally.
  useEffect(() => {
    (sessionParam ? viewResults(sessionParam) : refreshResults()).catch(() => {});
  }, [sessionParam, viewResults, refreshResults]);

  const done = async () => {
    // The server marks onboarding complete when the last questionnaire is saved; pick that up so
    // Home does not send the person straight back into the assessment.
    await refreshSession().catch(() => {});
    dismissAssessmentPrompt();
    reset();
    router.replace('/');
  };

  return (
    <Screen footer={<Button title={ui.results.done} onPress={done} />}>
      <View className="gap-2 pt-4">
        <Text className="text-3xl font-bold text-foreground">{ui.results.title}</Text>
        <Text className="text-base text-muted-foreground">{ui.results.lead}</Text>
      </View>

      {results.length === 0 ? <Text className="text-base text-muted-foreground">{ui.results.loading}</Text> : null}

      {results.map((r) => (
        <ResultCard key={r.instrument} result={r} />
      ))}

      <Text className="text-sm text-muted-foreground">{ui.results.disclaimer}</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/assessment/crisis', params: { mode: 'help' } })}>
        <Text className="text-base font-semibold text-primary">{ui.results.needHelp}</Text>
      </Pressable>
    </Screen>
  );
}

function ResultCard({ result }: { result: Result }) {
  const { ui, lang } = useAssessmentUi();
  // Messages only: no severity label, band or score is shown to the person.
  const message = gentleAdvice(result.advice, lang);

  return (
    <View className="gap-2 rounded-2xl border border-border bg-card p-5">
      <Text className="text-sm font-semibold uppercase text-muted-foreground">
        {ui.instrumentTitle[result.instrument]}
      </Text>
      {message ? (
        <>
          <Text className="text-lg font-semibold text-foreground">{message.headline}</Text>
          <Text className="text-base text-muted-foreground">{message.message}</Text>
        </>
      ) : null}
    </View>
  );
}