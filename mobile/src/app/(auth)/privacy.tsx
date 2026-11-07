import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Screen } from '@/components/ui/screen';
import { CONSENT_TYPES } from '@/domain/consent';
import { getNotice } from '@/content/privacy-notice';
import { useOnboardingDraft } from '@/lib/onboarding-draft';

const UI = {
  en: { back: 'Back', next: 'Continue', required: 'Required', hint: 'Tick the required box to continue.' },
  fil: { back: 'Bumalik', next: 'Magpatuloy', required: 'Kailangan', hint: 'I-tick ang kailangang kahon para magpatuloy.' },
} as const;

export default function Privacy() {
  const router = useRouter();
  const { language, setLanguage, consents, setConsent } = useOnboardingDraft();
  const notice = getNotice(language);
  const ui = UI[language];
  const canContinue = consents.APP_USE;

  return (
    <Screen
      footer={
        <>
          {!canContinue ? <Text className="text-center text-sm text-muted-foreground">{ui.hint}</Text> : null}
          <Button title={ui.next} disabled={!canContinue} onPress={() => router.push('/register')} />
          <Button title={ui.back} variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <LanguageToggle value={language} onChange={setLanguage} />
      <Text className="text-2xl font-bold text-foreground">{notice.title}</Text>
      <View className="rounded-xl bg-secondary px-4 py-2">
        <Text className="text-xs font-semibold text-secondary-foreground">{notice.draftBanner}</Text>
      </View>
      <Text className="text-base text-foreground">{notice.intro}</Text>

      {notice.sections.map((s) => (
        <View key={s.heading} className="gap-1">
          <Text className="text-base font-semibold text-foreground">{s.heading}</Text>
          <Text className="text-base text-muted-foreground">{s.body}</Text>
        </View>
      ))}

      <View className="gap-3 pt-2">
        {CONSENT_TYPES.map((type) => (
          <Checkbox
            key={type}
            checked={consents[type]}
            onChange={(v) => setConsent(type, v)}
            label={notice.consents[type].label}
            description={notice.consents[type].description}
            required={notice.consents[type].required}
            requiredText={ui.required}
          />
        ))}
      </View>
      <Text className="text-sm text-muted-foreground">{notice.footer}</Text>
    </Screen>
  );
}
