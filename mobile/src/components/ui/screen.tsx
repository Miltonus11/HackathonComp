import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Safe-area page with a scrolling body and an optional footer pinned above the keyboard,
 * so primary actions stay reachable with long text or the keyboard open.
 * Two soft lavender circles sit behind the content to give the cream page some calm depth.
 */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f1ea' }}>
      <View pointerEvents="none" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary opacity-70" />
      <View pointerEvents="none" className="absolute -left-32 top-1/2 h-64 w-64 rounded-full bg-secondary opacity-40" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="w-full max-w-md gap-5 self-center px-6 py-6"
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? (
          <View className="w-full max-w-md gap-2 self-center rounded-t-3xl bg-background/95 px-6 pb-4 pt-4">
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
