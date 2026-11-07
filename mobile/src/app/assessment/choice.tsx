import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useAssessmentFlow } from '@/lib/assessment-flow';
import { useAssessmentUi } from '@/lib/use-assessment-ui';
import { ScreeningError } from '@/services/screening-service';

/**
 * Asked after the first two questionnaires when the wellbeing result is not good: would the
 * person like to answer a few more questions about their mood? The longer questionnaire is
 * never named. Yes continues the flow; No goes straight to the results.
 */
export default function Choice() {
  const router = useRouter();
  const { choicePending, completed, chooseMoodQuestions, busy } = useAssessmentFlow();
  const { ui } = useAssessmentUi();
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<'yes' | 'no' | null>(null);

  // These redirects also carry the person onward once the choice has been recorded.
  if (completed) return <Redirect href="/assessment/results" />;
  if (!choicePending) return <Redirect href="/assessment/question" />;

  const choose = async (accept: boolean) => {
    setError(null);
    setAnswered(accept ? 'yes' : 'no');
    try {
      await chooseMoodQuestions(accept);
    } catch (e) {
      setAnswered(null);
      setError(e instanceof ScreeningError ? ui.errors[e.code] : ui.errors.SERVER);
    }
  };

  return (
    <Screen
      footer={
        <>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <Button title={ui.choice.yes} loading={busy && answered === 'yes'} disabled={busy} onPress={() => choose(true)} />
          <Button
            title={ui.choice.no}
            variant="secondary"
            loading={busy && answered === 'no'}
            disabled={busy}
            onPress={() => choose(false)}
          />
        </>
      }>
      <View className="flex-1 justify-center gap-4 pt-10">
        <View className="gap-3 rounded-3xl border border-border bg-card p-6">
          <Text className="text-2xl font-bold text-foreground">{ui.choice.title}</Text>
          <Text className="text-base text-foreground">{ui.choice.body}</Text>
          <Text className="text-sm text-muted-foreground">{ui.choice.skipNote}</Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/assessment/crisis', params: { mode: 'help' } })}>
          <Text className="text-base font-semibold text-primary">{ui.choice.needHelp}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
