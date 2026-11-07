import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/lib/auth';
import { AuthError } from '@/services/auth-service';

export default function Login() {
  const { signIn } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!mobile.trim() || !password) {
      setError('Enter your mobile number and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(mobile, password);
      // The root guard swaps to the signed-in screens.
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Screen
      footer={
        <>
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <Button title="Log in" loading={submitting} onPress={submit} />
          <View className="flex-row justify-center gap-1 pt-1">
            <Text className="text-muted-foreground">New here?</Text>
            <Link href="/welcome" replace>
              <Text className="font-semibold text-primary">Get started</Text>
            </Link>
          </View>
        </>
      }>
      <View className="gap-1 pt-6">
        <Text className="text-3xl font-bold text-foreground">Welcome back</Text>
        <Text className="text-base text-muted-foreground">Log in with your mobile number.</Text>
      </View>
      <TextField
        label="Mobile number"
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="0917 123 4567"
        value={mobile}
        onChangeText={setMobile}
        editable={!submitting}
      />
      <TextField
        label="Password"
        secure
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        editable={!submitting}
      />
      <Text className="text-sm text-muted-foreground">Forgot password? Coming soon.</Text>
    </Screen>
  );
}
