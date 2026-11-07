import { Text, View } from 'react-native';

import { MoodGate } from '@/components/mood-gate';
import { Screen } from '@/components/ui/screen';
import { getMoodUi } from '@/content/mood-ui';
import { useAuth } from '@/lib/auth';

/**
 * Placeholder journal. The real journal (guided prompt, writing, AI reflection) comes later and
 * will read today's mood from `useMood().entry`. The mood dialog is already enforced here for
 * everyone, which is how first-time users meet it.
 */
export default function Journal() {
  const { session } = useAuth();
  const ui = getMoodUi(session?.profile.language_code ?? 'en');

  return (
    <Screen>
      <MoodGate where="journal" />
      <View className="gap-2 pt-6">
        <Text className="text-3xl font-bold text-foreground">{ui.journal.title}</Text>
        <Text className="text-base text-muted-foreground">{ui.journal.body}</Text>
      </View>
    </Screen>
  );
}
