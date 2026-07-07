/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Design tokens Nómada.AI — mismo sistema que apps/web (claro y oscuro PARES).
// Rutas: azul → ámbar → coral; el rojo puro se reserva al mapa de calor de riesgo.
export const Brand = {
  accent: '#2f81f7', // azul: despejado / acción principal
  amber: '#f5a524',  // ámbar: precaución
  coral: '#ff6b5e',  // coral: atención
  ok: '#22c55e',
} as const;

export const Colors = {
  light: {
    text: '#17212c',
    background: '#eef2f7',
    backgroundElement: '#ffffff',
    backgroundSelected: '#f3f6fa',
    textSecondary: '#5b6773',
    border: '#dbe2ea',
    ...Brand,
  },
  dark: {
    text: '#e8edf3',
    background: '#0f141a',
    backgroundElement: '#161d26',
    backgroundSelected: '#1d2632',
    textSecondary: '#94a1ae',
    border: '#2a333f',
    ...Brand,
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
