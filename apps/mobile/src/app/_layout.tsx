import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { Colors } from '@/constants/theme';
import { SettingsProvider, useResolvedScheme } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();

function Root() {
  const scheme = useResolvedScheme(); // respeta el ajuste Sistema/Claro/Oscuro del usuario
  const dark = scheme === 'dark';
  const colors = Colors[scheme];
  const base = dark ? DarkTheme : DefaultTheme;
  // Tema de navegación alineado a los design tokens (par claro/oscuro).
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.backgroundElement,
      text: colors.text,
      border: colors.border,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Root />
    </SettingsProvider>
  );
}
