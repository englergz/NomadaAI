// Pantalla inicial de la APP DE USUARIO (Fase 0: identidad + conexión a la API).
// En Fase 1 esta pantalla pasa a ser el mapa en vivo con navegación segura.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import type { HealthResponse } from '@nomadaai/shared';

import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useResolvedScheme } from '@/lib/settings';

export default function Home() {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.health()
      .then((h) => { if (alive) setHealth(h); })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.hero}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={[styles.title, { color: c.text }]}>Nómada.AI</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Navegación consciente del riesgo
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        {health ? (
          <>
            <View style={[styles.dot, { backgroundColor: c.ok }]} />
            <Text style={[styles.cardText, { color: c.text }]}>
              Conectado · {health.n_trajectories.toLocaleString()} trayectorias
            </Text>
          </>
        ) : error ? (
          <>
            <View style={[styles.dot, { backgroundColor: c.coral }]} />
            <Text style={[styles.cardText, { color: c.text }]}>Sin conexión con el servicio</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={c.accent} />
            <Text style={[styles.cardText, { color: c.textSecondary }]}>Conectando…</Text>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push('/map')}
        >
          <Text style={styles.ctaText}>Ir seguro</Text>
        </Pressable>
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          El mapa en vivo y la ruta segura llegan en la siguiente fase.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 64, gap: 8 },
  logo: { width: 96, height: 96, borderRadius: 22 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 12 },
  subtitle: { fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardText: { fontSize: 14 },
  footer: { gap: 10, marginBottom: 8 },
  cta: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' },
});
