import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Safe-area page with a scrolling body and an optional footer pinned above the keyboard,
 * so primary actions stay reachable with long text or the keyboard open.
 */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="w-full max-w-md gap-4 self-center px-6 py-6"
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? (
          <View className="w-full max-w-md gap-2 self-center border-t border-border bg-background px-6 pb-4 pt-3">
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
