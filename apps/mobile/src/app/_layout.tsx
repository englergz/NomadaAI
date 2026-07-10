import React, { useEffect, useState, type ReactNode } from 'react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Sora_700Bold, useFonts } from '@expo-google-fonts/sora';
import { ClerkProvider as ClerkProviderImpl, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

// Clerk trae su propio @types/react (sin bigint en ReactNode) y choca con el del
// monorepo; el runtime es correcto — se relaja SOLO el tipo del provider.
const ClerkProvider = ClerkProviderImpl as unknown as React.ComponentType<{
  publishableKey: string; tokenCache: unknown; children?: ReactNode;
}>;

import AnimatedSplash from '@/components/animated-splash';
import { Colors } from '@/constants/theme';
import { CLERK_ENABLED, registerAuth } from '@/lib/auth';
import { SettingsProvider, useResolvedScheme } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();

// Publica getToken/userId para los módulos no-React (histórico, reportes).
function AuthBridge() {
  const { getToken, userId, isSignedIn } = useAuth();
  useEffect(() => {
    registerAuth(isSignedIn ? getToken : null, isSignedIn ? (userId ?? null) : null);
    return () => registerAuth(null, null);
  }, [getToken, userId, isSignedIn]);
  return null;
}

// Login OPCIONAL (como en el escritorio): sin clave publicable, modo invitado puro.
function MaybeClerk({ children }: { children: ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <AuthBridge />
      {children}
    </ClerkProvider>
  );
}

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

// Splash animado SOLO en arranque en frío: este componente raíz se monta una vez
// por proceso; la app carga detrás mientras la ruta se dibuja (~3 s).
function SplashGate() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return <AnimatedSplash onDone={() => setDone(true)} />;
}

export default function RootLayout() {
  // Tipografía de marca (wordmark Nómada.AI); la UI sigue con la fuente del sistema.
  const [fontsLoaded] = useFonts({ Sora_700Bold });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  // En nativo, pintar ANTES de tener la Sora deja el wordmark mal medido y
  // recortado («Nóma .A»): no se renderiza nada hasta que la fuente esté lista
  // (el splash nativo del sistema sigue en pantalla, no hay parpadeo).
  if (!fontsLoaded) return null;
  return (
    <MaybeClerk>
      <SettingsProvider>
        <Root />
        <SplashGate />
      </SettingsProvider>
    </MaybeClerk>
  );
}
