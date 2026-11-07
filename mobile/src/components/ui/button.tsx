import { ActivityIndicator, Pressable, Text } from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
};

const STYLES = {
  primary: { box: 'bg-primary', text: 'text-primary-foreground', spinner: '#f5f3ff' },
  secondary: { box: 'bg-secondary', text: 'text-secondary-foreground', spinner: '#18181b' },
  ghost: { box: 'bg-transparent', text: 'text-primary', spinner: '#7008e7' },
} as const;

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const s = STYLES[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      className={`min-h-12 items-center justify-center rounded-xl px-5 py-3 active:opacity-80 ${s.box}`}
      style={inactive ? { opacity: 0.5 } : undefined}
      disabled={inactive}
      onPress={onPress}>
      {loading ? (
        <ActivityIndicator color={s.spinner} />
      ) : (
        <Text className={`text-base font-semibold ${s.text}`}>{title}</Text>
      )}
    </Pressable>
  );
}
