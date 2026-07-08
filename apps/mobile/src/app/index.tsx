// Pantalla inicial de la APP DE USUARIO (Fase 0: identidad + conexión a la API).
// En Fase 1 esta pantalla pasa a ser el mapa en vivo con navegación segura.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import type { HealthResponse } from '@nomadaai/shared';

import * as Location from 'expo-location';

import { CITIES, DEFAULT_CITY } from '@/constants/map';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { coverageCity } from '@/lib/geocode';
import { useResolvedScheme } from '@/lib/settings';

export default function Home() {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.health()
      .then((h) => { if (alive) setHealth(h); })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)); });
    // Ciudad detectada SIN pedir permiso aquí (los permisos van en contexto): solo si ya
    // fue concedido usamos la última posición conocida; si no, la ciudad por defecto.
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getLastKnownPositionAsync();
          if (pos) {
            const cov = coverageCity([pos.coords.longitude, pos.coords.latitude]);
            if (alive && cov) { setCity(CITIES[cov].label); return; }
            if (alive) { setCity(null); return; } // fuera de cobertura: se dirá en el mapa
          }
        }
      } catch { /* sin señal usamos la ciudad por defecto */ }
      if (alive) setCity(CITIES[DEFAULT_CITY].label);
    })();
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
            <Text style={[styles.cardText, { color: c.text, fontWeight: '700', letterSpacing: 0.6 }]}>
              {(city ?? CITIES[DEFAULT_CITY].label).toUpperCase()}
            </Text>
            <Text style={[styles.cardText, { color: c.textSecondary }]}>· servicio en línea</Text>
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
          Elige a dónde vas o inicia un recorrido libre: te avisamos antes del riesgo.
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
