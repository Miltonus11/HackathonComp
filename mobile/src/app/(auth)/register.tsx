import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChipSelect } from '@/components/ui/chip-select';
import { Screen } from '@/components/ui/screen';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { SECTOR_LABELS, SEX_LABELS } from '@/content/options';
import { NOTICE_VERSION } from '@/content/privacy-notice';
import { SECTORS, SEXES, type Sector, type Sex } from '@/domain/profile';
import { validateRegistration } from '@/domain/validation';
import { useAuth } from '@/lib/auth';
import { useOnboardingDraft } from '@/lib/onboarding-draft';
import { useBarangays } from '@/lib/use-barangays';
import { AuthError } from '@/services/auth-service';

const STEP1_FIELDS = ['birth_year', 'sex', 'sector', 'barangay_id'];

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { language, consents } = useOnboardingDraft();
  const { barangays, loading: barangaysLoading, error: barangaysError, reload } = useBarangays();

  const [step, setStep] = useState<1 | 2>(1);
  const [birthYear, setBirthYear] = useState('');
  const [sex, setSex] = useState<Sex>();
  const [sector, setSector] = useState<Sector>();
  const [barangayId, setBarangayId] = useState<number>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [followUp, setFollowUp] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reached without agreeing to the notice (e.g. deep link or reload): go back to it.
  if (!consents.APP_USE) return <Redirect href="/privacy" />;

  const fields = () => ({
    username,
    first_name: firstName,
    last_name: lastName,
    mobile,
    password,
    confirm_password: confirm,
    birth_year: birthYear,
    sex,
    sector,
    barangay_id: barangayId,
  });

  const next = () => {
    const all = validateRegistration(fields());
    const step1 = Object.fromEntries(Object.entries(all).filter(([k]) => STEP1_FIELDS.includes(k)));
    setErrors(step1);
    if (Object.keys(step1).length === 0) setStep(2);
  };

  const submit = async () => {
    const all = validateRegistration(fields());
    setErrors(all);
    setFormError(null);
    if (Object.keys(all).length > 0) {
      if (Object.keys(all).some((k) => STEP1_FIELDS.includes(k))) setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      await signUp({
        mobile,
        password,
        first_name: firstName,
        last_name: lastName,
        display_name: username,
        contact_for_followup: followUp,
        birth_year: Number(birthYear),
        sex: sex!,
        sector: sector!,
        barangay_id: barangayId!,
        language_code: language,
        consents,
        notice_version: NOTICE_VERSION,
      });
      // The root guard now swaps to the signed-in screens.
    } catch (e) {
      setSubmitting(false);
      if (e instanceof AuthError && e.code === 'CONSENT_REQUIRED') {
        router.replace('/privacy');
      } else if (e instanceof AuthError && Object.keys(e.fields).length > 0) {
        // Server-side field errors (taken number, password rules, invalid values)
        setErrors(e.fields);
        if (Object.keys(e.fields).some((k) => STEP1_FIELDS.includes(k))) setStep(1);
      } else {
        setFormError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    }
  };

  return (
    <Screen
      footer={
        step === 1 ? (
          <>
            <Button title="Next" onPress={next} />
            <Button title="Back" variant="ghost" onPress={() => router.back()} />
          </>
        ) : (
          <>
            {formError ? <Text className="text-sm text-destructive">{formError}</Text> : null}
            <Button title="Create account" loading={submitting} onPress={submit} />
            <Button title="Back" variant="ghost" disabled={submitting} onPress={() => setStep(1)} />
          </>
        )
      }>
      <Text className="text-sm font-semibold text-primary">Step {step} of 2</Text>

      {step === 1 ? (
        <View className="gap-5">
          <Text className="text-2xl font-bold text-foreground">About you</Text>
          <Text className="text-base text-muted-foreground">
            Used to suggest the right support and for anonymous city-wide reports.
          </Text>
          <TextField
            label="Year of birth"
            required
            keyboardType="number-pad"
            maxLength={4}
            placeholder="e.g. 2001"
            value={birthYear}
            onChangeText={setBirthYear}
            error={errors.birth_year}
          />
          <ChipSelect
            label="Sex"
            required
            value={sex}
            onChange={setSex}
            options={SEXES.map((v) => ({ value: v, label: SEX_LABELS[v][language] }))}
            error={errors.sex}
          />
          <ChipSelect
            label="Sector"
            required
            value={sector}
            onChange={setSector}
            options={SECTORS.map((v) => ({ value: v, label: SECTOR_LABELS[v][language] }))}
            error={errors.sector}
          />
          <SelectField
            label="Barangay"
            required
            placeholder={barangaysLoading ? 'Loading barangays…' : 'Choose your barangay'}
            value={barangayId}
            onChange={setBarangayId}
            options={barangays.map((b) => ({ value: b.barangay_id, label: b.name }))}
            error={errors.barangay_id ?? barangaysError}
          />
          {barangaysError ? (
            <Button title="Try loading barangays again" variant="secondary" onPress={reload} />
          ) : null}
        </View>
      ) : (
        <View className="gap-5">
          <Text className="text-2xl font-bold text-foreground">Your account</Text>
          <TextField
            label="Username"
            required
            hint="This is the name shown in the app. Your real name is never shown."
            autoComplete="username-new"
            maxLength={30}
            value={username}
            onChangeText={setUsername}
            error={errors.username}
          />
          <TextField
            label="First name"
            hint="Kept private and never shown in the app."
            required
            autoCapitalize="words"
            autoComplete="given-name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.first_name}
          />
          <TextField
            label="Last name"
            required
            autoCapitalize="words"
            autoComplete="family-name"
            value={lastName}
            onChangeText={setLastName}
            error={errors.last_name}
          />
          <TextField
            label="Mobile number"
            required
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0917 123 4567"
            value={mobile}
            onChangeText={setMobile}
            error={errors.mobile}
          />
          {errors.mobile?.includes('already registered') ? (
            <Link href="/login" replace>
              <Text className="font-semibold text-primary">Log in instead</Text>
            </Link>
          ) : null}
          <TextField
            label="Password"
            required
            secure
            hint="At least 8 characters."
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
          <TextField
            label="Confirm password"
            required
            secure
            autoComplete="new-password"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm_password}
          />
          <Checkbox
            checked={followUp}
            onChange={setFollowUp}
            label="It is OK to contact me for follow-up."
            description="Optional. Only used if someone needs to reach you about your safety or a referral."
          />
        </View>
      )}
    </Screen>
  );
}
