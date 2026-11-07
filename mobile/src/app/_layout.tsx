import '../global.css';

import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth';
import { MoodProvider } from '@/lib/mood-context';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, hasRequiredConsent, loading } = useAuth();

  // Keep the splash up until we know whether there is a stored session.
  if (loading) return null;

  // Signed in but APP_USE withdrawn: stay in the auth group, which shows the re-consent screen.
  const signedIn = !!session && hasRequiredConsent;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="assessment" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <MoodProvider>
          <RootStack />
        </MoodProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
