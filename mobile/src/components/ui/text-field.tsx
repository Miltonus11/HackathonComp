import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  /** Password field with a show/hide toggle */
  secure?: boolean;
};

export function TextField({ label, error, hint, required, secure, ...input }: Props) {
  const [show, setShow] = useState(false);
  return (
    <View className="gap-1.5">
      <Text className="ml-1 text-sm font-semibold text-secondary-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View className="justify-center">
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9a93a8"
          className={`min-h-14 rounded-2xl border bg-card px-5 py-3.5 text-base text-foreground ${
            error ? 'border-destructive' : 'border-input'
          } ${secure ? 'pr-16' : ''}`}
          autoCapitalize="none"
          autoCorrect={false}
          {...input}
          secureTextEntry={secure && !show}
        />
        {secure ? (
          <Pressable
            className="absolute right-4"
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={show ? 'Hide password' : 'Show password'}
            onPress={() => setShow((v) => !v)}>
            <Text className="text-sm font-semibold text-primary">{show ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="text-sm text-destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-sm text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
