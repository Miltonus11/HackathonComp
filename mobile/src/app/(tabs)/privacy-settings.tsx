import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Screen } from '@/components/ui/screen';
import { getNotice } from '@/content/privacy-notice';
import { CONSENT_TYPES, currentConsent, type ConsentType } from '@/domain/consent';
import type { LanguageCode } from '@/domain/profile';
import { useAuth } from '@/lib/auth';

export default function PrivacySettings() {
  const { session, setConsent } = useAuth();
  const [language, setLanguage] = useState<LanguageCode>(session?.profile.language_code ?? 'en');
  const [confirmingAppUse, setConfirmingAppUse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;
  const userId = session.identity.user_id;
  const notice = getNotice(language);

  const lastChanged = (type: ConsentType) => {
    const rows = session.consents.filter((c) => c.consent_type === type);
    const last = rows[rows.length - 1];
    // The server returns only current consent state, so the time is known only for
    // changes made on this device since sign-in.
    return last?.decided_at ? new Date(last.decided_at).toLocaleString() : null;
  };

  const change = async (type: ConsentType, granted: boolean) => {
    setError(null);
    try {
      await setConsent(type, granted, language);
    } catch {
      setError('Could not save your choice. Please try again.');
    }
  };

  return (
    <Screen>
      <Text className="pt-4 text-2xl font-bold text-foreground">Privacy & consent</Text>
      <Text className="text-base text-muted-foreground">
        You can change these choices at any time. Each change is saved with the date and language you
        saw.
      </Text>
      <LanguageToggle value={language} onChange={setLanguage} />

      {CONSENT_TYPES.map((type) => {
        const granted = currentConsent(session.consents, userId, type);
        const when = lastChanged(type);
        return (
          <View key={type} className="gap-1">
            <Checkbox
              checked={granted}
              label={notice.consents[type].label}
              description={notice.consents[type].description}
              required={notice.consents[type].required}
              requiredText="Required"
              onChange={(next) => {
                if (type === 'APP_USE' && !next) setConfirmingAppUse(true);
                else void change(type, next);
              }}
            />
            {when ? <Text className="px-1 text-xs text-muted-foreground">Last changed {when}</Text> : null}
          </View>
        );
      })}

      {confirmingAppUse ? (
        <View className="gap-3 rounded-xl border border-destructive bg-card p-4">
          <Text className="text-base font-semibold text-foreground">Withdraw permission to use the app?</Text>
          <Text className="text-sm text-muted-foreground">
            You will not be able to use the app until you agree again. Your account will not be deleted.
          </Text>
          <Button
            title="Withdraw and continue"
            onPress={() => {
              setConfirmingAppUse(false);
              void change('APP_USE', false);
            }}
          />
          <Button title="Keep using the app" variant="secondary" onPress={() => setConfirmingAppUse(false)} />
        </View>
      ) : null}

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      <View className="rounded-xl bg-secondary p-4">
        <Text className="text-sm text-secondary-foreground">
          Export or delete my data — coming soon.
        </Text>
      </View>
    </Screen>
  );
}
