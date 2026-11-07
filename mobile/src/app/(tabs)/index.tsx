import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  // Only the username is ever shown; real names are not available to the UI.
  const name = session?.identity.display_name || 'there';

  const handleSignOut = async () => {
    await signOut();
    // The guard has swapped to the auth screens; leave the stale "/" URL behind.
    router.replace('/welcome');
  };

  return (
    <Screen footer={<Button title="Log out" variant="secondary" onPress={handleSignOut} />}>
      <View className="gap-2 pt-6">
        <Text className="text-3xl font-bold text-foreground">Hello, {name}</Text>
        <Text className="text-base text-muted-foreground">
          Your account is ready. Screening, mood check-ins and the journal are coming next.
        </Text>
      </View>
    </Screen>
  );
}
