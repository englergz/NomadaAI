// Vista principal de la app de usuario (Fase 2): mapa + buscador de destino +
// ruta segura vs directa. Permiso de ubicación EN CONTEXTO (al tocar el botón).
// Regla de ruteo: EVITAR cuando hay alternativa; AVISAR cuando el riesgo es inevitable.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput,
  View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import type { BuildRouteResponse, Coordinate, RiskZonesResponse } from '@nomadaai/shared';

import RiskMap from '@/components/risk-map';
import type { RouteLines } from '@/components/risk-map.types';
import { CITIES, DEFAULT_CITY } from '@/constants/map';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { coverageCity, searchPlaces, type Place } from '@/lib/geocode';

// Prioridad de seguridad → λ (risk_weight) del backend.
const PRIORITIES = [
  { label: 'Rápida', w: 0.3 },
  { label: 'Equilibrada', w: 1.0 },
  { label: 'Segura', w: 2.5 },
] as const;

export default function MapScreen() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const c = Colors[dark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const [riskOn, setRiskOn] = useState(true);
  const [riskData, setRiskData] = useState<RiskZonesResponse | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'ok' | 'warn' | 'info' } | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dest, setDest] = useState<Place | null>(null);
  const [priority, setPriority] = useState(1); // índice en PRIORITIES
  const [routing, setRouting] = useState(false);
  const [routes, setRoutes] = useState<RouteLines | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    api.riskZones()
      .then((d) => { if (alive) setRiskData(d); })
      .catch(() => { /* sin riesgo no bloqueamos el mapa */ });
    return () => { alive = false; };
  }, []);

  // Búsqueda con debounce; se descartan respuestas viejas.
  useEffect(() => {
    const seq = ++searchSeq.current;
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchPlaces(query, DEFAULT_CITY)
        .then((r) => { if (searchSeq.current === seq) { setResults(r); setSearching(false); } })
        .catch(() => { if (searchSeq.current === seq) setSearching(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function locate(): Promise<[number, number] | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setBanner({ text: 'Sin permiso de ubicación. Actívalo en Ajustes.', tone: 'warn' });
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      setUserLoc(loc);
      // Cobertura: si está lejos de toda ciudad soportada, avisamos con honestidad.
      const cov = coverageCity(loc as Coordinate);
      setOutOfCoverage(!cov);
      if (!cov) {
        setBanner({
          text: `Aún no hay cobertura en tu zona. Te mostramos ${CITIES[DEFAULT_CITY].label} como demostración.`,
          tone: 'info',
        });
      }
      return loc;
    } catch {
      setBanner({ text: 'No se pudo obtener tu ubicación.', tone: 'warn' });
      return null;
    }
  }

  async function goSafe() {
    if (!dest || routing) return;
    Keyboard.dismiss();
    setRouting(true);
    setBanner({ text: 'Generando ruta segura…', tone: 'info' });
    try {
      // Origen: tu ubicación si está en cobertura; si no, el centro de la ciudad demo.
      let origin = userLoc && !outOfCoverage ? userLoc : null;
      if (!origin) {
        const loc = await locate();
        origin = loc && coverageCity(loc as Coordinate) ? loc : CITIES[DEFAULT_CITY].center;
      }
      const r: BuildRouteResponse = await api.buildRoute({
        origin: origin as Coordinate,
        dest: dest.coord,
        hour: new Date().getHours(),
        risk_weight: PRIORITIES[priority].w,
      });
      setRoutes({ safe: r.coords, direct: r.direct_coords });
      const red = r.comparison?.exposure_reduction_pct ?? 0;
      // EVITAR vs AVISAR: si el desvío no reduce exposición, no fingimos un desvío útil.
      if (red >= 2) {
        setBanner({ text: `Ruta segura: −${red.toFixed(1)}% de exposición vs. la directa.`, tone: 'ok' });
      } else {
        setBanner({
          text: 'El tramo de riesgo es inevitable en este viaje: mantente atento durante el recorrido.',
          tone: 'warn',
        });
      }
    } catch {
      setBanner({ text: 'No se pudo trazar la ruta (¿destino fuera de la red vial?).', tone: 'warn' });
    } finally {
      setRouting(false);
    }
  }

  function clearTrip() {
    setDest(null); setRoutes(null); setBanner(null); setQuery(''); setResults([]);
  }

  const toneColor = { ok: c.ok, warn: c.amber, info: c.accent } as const;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <RiskMap
        dark={dark} riskOn={riskOn} riskData={riskData}
        userLocation={userLoc} routes={routes} destination={dest?.coord ?? null}
      />

      {/* Controles superiores */}
      <View style={[styles.top, { top: insets.top + 12 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.chip, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          <Text style={[styles.chipText, { color: c.text }]}>‹ Volver</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={locate}
            style={[styles.chip, { backgroundColor: c.backgroundElement, borderColor: userLoc ? c.accent : c.border }]}
          >
            <Text style={[styles.chipText, { color: userLoc ? c.accent : c.text }]}>◎</Text>
          </Pressable>
          <Pressable
            onPress={() => setRiskOn((v) => !v)}
            style={[styles.chip, { backgroundColor: c.backgroundElement, borderColor: riskOn ? c.accent : c.border }]}
          >
            <Text style={[styles.chipText, { color: riskOn ? c.accent : c.text }]}>
              Riesgo {riskOn ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Banner de estado (in-app, no intrusivo) */}
      {banner && (
        <View style={[styles.banner, { top: insets.top + 60, backgroundColor: c.backgroundElement, borderColor: toneColor[banner.tone] }]}>
          <Text style={{ color: c.text, fontSize: 12.5, textAlign: 'center' }}>{banner.text}</Text>
        </View>
      )}

      {/* Barra inferior: destino + prioridad + Ir seguro */}
      <View style={[styles.sheet, { bottom: 0, paddingBottom: insets.bottom + 14, backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        {results.length > 0 && !dest && (
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item, i) => `${item.source}-${i}-${item.name}`}
            style={[styles.results, { borderColor: c.border }]}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setDest(item); setQuery(item.name); setResults([]); Keyboard.dismiss(); }}
                style={({ pressed }) => [styles.resultRow, { backgroundColor: pressed ? c.backgroundSelected : 'transparent' }]}
              >
                <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 11 }} numberOfLines={1}>{item.detail}</Text>
              </Pressable>
            )}
          />
        )}

        <View style={[styles.inputRow, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); if (dest) { setDest(null); setRoutes(null); } }}
            placeholder="¿A dónde vas?"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text }]}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={c.accent} />}
          {(dest || query.length > 0) && !searching && (
            <Pressable onPress={clearTrip} hitSlop={8}>
              <Text style={{ color: c.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.prioRow}>
          {PRIORITIES.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => setPriority(i)}
              style={[
                styles.prio,
                { borderColor: i === priority ? c.accent : c.border, backgroundColor: i === priority ? c.backgroundSelected : 'transparent' },
              ]}
            >
              <Text style={{ color: i === priority ? c.accent : c.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={goSafe}
          disabled={!dest || routing}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: c.accent, opacity: !dest || routing ? 0.45 : pressed ? 0.85 : 1 },
          ]}
        >
          {routing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.ctaText}>Ir seguro</Text>}
        </Pressable>
        {Platform.OS === 'web' && (
          <Text style={[styles.hintWeb, { color: c.textSecondary }]}>
            En el navegador la ubicación usa el diálogo del propio navegador.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
  banner: { position: 'absolute', left: 24, right: 24, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  sheet: {
    position: 'absolute', left: 0, right: 0, gap: 10,
    borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 14,
  },
  results: { maxHeight: 200, borderBottomWidth: 1, marginBottom: 2 },
  resultRow: { paddingVertical: 9, paddingHorizontal: 6, gap: 2, borderRadius: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  prioRow: { flexDirection: 'row', gap: 8 },
  prio: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  cta: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hintWeb: { fontSize: 11, textAlign: 'center' },
});
