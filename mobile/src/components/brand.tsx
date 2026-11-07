import { Image } from 'expo-image';
import { Text, View } from 'react-native';

export const APP_NAME = 'EunoiApp';

const MARK = require('@/assets/images/eunoi-mark.png');

/** The EunoiApp logo mark. The artwork is 423x510. */
export function Logo({ height = 96 }: { height?: number }) {
  return (
    <Image
      source={MARK}
      accessibilityLabel={`${APP_NAME} logo`}
      contentFit="contain"
      style={{ height, width: height * (423 / 510) }}
    />
  );
}

/** Small logo + name, for headers. */
export function BrandLockup() {
  return (
    <View className="flex-row items-center gap-2.5">
      <Logo height={36} />
      <Text className="text-xl font-bold tracking-tight text-primary">{APP_NAME}</Text>
    </View>
  );
}
