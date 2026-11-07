import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { telUrl } from '@/content/crisis';
import type { Crisis } from '@/domain/screening';

export type CrisisHelpLabels = { call: string; talk: string; talkNote: string };

export function callHotline(number: string) {
  // Devices without telephony reject tel: links; there is nothing more to do in that case.
  Linking.openURL(telUrl(number)).catch(() => {});
}

/**
 * The fixed crisis help: headline, message, hotlines with call buttons, and "talk to a person".
 * The words come from the server's clinician-approved crisis content (or the bundled fallback),
 * never from the AI. Shared by the assessment crisis screen and the journal reply area.
 */
export function CrisisHelp({ crisis, labels }: { crisis: Crisis; labels: CrisisHelpLabels }) {
  const primary = crisis.hotlines.find((h) => /NCMH/i.test(h.name)) ?? crisis.hotlines[0];

  return (
    <View className="gap-4" accessibilityLiveRegion="polite">
      <View className="gap-3">
        <Text className="text-2xl font-bold text-foreground" accessibilityRole="header">
          {crisis.headline}
        </Text>
        <Text className="text-base text-foreground">{crisis.message}</Text>
      </View>

      <View className="gap-3">
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
              <Button title={labels.call} onPress={() => callHotline(h.number)} />
            </View>
          </View>
        ))}
      </View>

      {crisis.talk_to_a_person && primary ? (
        <View className="gap-2">
          <Button title={labels.talk} onPress={() => callHotline(primary.number)} />
          <Text className="text-sm text-muted-foreground">{labels.talkNote}</Text>
        </View>
      ) : null}
    </View>
  );
}
