import { Pressable, Text, View } from 'react-native';

import type { LanguageCode } from '@/domain/profile';

const OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
];

export function LanguageToggle({
  value,
  onChange,
}: {
  value: LanguageCode;
  onChange: (v: LanguageCode) => void;
}) {
  return (
    <View className="flex-row self-start rounded-full bg-secondary p-1" accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`min-h-9 justify-center rounded-full px-4 ${selected ? 'bg-primary' : ''}`}
            onPress={() => onChange(o.value)}>
            <Text
              className={`text-sm font-semibold ${
                selected ? 'text-primary-foreground' : 'text-secondary-foreground'
              }`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
