/**
 * The real API is the default. Set EXPO_PUBLIC_USE_MOCK=1 (e.g. in mobile/.env) to run the
 * app fully offline against the on-device mock service.
 */
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === '1';
