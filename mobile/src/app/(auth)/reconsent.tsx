import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Screen } from '@/components/ui/screen';
import { getNotice } from '@/content/privacy-notice';
import { useAuth } from '@/lib/auth';
import { useOnboardingDraft } from '@/lib/onboarding-draft';

/** Shown when a signed-in user has withdrawn APP_USE consent. */
export default function Reconsent() {
  const { session, hasRequiredConsent, setConsent, signOut } = useAuth();
  const { language, setLanguage } = useOnboardingDraft();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (hasRequiredConsent) return null; // the root guard is swapping to the app

  const notice = getNotice(language);
  const agree = async () => {
    setBusy(true);
    try {
      await setConsent('APP_USE', true, language);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Agree and continue" disabled={!agreed} loading={busy} onPress={agree} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
        </>
      }>
      <LanguageToggle value={language} onChange={setLanguage} />
      <Text className="text-2xl font-bold text-foreground">{notice.title}</Text>
      <Text className="text-base text-muted-foreground">
        You withdrew your permission to use your information. To keep using the app, please read the
        notice and agree again.
      </Text>
      <Text className="text-base text-foreground">{notice.intro}</Text>
      {notice.sections.map((s) => (
        <View key={s.heading} className="gap-1">
          <Text className="text-base font-semibold text-foreground">{s.heading}</Text>
          <Text className="text-base text-muted-foreground">{s.body}</Text>
        </View>
      ))}
      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        label={notice.consents.APP_USE.label}
        description={notice.consents.APP_USE.description}
        required
        requiredText="Required"
      />
    </Screen>
  );
}
