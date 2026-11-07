import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/** SecureStore on native, localStorage on web (SecureStore is native-only). */
export const defaultKv: KeyValueStore = {
  get: async (key) =>
    Platform.OS === 'web'
      ? (globalThis.localStorage?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key),
  set: async (key, value) => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  remove: async (key) => {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
