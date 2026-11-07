import { Pressable, Text, View } from 'react-native';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  /** Adds a visible "Required" tag in addition to the asterisk */
  required?: boolean;
  requiredText?: string;
};

export function Checkbox({ checked, onChange, label, description, required, requiredText }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="min-h-12 flex-row items-start gap-3 rounded-xl border border-border bg-card p-4"
      onPress={() => onChange(!checked)}>
      <View
        className={`mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${
          checked ? 'border-primary bg-primary' : 'border-input bg-card'
        }`}>
        {checked ? <Text className="text-sm font-bold text-primary-foreground">✓</Text> : null}
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base text-foreground">
          {label}
          {required ? <Text className="text-destructive"> *</Text> : null}
        </Text>
        {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
        {required && requiredText ? (
          <Text className="text-xs font-semibold uppercase text-primary">{requiredText}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
