// Vista principal de la app de usuario (Fases 2–3): mapa + buscador de destino +
// ruta segura vs directa + alertas graduadas por acción durante el recorrido.
// Permisos (ubicación, notificaciones) SIEMPRE en contexto, nunca al abrir.
// Regla de ruteo: EVITAR cuando hay alternativa; AVISAR cuando el riesgo es inevitable.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { BuildRouteResponse, Coordinate, RiskZonesResponse } from '@nomadaai/shared';

import ReportSheet from '@/components/report-sheet';
import RiskMap from '@/components/risk-map';
import SettingsSheet from '@/components/settings-sheet';
import type { RouteLines } from '@/components/risk-map.types';
import { useResolvedScheme, useSettings } from '@/lib/settings';
import { CITIES, DEFAULT_CITY } from '@/constants/map';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { levelFor, ProximityTracker, zoneAt, type AlertLevel } from '@/lib/alerts';
import { coverageCity, distM, searchPlaces, type Place } from '@/lib/geocode';

// Prioridad de seguridad → λ (risk_weight) del backend.
const PRIORITIES = [
  { label: 'Rápida', w: 0.3 },
  { label: 'Equilibrada', w: 1.0 },
  { label: 'Segura', w: 2.5 },
] as const;

export default function MapScreen() {
  const scheme = useResolvedScheme();
  const dark = scheme === 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { settings, set, hydrated } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const riskOn = settings.riskOn; // capa de riesgo: vive en Ajustes (con acceso rápido aquí)
  const [riskData, setRiskData] = useState<RiskZonesResponse | null>(null);
  const [poisData, setPoisData] = useState<RiskZonesResponse | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'ok' | 'warn' | 'info' | 'coral' } | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dest, setDest] = useState<Place | null>(null);
  const [priority, setPriority] = useState(1); // índice en PRIORITIES
  const [routing, setRouting] = useState(false);
  const [routes, setRoutes] = useState<RouteLines | null>(null);
  const searchSeq = useRef(0);

  // Recorrido (Fase 3): seguimiento + alertas de proximidad una-vez-por-zona.
  const [onTrip, setOnTrip] = useState(false);
  const [tripLevel, setTripLevel] = useState<AlertLevel>('despejado');
  const trackerRef = useRef(new ProximityTracker());
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const riskRef = useRef<RiskZonesResponse | null>(null);
  useEffect(() => { riskRef.current = riskData; }, [riskData]);

  useEffect(() => {
    let alive = true;
    api.riskZones()
      .then((d) => { if (alive) setRiskData(d); })
      .catch(() => { /* sin riesgo no bloqueamos el mapa */ });
    return () => { alive = false; };
  }, []);

  // Capa Lugares: se carga la primera vez que se activa en Ajustes.
  useEffect(() => {
    if (!settings.poisOn || poisData) return;
    let alive = true;
    api.pois(500)
      .then((d) => { if (alive) setPoisData(d as RiskZonesResponse); })
      .catch(() => { /* sin POIs la capa queda vacía */ });
    return () => { alive = false; };
  }, [settings.poisOn, poisData]);

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

  // Timeout duro: en web el diálogo de geolocalización puede quedar sin respuesta
  // y getCurrentPositionAsync no resuelve nunca — no podemos colgar el flujo por eso.
  function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
    return Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout:${tag}`)), ms)),
    ]);
  }

  async function locate(): Promise<[number, number] | null> {
    try {
      const { status } = await withTimeout(
        Location.requestForegroundPermissionsAsync(), 20000, 'permiso',
      );
      if (status !== 'granted') {
        setBanner({ text: 'Sin permiso de ubicación. Actívalo en Ajustes.', tone: 'warn' });
        return null;
      }
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000, 'gps',
      );
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

  const lastOriginRef = useRef<[number, number] | null>(null);

  async function goSafe(prioIdx: number = priority) {
    if (!dest || routing) return;
    Keyboard.dismiss();
    setRouting(true);
    setBanner({ text: 'Generando ruta segura…', tone: 'info' });
    try {
      // Origen: tu ubicación si está en cobertura; si no (o si el GPS no responde
      // a tiempo), el centro de la ciudad demo — el flujo nunca se queda colgado.
      // Al recalcular (cambio de prioridad) se reutiliza el último origen.
      let origin = (userLoc && !outOfCoverage ? userLoc : null) ?? lastOriginRef.current;
      if (!origin) {
        const loc = await locate().catch(() => null);
        origin = loc && coverageCity(loc as Coordinate) ? loc : CITIES[DEFAULT_CITY].center;
      }
      lastOriginRef.current = origin;
      const r: BuildRouteResponse = await withTimeout(
        api.buildRoute({
          origin: origin as Coordinate,
          dest: dest.coord,
          hour: new Date().getHours(),
          risk_weight: PRIORITIES[prioIdx].w,
        }),
        45000, // el Space gratuito puede tardar en despertar
        'ruta',
      );
      // Nivel por tramo (punto medio de cada segmento contra la malla de riesgo):
      // así la línea muestra precaución/atención EN el tramo, no solo en el banner.
      const risk = riskRef.current;
      const safeLevels = r.coords.slice(0, -1).map((p, i) => {
        const q = r.coords[i + 1];
        const mid: Coordinate = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const hit = zoneAt(risk, mid);
        return hit ? levelFor(hit.riskNorm) : 'despejado';
      });
      setRoutes({ safe: r.coords, direct: r.direct_coords, safeLevels });
      const red = r.comparison?.exposure_reduction_pct ?? 0;
      const km = (r.distance_m / 1000).toFixed(1);
      const prio = PRIORITIES[prioIdx].label;
      // EVITAR vs AVISAR: si el desvío no reduce exposición, no fingimos un desvío útil.
      // Siempre se muestran km y % para que se VEA el recálculo aunque el trazo coincida.
      if (red >= 2) {
        setBanner({ text: `Ruta ${prio.toLowerCase()}: ${km} km · −${red.toFixed(1)}% de exposición vs. la directa.`, tone: 'ok' });
      } else {
        setBanner({
          text: `Sin alternativa más segura para este viaje (${km} km · −${red.toFixed(1)}%): el tramo de riesgo es inevitable, mantente atento.`,
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
    stopTrip();
    setDest(null); setRoutes(null); setBanner(null); setQuery(''); setResults([]);
  }

  // Notificación local (nativa). En web solo banner in-app.
  async function notifyLocal(title: string, body: string) {
    if (Platform.OS === 'web') return;
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
    } catch { /* sin permiso o sin módulo: el banner in-app ya avisó */ }
  }

  // Prefijo del recorrido para el modelo de predicción (OE1): puntos [lon,lat,t].
  const tripPtsRef = useRef<{ lon: number; lat: number; t: number }[]>([]);
  const lastPredictRef = useRef(0);

  // Movimiento real → modelo: con velocidad sostenida (~≥15 km/h) el prefijo se envía a
  // /predict/online, que predice el destino y devuelve la ALERTA ANTICIPADA de riesgo.
  async function feedModel(speedMps: number) {
    const now = Date.now();
    if (now - lastPredictRef.current < 15000) return; // máx. 1 llamada cada 15 s
    const pts = tripPtsRef.current.slice(-40);        // prefijo acotado (payload pequeño)
    if (pts.length < 4) return;
    lastPredictRef.current = now;
    try {
      const d = new Date();
      const r = await api.predictOnline({
        points: pts,
        t_seconds: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
        day: (d.getDay() + 6) % 7, // JS 0=dom → API 0=lun
        speed_mps: Math.min(Math.max(speedMps, 1), 39),
        threshold: 0.7,
      });
      const a = r.alert;
      // Alerta anticipada: llega ANTES de entrar a la zona; misma regla una-vez-por-zona.
      if (a?.is_high && trackerRef.current.seenOnce(`pre:${a.cell_id}`)) {
        const lvl = levelFor(a.risk_norm);
        const eta = a.arrival_min > 0 ? ` en ~${a.arrival_min} min` : ' más adelante';
        const title = lvl === 'atencion' ? 'Atención' : 'Precaución';
        const body = `Tu camino pasa por un tramo de riesgo${eta}. Puedes ajustar la ruta o extremar cuidado.`;
        setBanner({ text: `${title}: ${body}`, tone: lvl === 'atencion' ? 'coral' : 'warn' });
        notifyLocal(`${title}: riesgo${eta}`, body);
      }
    } catch { /* sin red no interrumpimos el recorrido */ }
  }

  // Cada posición del recorrido: nivel en vivo + alerta 1 vez por zona + modelo.
  function handlePosition(pos: Coordinate) {
    setUserLoc(pos as [number, number]);
    const hit = zoneAt(riskRef.current, pos);
    setTripLevel(hit?.level ?? 'despejado');
    const alert = trackerRef.current.check(riskRef.current, pos);
    if (alert) {
      setBanner({ text: `${alert.title}: ${alert.body}`, tone: alert.level === 'atencion' ? 'coral' : 'warn' });
      notifyLocal(alert.title, alert.body);
    }
    // Acumula el prefijo y estima velocidad entre las dos últimas posiciones.
    const t = Date.now() / 1000;
    const pts = tripPtsRef.current;
    const prev = pts[pts.length - 1];
    pts.push({ lon: pos[0], lat: pos[1], t });
    if (pts.length > 120) pts.splice(0, pts.length - 120);
    if (prev) {
      const dt = t - prev.t;
      const speed = dt > 0 ? distM([prev.lon, prev.lat], pos) / dt : 0;
      if (speed >= 4) feedModel(speed); // ~15 km/h: hay desplazamiento real (moto/carro/bus)
    }
  }

  async function startTrip() {
    if (onTrip) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setBanner({ text: 'El recorrido necesita tu ubicación. Actívala en Ajustes.', tone: 'warn' });
      return;
    }
    // Notificaciones: permiso EN CONTEXTO, justo cuando empieza el primer recorrido.
    if (Platform.OS !== 'web') {
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.requestPermissionsAsync();
      } catch { /* opcional: sin notificaciones seguimos con banners */ }
    }
    trackerRef.current.reset();
    tripPtsRef.current = [];
    lastPredictRef.current = 0;
    setTripLevel('despejado');
    setOnTrip(true);
    setBanner({ text: 'Recorrido iniciado. Te avisaremos solo cuando haga falta.', tone: 'info' });
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 15 },
      (p) => handlePosition([p.coords.longitude, p.coords.latitude]),
    );
  }

  function stopTrip() {
    watchRef.current?.remove();
    watchRef.current = null;
    if (onTrip) setBanner(null);
    setOnTrip(false);
    setTripLevel('despejado');
  }

  useEffect(() => () => { watchRef.current?.remove(); }, []);

  // Sonda de desarrollo: permite inyectar posiciones para verificar alertas sin GPS.
  if (__DEV__ && Platform.OS === 'web') {
    (globalThis as Record<string, unknown>).__alertProbe = (lon: number, lat: number) =>
      handlePosition([lon, lat]);
  }

  const toneColor = { ok: c.ok, warn: c.amber, info: c.accent, coral: c.coral } as const;
  // Paleta de alertas por acción: azul → ámbar → coral (nunca rojo puro en UI).
  const levelUi: Record<AlertLevel, { label: string; color: string }> = {
    despejado: { label: 'Despejado', color: c.accent },
    precaucion: { label: 'Precaución', color: c.amber },
    atencion: { label: 'Atención', color: c.coral },
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* El mapa se crea cuando los ajustes ya están hidratados: nace con el tema/base
          correctos y se evita el swap de tiles (y su flash) en el arranque. */}
      {hydrated && (
        <RiskMap
          dark={dark} riskOn={riskOn} riskData={riskData}
          userLocation={userLoc} routes={routes} destination={dest?.coord ?? null}
          riskStyle={{ palette: settings.palette, intensity: settings.intensity, opacity: settings.opacity }}
          satellite={settings.satellite} poisData={poisData} poisOn={settings.poisOn}
        />
      )}

      {/* Volver: chip circular clásico «‹» */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.fab, { top: insets.top + 12, left: 16, backgroundColor: c.backgroundElement, borderColor: c.border }]}
        hitSlop={6}
      >
        <Ionicons name="chevron-back" size={22} color={c.text} />
      </Pressable>

      {/* Pila flotante derecha: perfil · ajustes · reportar */}
      <View style={[styles.rightStack, { top: insets.top + 12 }]}>
        <Pressable
          onPress={() => setBanner({ text: 'Tu perfil llega con el inicio de sesión (próxima fase).', tone: 'info' })}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          <Ionicons name="person-circle-outline" size={23} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => setShowSettings(true)}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          <Ionicons name="settings-outline" size={21} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => setShowReport(true)}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: c.coral }]}
        >
          <Ionicons name="alert-circle-outline" size={22} color={c.coral} />
        </Pressable>
      </View>

      {/* Mi ubicación: FAB clásico abajo a la derecha, sobre la barra inferior */}
      <Pressable
        onPress={locate}
        style={[styles.fab, styles.locFab, { bottom: insets.bottom + 244, backgroundColor: c.backgroundElement, borderColor: userLoc ? c.accent : c.border }]}
      >
        <Ionicons name="locate-outline" size={21} color={userLoc ? c.accent : c.text} />
      </Pressable>

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
              onPress={() => {
                setPriority(i);
                // Con ruta en pantalla, cambiar la prioridad RECALCULA de inmediato.
                if (routes && dest && !onTrip) goSafe(i);
              }}
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

        {onTrip ? (
          <View style={styles.tripRow}>
            <View style={[styles.levelChip, { borderColor: levelUi[tripLevel].color }]}>
              <View style={[styles.levelDot, { backgroundColor: levelUi[tripLevel].color }]} />
              <Text style={{ color: levelUi[tripLevel].color, fontSize: 13, fontWeight: '700' }}>
                {levelUi[tripLevel].label}
              </Text>
            </View>
            <Pressable
              onPress={stopTrip}
              style={({ pressed }) => [
                styles.cta, styles.tripStop,
                { borderColor: c.coral, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.ctaText, { color: c.coral }]}>Finalizar</Text>
            </Pressable>
          </View>
        ) : routes ? (
          <Pressable
            onPress={startTrip}
            style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.ctaText}>Iniciar recorrido</Text>
          </Pressable>
        ) : dest ? (
          <Pressable
            onPress={() => goSafe()}
            disabled={routing}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.accent, opacity: routing ? 0.45 : pressed ? 0.85 : 1 },
            ]}
          >
            {routing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.ctaText}>Ir seguro</Text>}
          </Pressable>
        ) : (
          // Sin destino también te cuidamos: el modelo PREDICE a dónde vas por cómo te
          // mueves y lanza la alerta anticipada (OE1+OE3). CTA secundario, no invasivo.
          <Pressable
            onPress={startTrip}
            style={({ pressed }) => [
              styles.cta, styles.ctaGhost,
              { borderColor: c.accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: c.accent }]}>Recorrido libre</Text>
          </Pressable>
        )}
        {Platform.OS === 'web' && (
          <Text style={[styles.hintWeb, { color: c.textSecondary }]}>
            En el navegador la ubicación usa el diálogo del propio navegador.
          </Text>
        )}
      </View>

      <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
      <ReportSheet visible={showReport} onClose={() => setShowReport(false)} location={userLoc} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Botonera flotante: círculos consistentes (44pt, área táctil accesible)
  fab: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rightStack: { position: 'absolute', right: 16, gap: 10 },
  inStack: { position: 'relative' },
  locFab: { right: 16 },
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
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tripRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  levelChip: {
    flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: 14,
  },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  tripStop: { flex: 1, backgroundColor: 'transparent', borderWidth: 1.5 },
  hintWeb: { fontSize: 11, textAlign: 'center' },
});
