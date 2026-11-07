import { Pressable, Text, View } from 'react-native';

type Props<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  error?: string | null;
  required?: boolean;
};

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  required,
}: Props<T>) {
  return (
    <View className="gap-1.5">
      <Text className="ml-1 text-sm font-semibold text-secondary-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`min-h-11 justify-center rounded-full border px-4 py-2 ${
                selected ? 'border-primary bg-primary' : 'border-input bg-card'
              }`}
              onPress={() => onChange(o.value)}>
              <Text
                className={`text-sm font-medium ${
                  selected ? 'text-primary-foreground' : 'text-foreground'
                }`}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
