import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';
import { useOnboardingDraft } from '@/lib/onboarding-draft';

const COPY = {
  en: {
    tagline: 'A private space to check in on how you are feeling and find support in San Fernando.',
    note: 'This app offers screening and guidance. It does not diagnose and is not a replacement for a professional.',
    start: 'Get started',
    login: 'I already have an account',
  },
  fil: {
    tagline: 'Pribadong lugar para suriin ang iyong nararamdaman at humanap ng suporta sa San Fernando.',
    note: 'Nag-aalok ang app na ito ng screening at gabay. Hindi ito nagdidiyagnos at hindi pamalit sa propesyonal.',
    start: 'Magsimula',
    login: 'May account na ako',
  },
} as const;

export default function Welcome() {
  const router = useRouter();
  const { session, hasRequiredConsent } = useAuth();
  const { language, setLanguage } = useOnboardingDraft();
  const copy = COPY[language];

  // Signed in but APP_USE was withdrawn: ask for consent again before anything else.
  if (session && !hasRequiredConsent) return <Redirect href="/reconsent" />;

  return (
    <Screen
      footer={
        <>
          <Button title={copy.start} onPress={() => router.push('/privacy')} />
          <Button title={copy.login} variant="ghost" onPress={() => router.push('/login')} />
        </>
      }>
      <View className="gap-6 pt-8">
        <LanguageToggle value={language} onChange={setLanguage} />
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Text className="text-3xl font-bold text-primary-foreground">♥</Text>
        </View>
        <View className="gap-3">
          <Text className="text-3xl font-bold text-foreground">San Fernando Mind Care</Text>
          <Text className="text-base text-foreground">{copy.tagline}</Text>
          <Text className="text-sm text-muted-foreground">{copy.note}</Text>
        </View>
      </View>
    </Screen>
  );
}
