import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  mode: 'login' | 'signup';
  onSubmit: (email: string, password: string) => Promise<void>;
};

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Log in to your account',
    button: 'Log in',
    switchText: "Don't have an account?",
    switchLink: 'Sign up',
    switchHref: '/signup',
  },
  signup: {
    title: 'Create account',
    subtitle: 'Sign up with your email',
    button: 'Sign up',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchHref: '/login',
  },
} as const;

export function AuthForm({ mode, onSubmit }: Props) {
  const copy = COPY[mode];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(email, password);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? 'Could not reach the server. Check your connection and API URL.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong.',
      );
      setSubmitting(false);
    }
    // On success the root layout swaps to the signed-in screens, unmounting this form.
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-100"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled">
        {/* Brand header: swap the logo placeholder and app name for your own */}
        <View className="items-center gap-3 mb-6">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-blue-500">
            <Text className="text-2xl font-bold text-white">L</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900">App Name</Text>
        </View>

        <View
          className="w-full max-w-md self-center gap-4 rounded-3xl bg-white p-6 shadow-md"
          style={{ elevation: 4 }}>
          <View className="gap-1 mb-2">
            <Text className="text-2xl font-bold text-gray-900">{copy.title}</Text>
            <Text className="text-base text-gray-500">{copy.subtitle}</Text>
          </View>

          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
          />
          <View className="justify-center">
            <TextInput
              className="border border-gray-300 rounded-xl pl-4 pr-16 py-3 text-base text-gray-900"
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              editable={!submitting}
            />
            <Pressable
              className="absolute right-4"
              hitSlop={8}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((v) => !v)}>
              <SymbolView
                tintColor="#6b7280"
                name={{
                  ios: showPassword ? 'eye.slash' : 'eye',
                  android: showPassword ? 'visibility_off' : 'visibility',
                  web: showPassword ? 'visibility_off' : 'visibility',
                }}
                size={20}
              />
            </Pressable>
          </View>

          {mode === 'login' && (
            <Pressable
              className="self-end"
              onPress={() => {
                // TODO: forgot password flow
              }}>
              <Text className="text-sm text-blue-500">Forgot password?</Text>
            </Pressable>
          )}

          {error && <Text className="text-sm text-red-500">{error}</Text>}

          <Pressable
            className="bg-blue-500 rounded-xl py-3.5 items-center active:opacity-80"
            style={submitting ? { opacity: 0.6 } : undefined}
            onPress={submit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">{copy.button}</Text>
            )}
          </Pressable>

          <View className="flex-row justify-center gap-1 mt-2">
            <Text className="text-gray-500">{copy.switchText}</Text>
            <Link href={copy.switchHref} replace>
              <Text className="font-semibold text-blue-500">{copy.switchLink}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
