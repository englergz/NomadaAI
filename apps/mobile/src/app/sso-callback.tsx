// Destino del deep link del OAuth (nomadaai://sso-callback).
//
// ANTES: redirigía a «/» de inmediato. Si el sistema abría la app FRESCA por el
// deep link, Clerk aún no había resuelto la sesión y la raíz devolvía null
// mientras leía el almacenamiento → PANTALLA EN BLANCO sin salida.
//
// AHORA: se espera a que Clerk resuelva mostrando un estado de carga con la
// marca, con tope de tiempo. Nunca un vacío: el usuario siempre ve que algo pasa.
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

import BrandWordmark from '@/components/brand';
import { CLERK_ENABLED } from '@/lib/auth';
import { Colors } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

/** Si Clerk no responde en este tiempo, se entra igual en vez de esperar sin fin. */
const MAX_WAIT_MS = 8000;

function Callback() {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const t = useT();

  if (isLoaded || timedOut) return <Redirect href="/" />;

  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <BrandWordmark size={20} color={c.text} withLogo />
      <ActivityIndicator color={c.accent} />
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{t('auth.finishing')}</Text>
    </View>
  );
}

export default function SsoCallback() {
  // Sin Clerk configurado no hay sesión que resolver: se entra directo.
  if (!CLERK_ENABLED) return <Redirect href="/" />;
  return <Callback />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
