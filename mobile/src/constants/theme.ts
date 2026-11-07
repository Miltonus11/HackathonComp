/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Values mirror the CSS variables in src/global.css (shadcn palette, converted from oklch).
export const Colors = {
  light: {
    text: '#0a0a0a',
    background: '#ffffff',
    backgroundElement: '#f5f5f5',
    backgroundSelected: '#e5e5e5',
    textSecondary: '#737373',
    primary: '#7008e7',
    primaryForeground: '#f5f3ff',
    destructive: '#e7000b',
    border: '#e5e5e5',
  },
  dark: {
    text: '#fafafa',
    background: '#0a0a0a',
    backgroundElement: '#262626',
    backgroundSelected: '#171717',
    textSecondary: '#a1a1a1',
    primary: '#5d0ec0',
    primaryForeground: '#f5f3ff',
    destructive: '#ff6467',
    border: '#2a2a2a',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
