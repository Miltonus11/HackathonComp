import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { MOOD_DEFAULT, MOOD_MAX, MOOD_MIN, MOOD_REASONS, clampMood, moodEmoji, type MoodReason } from '@/domain/mood';
import { getMoodUi } from '@/content/mood-ui';
import type { LanguageCode } from '@/domain/profile';

type Props = {
  visible: boolean;
  lang: LanguageCode;
  /** Resolves when saved; throws when it could not be. The dialog closes when `visible` goes false. */
  onSubmit: (score: number, reason: MoodReason | null) => Promise<void>;
};

/**
 * The daily mood pop-up. It cannot be dismissed: there is no close button, tapping outside does
 * nothing, and the Android back button is ignored. It goes away only when the mood is saved.
 * Save stays disabled until the person has moved the slider, so a default value is never recorded.
 */
function MoodDialogBody({ lang, onSubmit }: Omit<Props, 'visible'>) {
  const ui = getMoodUi(lang);
  const [score, setScore] = useState(MOOD_DEFAULT);
  const [touched, setTouched] = useState(false);
  const [reason, setReason] = useState<MoodReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await onSubmit(score, reason);
    } catch {
      setFailed(true); // the chosen value and reason stay as they are
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-black/50 px-5">
      <View className="max-h-[90%] w-full max-w-md rounded-3xl bg-card">
        <ScrollView contentContainerClassName="gap-5 p-6" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
              {ui.title}
            </Text>
            <Text className="text-sm text-muted-foreground">{ui.subtitle}</Text>
          </View>

          <View className="items-center gap-1">
            {/* The face changes as the slider moves; it is dimmed until the person chooses. */}
            <Text style={{ fontSize: 72, lineHeight: 88, opacity: touched ? 1 : 0.35 }}>
              {moodEmoji(touched ? score : 5)}
            </Text>
            <Text className="text-xl font-semibold text-foreground">
              {touched ? ui.label(score) : ui.hint}
            </Text>
          </View>

          <View className="gap-1">
            <Slider
              accessibilityLabel={ui.title}
              accessibilityValue={{ min: MOOD_MIN, max: MOOD_MAX, now: score, text: touched ? ui.label(score) : undefined }}
              minimumValue={MOOD_MIN}
              maximumValue={MOOD_MAX}
              step={1}
              value={score}
              onValueChange={(v) => {
                setScore(clampMood(v));
                setTouched(true);
              }}
              minimumTrackTintColor="#7008e7"
              maximumTrackTintColor="#e5e5e5"
              thumbTintColor="#7008e7"
              style={{ height: 44 }}
            />
            <View className="flex-row items-center justify-between px-1">
              <Text className="flex-1 text-left text-sm text-muted-foreground">{ui.scaleLow}</Text>
              <Text className="flex-1 text-center text-sm text-muted-foreground">{ui.scaleMid}</Text>
              <Text className="flex-1 text-right text-sm text-muted-foreground">{ui.scaleHigh}</Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">{ui.reasonTitle}</Text>
            <View className="flex-row flex-wrap gap-2">
              {MOOD_REASONS.map((r) => {
                const selected = r === reason;
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-11 justify-center rounded-full border px-4 py-2 ${
                      selected ? 'border-primary bg-primary' : 'border-input bg-card'
                    }`}
                    onPress={() => setReason(selected ? null : r)}>
                    <Text
                      className={`text-sm font-medium ${
                        selected ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                      {ui.reasons[r]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {failed ? <Text className="text-sm text-destructive">{ui.error}</Text> : null}
          <Button
            title={failed ? ui.retry : ui.save}
            loading={saving}
            disabled={!touched}
            onPress={save}
          />
        </ScrollView>
      </View>
    </View>
  );
}

export function MoodDialog({ visible, lang, onSubmit }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}>
      {/* Mounted only while open, so every new day starts with a clean slider, reason and error. */}
      <MoodDialogBody lang={lang} onSubmit={onSubmit} />
    </Modal>
  );
}
