import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props<T extends string | number> = {
  label: string;
  placeholder: string;
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  error?: string | null;
  required?: boolean;
  closeText?: string;
};

/** Tap to open a modal list; scales to long lists such as barangays. */
export function SelectField<T extends string | number>({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  required,
  closeText = 'Close',
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        className={`min-h-12 justify-center rounded-xl border bg-card px-4 py-3 ${
          error ? 'border-destructive' : 'border-input'
        }`}
        onPress={() => setOpen(true)}>
        <Text className={selected ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
            <Text className="text-lg font-semibold text-foreground">{label}</Text>
            <Pressable hitSlop={10} onPress={() => setOpen(false)}>
              <Text className="text-base font-semibold text-primary">{closeText}</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.value)}
            renderItem={({ item }) => (
              <Pressable
                className="min-h-12 flex-row items-center justify-between border-b border-border px-6 py-3 active:bg-muted"
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}>
                <Text className="text-base text-foreground">{item.label}</Text>
                {item.value === value ? <Text className="font-bold text-primary">✓</Text> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
