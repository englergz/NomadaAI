// Recorrido de bienvenida (primera vez): páginas deslizables con lo esencial de la
// app, puntos de progreso y botón «Siguiente» que se convierte en «Comenzar».
// Al terminar (o al omitir) se persiste la marca y el mapa pasa a ser la pantalla
// principal. Aquí vivirá también el login (U4): Google + «continuar como invitado».
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useSSO } from '@clerk/clerk-expo';

import BrandWordmark from '@/components/brand';
import { Colors, Radii } from '@/constants/theme';
import { CLERK_ENABLED } from '@/lib/auth';
import { useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

// Cierra la pestaña del navegador al volver del OAuth (requisito de expo-auth-session).
WebBrowser.maybeCompleteAuthSession();

export const ONBOARDED_KEY = 'nomadaai_onboarded_v1';

// Si la app vuelve del OAuth ya con sesión (el deep link puede relanzarla y perder
// el estado en memoria), el welcome NO se repite: directo al mapa.
function AutoEnterIfSignedIn({ onDone }: { onDone: () => void }) {
  const { isSignedIn } = useAuth();
  useEffect(() => { if (isSignedIn) onDone(); }, [isSignedIn, onDone]);
  return null;
}

// U4 · Login al FINAL del recorrido (no bloquea la entrada): Google real vía Clerk
// o «continuar como invitado». Solo se monta cuando hay clave de Clerk.
function WelcomeAuth({ onDone }: { onDone: () => void }) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function google() {
    if (busy) return;
    setBusy(true); setErr(false);
    try {
      // scheme EXPLÍCITO: en la APK release makeRedirectUri() sin argumentos no
      // resuelve el deep link de vuelta y el login «no se pudo iniciar sesión».
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'nomadaai', path: 'sso-callback' }),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        onDone(); // sesión activa → directo al mapa, nada de volver al welcome
      } else {
        setErr(true); // flujo incompleto (p. ej. cerró el diálogo)
      }
    } catch { setErr(true); } finally { setBusy(false); }
  }

  if (isSignedIn) {
    return (
      <>
        <Pressable onPress={onDone} style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={styles.ctaText}>{t('wel.start')}</Text>
        </Pressable>
        <View style={styles.underRow} />
      </>
    );
  }
  return (
    <>
      {err && <Text style={{ color: c.coral, fontSize: 12, textAlign: 'center' }}>{t('auth.error')}</Text>}
      <Pressable
        onPress={google}
        style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.ctaText}>{t('auth.google')}</Text>
      </Pressable>
      {/* Invitado: opción presente pero DISCRETA (incentiva el login con Google) */}
      <View style={styles.underRow}>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={{ color: c.textSecondary, fontSize: 12.5, textDecorationLine: 'underline' }}>
            {t('auth.guest')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: TKey; body: TKey }[] = [
  { icon: 'heart-circle-outline', title: 'wel.1.title', body: 'wel.1.body' },
  { icon: 'map-outline', title: 'wel.2.title', body: 'wel.2.body' },
  { icon: 'navigate-circle-outline', title: 'wel.3.title', body: 'wel.3.body' },
  { icon: 'notifications-outline', title: 'wel.4.title', body: 'wel.4.body' },
];

export default function Welcome() {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  // Ancho REAL medido: con Dimensions el primer frame renderizaba las 4 slides
  // apiladas (ancho aún incorrecto) — el «cuelgue» visual al (re)cargar.
  const [width, setWidth] = useState(0);
  const last = page === SLIDES.length - 1;

  async function finish() {
    try { await AsyncStorage.setItem(ONBOARDED_KEY, '1'); } catch { /* sin storage, igual entra */ }
    router.replace('/');
  }

  function next() {
    if (last) { finish(); return; }
    // La página se avanza aquí mismo: en web los eventos de momentum no llegan
    // tras un scroll programático; el onScroll cubre los deslizamientos manuales.
    const target = page + 1;
    setPage(target);
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {CLERK_ENABLED && <AutoEnterIfSignedIn onDone={finish} />}
      {/* Marca centrada (mismo lugar que en el mapa) + «✕» sutil para omitir:
          el login no debe ser barrera — siempre queda disponible en el perfil. */}
      <View style={styles.top}>
        <BrandWordmark size={16} color={c.text} withLogo />
        {!last && (
          <Pressable
            onPress={finish}
            hitSlop={8}
            accessibilityLabel={t('wel.skip')}
            style={[styles.skipX, { borderColor: c.border, backgroundColor: c.backgroundElement }]}
          >
            <Ionicons name="close" size={16} color={c.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onScroll={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          if (p !== page && p >= 0 && p < SLIDES.length) setPage(p);
        }}
        scrollEventThrottle={64}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconWrap, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
              <Ionicons name={item.icon} size={64} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>{t(item.title)}</Text>
            <Text style={[styles.body, { color: c.textSecondary }]}>{t(item.body)}</Text>
          </View>
        )}
      />
      )}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border, width: i === page ? 22 : 8 }]}
            />
          ))}
        </View>
        {last && CLERK_ENABLED ? (
          <WelcomeAuth onDone={finish} />
        ) : (
          <>
            <Pressable
              onPress={next}
              style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.ctaText}>{last ? t('wel.start') : t('wel.next')}</Text>
            </Pressable>
            {/* misma altura que la fila del enlace de invitado: el CTA no salta */}
            <View style={styles.underRow} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { alignItems: 'center', justifyContent: 'center', paddingTop: 14, paddingHorizontal: 24 },
  skipX: {
    position: 'absolute', right: 20, top: 12, width: 30, height: 30, borderRadius: Radii.pill,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  underRow: { height: 28, alignItems: 'center', justifyContent: 'center' },
  // paddingTop baja el bloque: el centro óptico pedía el contenido menos arriba.
  slide: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 36, gap: 18 },
  iconWrap: {
    width: 128, height: 128, borderRadius: Radii.pill, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 18, gap: 16 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', alignItems: 'center' },
  dot: { height: 8, borderRadius: Radii.pill },
  cta: { borderRadius: Radii.pill, paddingVertical: 15, alignItems: 'center' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
