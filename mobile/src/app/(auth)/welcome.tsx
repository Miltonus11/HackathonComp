import { Redirect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { APP_NAME, Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';
import { useOnboardingDraft } from '@/lib/onboarding-draft';

const COPY = {
  en: {
    hello: 'Welcome. Take a breath, you are in a safe place.',
    tagline: 'A private space to check in on how you are feeling and find support in San Fernando.',
    note: 'This app offers screening and guidance. It does not diagnose and is not a replacement for a professional.',
    start: 'Get started',
    login: 'I already have an account',
  },
  fil: {
    hello: 'Maligayang pagdating. Huminga ka muna, ligtas ka rito.',
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
      <View className="items-end">
        <LanguageToggle value={language} onChange={setLanguage} />
      </View>
      <View className="items-center gap-5 pt-6">
        <Logo height={150} />
        <View className="items-center gap-2">
          <Text className="text-4xl font-bold tracking-tight text-primary" accessibilityRole="header">
            {APP_NAME}
          </Text>
          <Text className="text-center text-lg font-medium text-foreground">{copy.hello}</Text>
        </View>
      </View>
      <View className="gap-3 rounded-3xl bg-card/80 p-5">
        <Text className="text-center text-base leading-6 text-foreground">{copy.tagline}</Text>
        <Text className="text-center text-sm leading-5 text-muted-foreground">{copy.note}</Text>
      </View>
    </Screen>
  );
}
