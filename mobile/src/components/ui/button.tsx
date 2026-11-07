import { ActivityIndicator, Pressable, Text } from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
};

const STYLES = {
  primary: { box: 'bg-primary', text: 'text-primary-foreground', spinner: '#fbf9f5' },
  secondary: { box: 'bg-secondary', text: 'text-secondary-foreground', spinner: '#4a3f6b' },
  ghost: { box: 'bg-transparent', text: 'text-primary', spinner: '#6d6193' },
} as const;

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const s = STYLES[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      className={`min-h-14 items-center justify-center rounded-full px-6 py-3.5 active:scale-[0.98] active:opacity-85 ${s.box}`}
      style={[
        variant === 'primary'
          ? {
              shadowColor: '#6d6193',
              shadowOpacity: 0.28,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }
          : null,
        inactive ? { opacity: 0.5 } : null,
      ]}
      disabled={inactive}
      onPress={onPress}>
      {loading ? (
        <ActivityIndicator color={s.spinner} />
      ) : (
        <Text className={`text-base font-semibold tracking-wide ${s.text}`}>{title}</Text>
      )}
    </Pressable>
  );
}
