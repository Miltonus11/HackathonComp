import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { optionLabel, type Form } from '@/domain/screening';
import { useAssessmentFlow } from '@/lib/assessment-flow';
import { dismissAssessmentPrompt } from '@/lib/assessment-prompt';
import { useAssessmentUi } from '@/lib/use-assessment-ui';
import { ScreeningError } from '@/services/screening-service';

export default function Question() {
  const { form, completed, choicePending } = useAssessmentFlow();
  if (completed) return <Redirect href="/assessment/results" />;
  if (choicePending) return <Redirect href="/assessment/choice" />;
  if (!form) return <Redirect href="/assessment" />;
  // key: a new instrument starts again at its first question
  return <InstrumentQuestions key={form.instrument} form={form} />;
}

function InstrumentQuestions({ form }: { form: Form }) {
  const router = useRouter();
  const { answers, setAnswer, submit, busy } = useAssessmentFlow();
  const { ui } = useAssessmentUi();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const total = form.items.length;
  const item = form.items[index];
  const isLast = index === total - 1;
  const current = answers[item.item_no];
  const answered = current !== undefined;
  const values = Array.from({ length: form.max_response - form.min_response + 1 }, (_, i) => form.min_response + i);
  const weeks = form.recall_period_days ? Math.max(1, Math.round(form.recall_period_days / 7)) : null;
  const isFrequency = form.instrument !== 'WHO5';

  const next = async () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setError(null);
    try {
      const where = await submit();
      if (where === 'crisis') router.push('/assessment/crisis');
      else if (where === 'results') router.replace('/assessment/results');
      // 'question': the flow moved to the next instrument and this screen restarts with a new key
    } catch (e) {
      setError(e instanceof ScreeningError ? ui.errors[e.code] : ui.errors.SERVER);
    }
  };

  return (
    <Screen
      footer={
        <>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          {busy ? <Text className="text-center text-sm text-muted-foreground">{ui.question.sending}</Text> : null}
          <Button
            title={isLast ? ui.question.finish : ui.question.next}
            disabled={!answered}
            loading={busy}
            onPress={next}
          />
          {index > 0 ? (
            <Button title={ui.question.back} variant="ghost" disabled={busy} onPress={() => setIndex((i) => i - 1)} />
          ) : null}
        </>
      }>
      <View className="flex-row items-center justify-between pt-2">
        <Text className="text-sm font-semibold text-primary">{ui.instrumentIntro[form.instrument]}</Text>
        <Pressable accessibilityRole="button" hitSlop={10} disabled={busy}
          onPress={() => {
            // Progress is already saved on the server; do not bounce straight back in.
            dismissAssessmentPrompt();
            router.replace('/');
          }}>
          <Text className="text-sm font-semibold text-muted-foreground">{ui.question.saveExit}</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-sm text-muted-foreground">{ui.question.of(index + 1, total)}</Text>
        <View className="h-2 overflow-hidden rounded-full bg-secondary">
          <View
            className="h-2 rounded-full bg-primary"
            style={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
          />
        </View>
      </View>

      <View className="gap-1 pt-2">
        {weeks ? <Text className="text-sm text-muted-foreground">{ui.question.recall(weeks)}</Text> : null}
        {isFrequency ? <Text className="text-sm text-muted-foreground">{ui.question.howOften}</Text> : null}
        <Text className="text-xl font-semibold text-foreground">{item.text}</Text>
      </View>

      <View className="gap-3 pt-2" accessibilityRole="radiogroup">
        {values.map((v) => {
          const selected = current === v;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              disabled={busy}
              className={`min-h-14 justify-center rounded-xl border px-4 py-3 ${
                selected ? 'border-primary bg-primary' : 'border-input bg-card'
              }`}
              onPress={() => setAnswer(item.item_no, v)}>
              <Text
                className={`text-base font-medium ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
                {optionLabel(form, v)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
