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
// Importado por su efecto: define la tarea de ubicación en segundo plano en el
// ámbito global del bundle, requisito de expo-task-manager para que el sistema
// pueda ejecutarla sin montar ninguna vista.
import '@/lib/background-trip';
import { Colors } from '@/constants/theme';
import { setupAlerts } from '@/lib/notify';
import { checkForUpdate } from '@/lib/ota';
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
function SplashGate({ fontsReady }: { fontsReady: boolean }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return <AnimatedSplash fontsReady={fontsReady} onDone={() => setDone(true)} />;
}

export default function RootLayout() {
  // Tipografía de marca (wordmark Nómada.AI); la UI sigue con la fuente del sistema.
  const [fontsLoaded] = useFonts({ Sora_700Bold });
  // Se OCULTA el splash nativo del sistema de inmediato (la «pantalla negra con el
  // logo»): la app entra DIRECTO en la animación de arranque, sin salto intermedio.
  useEffect(() => { SplashScreen.hideAsync().catch(() => { /* ya oculto */ }); }, []);
  // El canal de alertas se crea AL ARRANCAR, no al iniciar el primer viaje: en
  // Android la importancia de un canal se fija al crearlo y no se puede subir
  // después, así que debe existir antes de la primera alerta.
  useEffect(() => { void setupAlerts(); }, []);
  // Actualización por aire: se busca y descarga en segundo plano al arrancar.
  // NO se recarga aquí; se aplica sola en el siguiente arranque en frío, para
  // no reiniciar nunca la app en mitad de un recorrido.
  useEffect(() => { void checkForUpdate(); }, []);
  return (
    <MaybeClerk>
      <SettingsProvider>
        <Root />
        {/* La animación (dibujo del logo) no depende de Sora; el wordmark final espera
            la fuente para no recortarse. */}
        <SplashGate fontsReady={fontsLoaded} />
      </SettingsProvider>
    </MaybeClerk>
  );
}
