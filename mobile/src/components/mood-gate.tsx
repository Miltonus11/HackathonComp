import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { MoodDialog } from '@/components/mood-dialog';
import { Button } from '@/components/ui/button';
import { getMoodUi } from '@/content/mood-ui';
import { shouldShowMoodGate, type MoodGateWhere } from '@/domain/mood';
import { useAuth } from '@/lib/auth';
import { useMood } from '@/lib/mood-context';

/**
 * Put this on a screen that must have today's mood logged first. It re-checks when the screen
 * comes into focus, shows the unskippable dialog when needed, and, if the check itself failed,
 * shows a retry card instead of trapping the person behind a dialog that cannot be answered.
 */
export function MoodGate({ where }: { where: MoodGateWhere }) {
  const { session } = useAuth();
  const { status, logged, refresh, submit } = useMood();
  const lang = session?.profile.language_code ?? 'en';
  const ui = getMoodUi(lang);
  // Tab screens stay mounted; only the focused one may open the dialog, or two could stack.
  const focused = useIsFocused();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const show = shouldShowMoodGate({
    where,
    logged,
    onboardingCompleted: !!session?.profile.onboarding_completed_at,
  });

  return (
    <>
      {status === 'error' && logged === null ? (
        <View className="gap-3 rounded-3xl border border-border bg-card p-5">
          <Text className="text-base text-foreground">{ui.loadError}</Text>
          <Button title={ui.loadRetry} variant="secondary" onPress={refresh} />
        </View>
      ) : null}
      <MoodDialog visible={show && focused} lang={lang} onSubmit={submit} />
    </>
  );
}

