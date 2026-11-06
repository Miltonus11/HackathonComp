import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";

export default function Index() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    // The guard has now swapped to the auth screens; leave the stale "/" URL behind.
    router.replace("/login");
  };

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white">
      <Text className="text-xl font-bold text-blue-500">NativeWind is working!</Text>
      <Text className="text-gray-500">Signed in as {user?.email}</Text>
      <Pressable className="rounded-xl bg-gray-100 px-5 py-2.5 active:opacity-80" onPress={handleSignOut}>
        <Text className="font-semibold text-gray-900">Log out</Text>
      </Pressable>
    </View>
  );
}
