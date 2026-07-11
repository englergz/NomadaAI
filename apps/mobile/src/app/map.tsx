// Vista principal de la app de usuario (Fases 2–3): mapa + buscador de destino +
// ruta segura vs directa + alertas graduadas por acción durante el recorrido.
// Permisos (ubicación, notificaciones) SIEMPRE en contexto, nunca al abrir.
// Regla de ruteo: EVITAR cuando hay alternativa; AVISAR cuando el riesgo es inevitable.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Keyboard, Linking, Platform, Pressable, StyleSheet,
  Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { BuildRouteResponse, Coordinate, RiskZonesResponse } from '@nomadaai/shared';

import BrandWordmark from '@/components/brand';
import CitySheet from '@/components/city-sheet';
import { CLERK_ENABLED } from '@/lib/auth';
import ProtectionSheet from '@/components/protection-sheet';
import ReportSheet from '@/components/report-sheet';
import RiskMap from '@/components/risk-map';
import SettingsSheet, { VEHICLES } from '@/components/settings-sheet';
import NotificationsSheet from '@/components/notifications-sheet';
import ProtectionSlider from '@/components/protection-slider';
import { hasUnseenAlerts, logAlert } from '@/lib/alert-log';
import { logTrip } from '@/lib/history';
import type { RouteLines } from '@/components/risk-map.types';
import { useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme, useSettings } from '@/lib/settings';
import { CITIES, DEFAULT_CITY, type CityKey } from '@/constants/map';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { levelFor, ProximityTracker, zoneAt, type AlertLevel } from '@/lib/alerts';
import { bearingDeg, coverageCity, distM, distToPath, searchPlaces, type Place } from '@/lib/geocode';

// Nivel de protección → λ (risk_weight) del backend. Naming de producto: habla del
// valor (protegerte), no de la geometría de la ruta; empata con «Tu protección».
const PRIORITIES = [
  { key: 'map.prio.min', w: 0.3 },
  { key: 'map.prio.balanced', w: 1.0 },
  { key: 'map.prio.max', w: 2.5 },
] as const;

// Foto del usuario en el FAB de perfil (U4). Solo se monta con Clerk habilitado;
// sin sesión (o sin foto) mantiene el icono de siempre.
function ProfileFabIcon({ color }: { color: string }) {
  const { user } = useUser();
  if (user?.imageUrl) {
    return <Image source={{ uri: user.imageUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} />;
  }
  return <Ionicons name="person-circle-outline" size={23} color={color} />;
}

export default function MapScreen() {
  const t = useT();
  const scheme = useResolvedScheme();
  const dark = scheme === 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { settings, set, hydrated } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProtection, setShowProtection] = useState(false);
  // Notificaciones (historial de alertas) con puntico de «sin leer».
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(false);
  useEffect(() => { hasUnseenAlerts().then(setUnread); }, []);

  // U3 · Ciudad activa: el mapa, la capa de riesgo y el buscador giran alrededor de ella.
  // Hoy solo Tumaco tiene pipeline completo (predicción + rutas); el resto, capa de riesgo.
  const [city, setCity] = useState<CityKey>(DEFAULT_CITY);
  const [showCity, setShowCity] = useState(false);
  const [citySuggest, setCitySuggest] = useState<CityKey | null>(null); // «¿Estás en X?»
  const [focus, setFocus] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const cityFull = city === DEFAULT_CITY;

  // Vehículo del viaje: por defecto el del perfil (Ajustes), cambiable en cada viaje (B.6.1).
  // undefined = usar el predeterminado · null = «sin vehículo» explícito para este viaje.
  const [tripVehicle, setTripVehicle] = useState<string | null | undefined>(undefined);
  const effVehicle = tripVehicle === undefined ? settings.vehicle : tripVehicle;
  // Ref para los callbacks de GPS (se registran una vez y no ven re-renders):
  // el consejo de la alerta usa el vehículo EFECTIVO del viaje, no uno congelado.
  const effVehicleRef = useRef(effVehicle);
  useEffect(() => { effVehicleRef.current = effVehicle; }, [effVehicle]);

  const riskOn = settings.riskOn; // capa de riesgo: vive en Ajustes (con acceso rápido aquí)
  const [riskData, setRiskData] = useState<RiskZonesResponse | null>(null);
  const [poisData, setPoisData] = useState<RiskZonesResponse | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'ok' | 'warn' | 'info' | 'coral' } | null>(null);
  // Los banners NO se quedan pegados: se auto-descartan según su categoría
  // (info/ok breve, advertencias más tiempo, coral=alerta persiste un poco más)
  // y siempre traen ✕ para cerrarlos a mano.
  useEffect(() => {
    if (!banner) return;
    const ms = banner.tone === 'coral' ? 15000 : banner.tone === 'warn' ? 10000 : 6000;
    const t2 = setTimeout(() => setBanner(null), ms);
    return () => clearTimeout(t2);
  }, [banner]);

  // Centro REAL del área visible del mapa (entre el tope y la barra inferior):
  // ahí se centra la columna de FABs.
  const { height: winH } = useWindowDimensions();
  const [sheetH, setSheetH] = useState(320);
  const stackTop = Math.max(insets.top + 96, (winH - sheetH) / 2 - 135);

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
  // Rumbo para el modo navegación: brújula del teléfono en nativo; en web se
  // estima con el movimiento (bearing entre posiciones consecutivas).
  const [heading, setHeading] = useState<number | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const [tripLevel, setTripLevel] = useState<AlertLevel>('despejado');
  const trackerRef = useRef(new ProximityTracker());
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  // Inactividad: si el usuario lleva rato quieto se pregunta si sigue en viaje;
  // sin respuesta y sin moverse, se finaliza solo (no drena batería para siempre).
  const lastMoveAtRef = useRef(0);
  const idlePromptsRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const riskRef = useRef<RiskZonesResponse | null>(null);
  useEffect(() => { riskRef.current = riskData; }, [riskData]);
  // Refs para los callbacks de GPS (ven estado fresco sin re-suscribir el watcher).
  const routesRef = useRef<RouteLines | null>(null);
  useEffect(() => { routesRef.current = routes; }, [routes]);
  const destRef = useRef<Place | null>(null);
  useEffect(() => { destRef.current = dest; }, [dest]);
  const lastRerouteRef = useRef(0);
  const reroutingRef = useRef(false);

  // Estado del servicio: comprobación REAL de /health, repetida cada 60 s. Alimenta
  // el punto verde/coral del chip de ciudad; si cae, además avisa con un banner.
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => api.health()
      .then(() => { if (alive) setHealthOk(true); })
      .catch(() => {
        if (!alive) return;
        setHealthOk((prev) => {
          if (prev !== false) setBanner({ text: t('home.offline'), tone: 'warn' });
          return false;
        });
      });
    check();
    const iv = setInterval(check, 60000);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ubicación por defecto al abrir: se pide con el DIÁLOGO NATIVO directamente
  // (cero fricción — nunca mandar al usuario a buscar el ajuste a mano).
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capa de riesgo POR CIUDAD (U3): al cambiar de ciudad se recarga la malla.
  useEffect(() => {
    let alive = true;
    api.riskZones(undefined, city)
      .then((d) => { if (alive) setRiskData(d); })
      .catch(() => {
        // Sin riesgo no bloqueamos el mapa, pero el usuario debe saberlo (estado de error).
        if (alive) setBanner({ text: t('map.banner.riskLoadError'), tone: 'warn' });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Capa Lugares: se carga la primera vez que se activa en Ajustes.
  // Los POIs del backend son de Tumaco; en otras ciudades la capa no aplica.
  useEffect(() => {
    if (!settings.poisOn || poisData || city !== DEFAULT_CITY) return;
    let alive = true;
    api.pois(500)
      .then((d) => { if (alive) setPoisData(d as RiskZonesResponse); })
      .catch(() => { /* sin POIs la capa queda vacía */ });
    return () => { alive = false; };
  }, [settings.poisOn, poisData, city]);

  // Cambio de ciudad: encuadra, limpia el viaje en curso y es honesto con lo disponible.
  function switchCity(k: CityKey) {
    if (k === city) return;
    stopTrip();
    setDest(null); setRoutes(null); setQuery(''); setResults([]);
    setCity(k);
    setCitySuggest(null);
    setFocus({ center: CITIES[k].center, zoom: CITIES[k].zoom });
    // La nota fija de la barra inferior ya explica lo disponible; sin banner duplicado.
    setBanner(null);
  }

  // Búsqueda con debounce; se descartan respuestas viejas.
  useEffect(() => {
    const seq = ++searchSeq.current;
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchPlaces(query, city)
        .then((r) => { if (searchSeq.current === seq) { setResults(r); setSearching(false); } })
        .catch(() => { if (searchSeq.current === seq) setSearching(false); });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, city]);

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
      // requestForegroundPermissionsAsync ABRE el diálogo nativo del sistema.
      // Solo si el usuario lo negó de forma permanente (el SO ya no deja volver a
      // preguntar) se le lleva DIRECTO a los ajustes de la app — nada manual.
      const perm = await withTimeout(
        Location.requestForegroundPermissionsAsync(), 20000, 'permiso',
      );
      if (perm.status !== 'granted') {
        if (!perm.canAskAgain && Platform.OS !== 'web') {
          Linking.openSettings().catch(() => { /* último recurso */ });
        }
        setBanner({ text: t('map.banner.noPermission'), tone: 'warn' });
        return null;
      }
      // GPS robusto: primero la última posición conocida (respuesta INMEDIATA) y
      // en paralelo un fix fresco de alta precisión con más margen — el fallo
      // recurrente era el timeout corto de un único intento.
      let pos = await Location.getLastKnownPositionAsync({ maxAge: 60000 }).catch(() => null);
      try {
        pos = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 25000, 'gps',
        );
      } catch {
        if (!pos) throw new Error('gps');
        // sin fix fresco pero con última posición: seguimos con ella
      }
      const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      setUserLoc(loc);
      // Centrar SIEMPRE al ubicar (antes solo volaba la primera vez).
      setFocus({ center: loc, zoom: 16 });
      // Cobertura: si está lejos de toda ciudad soportada, avisamos con honestidad.
      const cov = coverageCity(loc as Coordinate);
      setOutOfCoverage(!cov);
      if (!cov) {
        setBanner({
          text: t('map.banner.noCoverage', { city: CITIES[DEFAULT_CITY].label }),
          tone: 'info',
        });
      } else if (cov !== city) {
        // U3: detectamos otra ciudad soportada — se PREGUNTA antes de cambiar, no se impone.
        setCitySuggest(cov);
      }
      return loc;
    } catch {
      setBanner({ text: t('map.banner.noLocation'), tone: 'warn' });
      return null;
    }
  }

  const lastOriginRef = useRef<[number, number] | null>(null);

  async function goSafe(prioIdx: number = priority, originOverride?: [number, number], silent = false, destOverride?: Place) {
    // destOverride: al elegir destino durante un viaje, `dest` del estado aún no se
    // actualizó en este tick — se usa el place recibido directamente.
    const target = destOverride ?? dest;
    if (!target || routing) return;
    Keyboard.dismiss();
    setRouting(true);
    if (!silent) setBanner({ text: t('map.banner.routing'), tone: 'info' });
    try {
      // Origen: el forzado (recálculo desde la posición actual al desviarse), o tu
      // ubicación si está en cobertura; si no, el centro de la ciudad demo.
      let origin = originOverride ?? (userLoc && !outOfCoverage ? userLoc : null) ?? lastOriginRef.current;
      if (!origin) {
        const loc = await locate().catch(() => null);
        origin = loc && coverageCity(loc as Coordinate) ? loc : CITIES[city].center;
      }
      lastOriginRef.current = origin;
      const r: BuildRouteResponse = await withTimeout(
        api.buildRoute({
          origin: origin as Coordinate,
          dest: target.coord,
          hour: new Date().getHours(),
          risk_weight: PRIORITIES[prioIdx].w,
          type: effVehicle ?? undefined, // calles según el vehículo (opcional)
        }),
        // silent=recálculo por desvío: banner discreto, no interrumpe el viaje.
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
      comparisonRef.current = r.comparison ?? null;
      distancesRef.current = {
        safe: r.comparison?.safe_distance_m ?? r.distance_m,
        direct: r.comparison?.direct_distance_m ?? null,
      };
      const red = r.comparison?.exposure_reduction_pct ?? 0;
      const km = (r.distance_m / 1000).toFixed(1);
      const prio = t(PRIORITIES[prioIdx].key);
      // EVITAR vs AVISAR: si el desvío no reduce exposición, no fingimos un desvío útil.
      // Siempre se muestran km y % para que se VEA el recálculo aunque el trazo coincida.
      if (silent) {
        setBanner({ text: t('map.banner.rerouted'), tone: 'info' });
      } else if (red >= 2) {
        setBanner({ text: t('map.banner.routeOk', { prio: prio.toLowerCase(), km, red: red.toFixed(1) }), tone: 'ok' });
      } else {
        setBanner({ text: t('map.banner.routeNoAlt', { km, red: red.toFixed(1) }), tone: 'warn' });
      }
    } catch {
      if (!silent) setBanner({ text: t('map.banner.routeError'), tone: 'warn' });
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
  const alertsRef = useRef(0); // alertas emitidas a tiempo en este viaje (para «Tu protección»)
  const comparisonRef = useRef<BuildRouteResponse['comparison'] | null>(null);
  const distancesRef = useRef<{ safe: number | null; direct: number | null }>({ safe: null, direct: null });

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
        type: effVehicle ?? undefined,
        t_seconds: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
        day: (d.getDay() + 6) % 7, // JS 0=dom → API 0=lun
        speed_mps: Math.min(Math.max(speedMps, 1), 39),
        threshold: settings.threshold,
      });
      const a = r.alert;
      // Alerta anticipada: llega ANTES de entrar a la zona; misma regla una-vez-por-zona.
      if (a?.is_high && trackerRef.current.seenOnce(`pre:${a.cell_id}`)) {
        alertsRef.current += 1;
        const lvl = levelFor(a.risk_norm);
        const eta = a.arrival_min > 0 ? t('map.pre.etaMin', { min: a.arrival_min }) : t('map.pre.etaAhead');
        const title = lvl === 'atencion' ? t('map.pre.title.attention') : t('map.pre.title.caution');
        const body = t('map.pre.body', { eta });
        setBanner({ text: `${title}: ${body}`, tone: lvl === 'atencion' ? 'coral' : 'warn' });
        notifyLocal(t('map.pre.notifTitle', { title, eta }), body);
        logAlert({
          zone: String(a.cell_id),
          level: lvl === 'atencion' ? 'atencion' : 'precaucion',
          action: body,
          kind: 'anticipada',
        });
        setUnread(true);
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
      alertsRef.current += 1;
      // Mensajes por acción desde el diccionario (U2): mismo texto en banner y notificación.
      // En «Atención», el consejo se adapta al vehículo efectivo del viaje: carro →
      // ventanas arriba; moto → casco; otro/ninguno → genérico.
      const veh = effVehicleRef.current;
      const attBody = veh === 'car' ? t('alert.attention.body.car')
        : veh === 'moto' ? t('alert.attention.body.moto')
        : t('alert.attention.body');
      const title = alert.level === 'atencion' ? t('alert.attention.title') : t('alert.caution.title');
      const body = alert.level === 'atencion' ? attBody : t('alert.caution.body');
      setBanner({ text: `${title}: ${body}`, tone: alert.level === 'atencion' ? 'coral' : 'warn' });
      notifyLocal(title, body);
      logAlert({
        zone: alert.cellId,
        level: alert.level === 'atencion' ? 'atencion' : 'precaucion',
        action: body,
        kind: 'proximidad',
      });
      setUnread(true);
    }
    // Acumula el prefijo y estima velocidad entre las dos últimas posiciones.
    const now = Date.now() / 1000;
    const pts = tripPtsRef.current;
    const prev = pts[pts.length - 1];
    pts.push({ lon: pos[0], lat: pos[1], t: now });
    if (pts.length > 120) pts.splice(0, pts.length - 120);
    // Movimiento real (>8 m) reinicia el reloj de inactividad.
    if (prev && distM([prev.lon, prev.lat], pos) > 8) {
      lastMoveAtRef.current = Date.now();
      idlePromptsRef.current = 0;
    }
    // RECÁLCULO AL DESVIARSE: si te alejas >45 m de la ruta segura, se traza una
    // nueva desde tu posición actual (máx. 1 recálculo cada 12 s).
    const rt = routesRef.current;
    if (rt?.safe && rt.safe.length > 1 && destRef.current && !reroutingRef.current) {
      const off = distToPath(pos, rt.safe);
      if (off > 45 && Date.now() - lastRerouteRef.current > 12000) {
        lastRerouteRef.current = Date.now();
        reroutingRef.current = true;
        goSafe(priority, pos, true).finally(() => { reroutingRef.current = false; });
      }
    }
    // Rumbo estimado por movimiento (fallback web y respaldo si no hay brújula).
    if (prev && Platform.OS === 'web' && distM([prev.lon, prev.lat], pos) > 3) {
      setHeading(bearingDeg([prev.lon, prev.lat], pos));
    }
    if (prev) {
      const dt = now - prev.t;
      const speed = dt > 0 ? distM([prev.lon, prev.lat], pos) / dt : 0;
      if (speed >= 4) feedModel(speed); // ~15 km/h: hay desplazamiento real (moto/carro/bus)
    }
  }

  async function startTrip() {
    if (onTrip) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setBanner({ text: t('map.banner.tripNeedsLocation'), tone: 'warn' });
      return;
    }
    // SIN posición no hay viaje: se informa lo que pasa de fondo y se exige un
    // fix real antes de arrancar (lo que prometemos es tiempo real).
    if (!userLoc) {
      setBanner({ text: t('map.banner.locating'), tone: 'info' });
      const loc = await locate();
      if (!loc) return; // locate() ya explicó el porqué
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
    alertsRef.current = 0;
    lastMoveAtRef.current = Date.now();
    idlePromptsRef.current = 0;
    // Vigilancia de inactividad: revisa cada 30 s cuánto llevas quieto.
    idleTimerRef.current = setInterval(() => {
      const idleMin = (Date.now() - lastMoveAtRef.current) / 60000;
      if (idleMin >= 30 && idlePromptsRef.current >= 1) {
        // Segunda vez sin moverse ni responder → se finaliza solo.
        setBanner({ text: t('map.banner.tripAutoEnd'), tone: 'info' });
        stopTrip();
      } else if (idleMin >= 15 && idlePromptsRef.current < 1) {
        idlePromptsRef.current = 1;
        Alert.alert(t('map.idle.title'), t('map.idle.body'), [
          { text: t('map.idle.end'), style: 'destructive', onPress: stopTrip },
          { text: t('map.idle.continue'), onPress: () => { lastMoveAtRef.current = Date.now(); idlePromptsRef.current = 0; } },
        ]);
      }
    }, 30000);
    setTripLevel('despejado');
    setOnTrip(true);
    setBanner({ text: t('map.banner.tripStarted'), tone: 'info' });
    // TIEMPO REAL: máxima precisión y refresco ~1 s / 3 m (antes 4 s / 15 m = el
    // «relento»). El rumbo del propio GPS (course) es más estable que la brújula
    // cuando hay velocidad, así que se usa como fuente principal en movimiento.
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 },
      (p) => {
        if (typeof p.coords.heading === 'number' && p.coords.heading >= 0 && (p.coords.speed ?? 0) > 1.5) {
          setHeading(p.coords.heading);
        }
        handlePosition([p.coords.longitude, p.coords.latitude]);
      },
    );
    // Brújula (nativo): el mapa/vehículo se orientan a donde apunta el teléfono.
    if (Platform.OS !== 'web') {
      try {
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (deg >= 0) setHeading(deg);
        });
      } catch { /* sin brújula: rumbo por movimiento */ }
    }
  }

  function stopTrip() {
    watchRef.current?.remove();
    watchRef.current = null;
    headingSubRef.current?.remove();
    headingSubRef.current = null;
    if (idleTimerRef.current) { clearInterval(idleTimerRef.current); idleTimerRef.current = null; }
    setHeading(null);
    // Salida GARANTIZADA del modo navegación: además del reset de pitch/rumbo,
    // se fuerza un encuadre normal sobre la última posición conocida.
    if (userLoc) setFocus({ center: userLoc, zoom: 15 });
    // Sin movimiento real no hay viaje que registrar: evita el «viaje fantasma»
    // de pulsar Recorrido libre y finalizar sin haberse movido.
    const moved = tripPtsRef.current.length >= 4;
    if (onTrip && moved) {
      setBanner(null);
      // Registra el viaje real en «Tu protección» (mode: mobile — BI lo separa del simulador).
      const comp = comparisonRef.current;
      logTrip({
        vehicle: effVehicle,
        hour: new Date().getHours(),
        alerts: alertsRef.current,
        exposure_reduction_pct: comp?.exposure_reduction_pct ?? null,
        safe_exposure: comp?.safe_exposure ?? null,
        direct_exposure: comp?.direct_exposure ?? null,
        safe_dist_m: distancesRef.current.safe,
        direct_dist_m: distancesRef.current.direct,
      });
    }
    setOnTrip(false);
    setTripLevel('despejado');
  }

  useEffect(() => () => { watchRef.current?.remove(); headingSubRef.current?.remove(); }, []);

  // Recorrido libre AUTOMÁTICO (Ajustes): vigilancia ligera SOLO si el permiso ya fue
  // concedido; al detectar movimiento sostenido (~≥15 km/h) el recorrido arranca solo.
  const onTripRef = useRef(onTrip);
  useEffect(() => { onTripRef.current = onTrip; }, [onTrip]);
  useEffect(() => {
    if (!settings.autoTrip || onTrip || !cityFull) return; // sin pipeline no hay recorrido
    let sub: Location.LocationSubscription | null = null;
    let prev: { lon: number; lat: number; t: number } | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm?.granted || cancelled) return; // el permiso se pide en contexto, no aquí
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 30 },
        (p) => {
          const cur = { lon: p.coords.longitude, lat: p.coords.latitude, t: Date.now() / 1000 };
          if (prev && !onTripRef.current) {
            const dt = cur.t - prev.t;
            const speed = dt > 0 ? distM([prev.lon, prev.lat], [cur.lon, cur.lat]) / dt : 0;
            if (speed >= 4) {
              sub?.remove(); sub = null;
              startTrip();
              setBanner({ text: t('map.banner.autoTrip'), tone: 'info' });
            }
          }
          prev = cur;
        },
      );
    })();
    return () => { cancelled = true; sub?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoTrip, onTrip, cityFull]);

  // Sonda de desarrollo: permite inyectar posiciones para verificar alertas sin GPS.
  if (__DEV__ && Platform.OS === 'web') {
    (globalThis as Record<string, unknown>).__alertProbe = (lon: number, lat: number) =>
      handlePosition([lon, lat]);
  }

  const toneColor = { ok: c.ok, warn: c.amber, info: c.accent, coral: c.coral } as const;
  // Paleta de alertas por acción: azul → ámbar → coral (nunca rojo puro en UI).
  const levelUi: Record<AlertLevel, { label: string; color: string }> = {
    despejado: { label: t('map.level.clear'), color: c.accent },
    precaucion: { label: t('map.level.caution'), color: c.amber },
    atencion: { label: t('map.level.attention'), color: c.coral },
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
          satellite={settings.satellite} poisData={poisData} poisOn={settings.poisOn && cityFull}
          poiCategoryLabel={(cat) => t(`poi.cat.${cat}` as TKey) === `poi.cat.${cat}` ? t('poi.cat.default') : t(`poi.cat.${cat}` as TKey)}
          focus={focus}
          nav={{ active: onTrip, heading, vehicle: effVehicle ?? null }}
        />
      )}

      {/* B2: marca flotante arriba-centro SIN relleno — flota sobre el mapa con un halo
          suave que garantiza contraste en base clara, oscura y satelital */}
      <View style={[styles.brand, { top: insets.top + 14, pointerEvents: 'none' }]}>
        <BrandWordmark
          size={17} color={c.text} withLogo
          halo={dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.95)'}
        />
      </View>

      {/* U3: chip de ciudad (estilo inDrive) — toca para cambiar */}
      <Pressable
        onPress={() => setShowCity(true)}
        style={[styles.cityChip, { top: insets.top + 52, backgroundColor: c.backgroundElement, borderColor: c.border }]}
      >
        <Ionicons name="location-outline" size={14} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 12.5, fontWeight: '700' }}>{CITIES[city].label}</Text>
        {/* Estado REAL del servicio (/health cada 60 s): verde en línea, coral caído */}
        {healthOk !== null && (
          <View style={[styles.healthDot, { backgroundColor: healthOk ? c.ok : c.coral }]} />
        )}
        <Ionicons name="chevron-down" size={13} color={c.textSecondary} />
      </Pressable>

      {/* Pila derecha centrada en el ÁREA DEL MAPA: perfil · ajustes · reportar ·
          notificaciones · centrar */}
      <View style={[styles.rightStack, { top: stackTop }]}>
        <Pressable
          onPress={() => setShowProtection(true)}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          {CLERK_ENABLED
            ? <ProfileFabIcon color={c.text} />
            : <Ionicons name="person-circle-outline" size={23} color={c.text} />}
        </Pressable>
        <Pressable
          onPress={() => setShowSettings(true)}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          <Ionicons name="settings-outline" size={21} color={c.text} />
        </Pressable>
        {/* Reportar: relleno coral con icono blanco — el FAB con más peso visual */}
        <Pressable
          onPress={() => setShowReport(true)}
          style={[styles.fab, styles.inStack, { backgroundColor: c.coral, borderColor: c.coral }]}
        >
          <Ionicons name="megaphone-outline" size={20} color="#fff" />
        </Pressable>
        {/* Notificaciones: puntico clásico de «sin leer» hasta abrirlas */}
        <Pressable
          onPress={() => { setShowNotifs(true); setUnread(false); }}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          <Ionicons name="notifications-outline" size={21} color={c.text} />
          {unread && <View style={[styles.unreadDot, { backgroundColor: c.coral, borderColor: c.backgroundElement }]} />}
        </Pressable>
        <Pressable
          onPress={locate}
          style={[styles.fab, styles.inStack, { backgroundColor: c.backgroundElement, borderColor: userLoc ? c.accent : c.border }]}
        >
          <Ionicons name="locate-outline" size={21} color={userLoc ? c.accent : c.text} />
        </Pressable>
      </View>

      {/* U3: «¿Estás en X?» — arriba, bajo el chip de ciudad; se pregunta, no se impone */}
      {citySuggest && (
        <View style={[styles.citySuggest, { top: insets.top + 94, backgroundColor: c.backgroundElement, borderColor: c.accent }]}>
          <Text style={{ color: c.text, fontSize: 12.5, textAlign: 'center' }}>
            {t('city.areYouIn', { city: CITIES[citySuggest].label })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => switchCity(citySuggest)}
              style={[styles.citySuggestBtn, { backgroundColor: c.accent }]}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('city.switch')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setCitySuggest(null)}
              style={[styles.citySuggestBtn, { borderWidth: 1, borderColor: c.border }]}
            >
              <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('city.stay')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Banner de estado ARRIBA, bajo el chip de ciudad (no tapa marca ni ubicación);
          si la tarjeta de ciudad está visible, ella tiene prioridad. */}
      {banner && !citySuggest && (
        <View style={[styles.banner, { top: insets.top + 94, backgroundColor: c.backgroundElement, borderColor: toneColor[banner.tone] }]}>
          <Text style={{ color: c.text, fontSize: 12.5, flex: 1 }}>{banner.text}</Text>
          <Pressable onPress={() => setBanner(null)} hitSlop={10}>
            <Ionicons name="close" size={15} color={c.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Barra inferior: destino + prioridad + Ir seguro */}
      <View
        onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
        style={[styles.sheet, { bottom: 0, paddingBottom: insets.bottom + 14, backgroundColor: c.backgroundElement, borderColor: c.border }]}
      >
        {cityFull && results.length > 0 && !dest && (
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item, i) => `${item.source}-${i}-${item.name}`}
            style={[styles.results, { borderColor: c.border }]}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setDest(item); setQuery(item.name); setResults([]); Keyboard.dismiss();
                  // Elegir destino DURANTE un recorrido libre traza la ruta al vuelo
                  // desde tu posición actual (el place va directo: setDest es async).
                  if (onTrip) goSafe(priority, userLoc ?? undefined, false, item);
                }}
                style={({ pressed }) => [styles.resultRow, { backgroundColor: pressed ? c.backgroundSelected : 'transparent' }]}
              >
                <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 11 }} numberOfLines={1}>{item.detail}</Text>
              </Pressable>
            )}
          />
        )}

        {/* Estado vacío del buscador: hubo consulta y no hubo resultados */}
        {cityFull && !searching && !dest && query.trim().length >= 2 && results.length === 0 && (
          <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center' }}>{t('map.noResults')}</Text>
        )}

        {/* U3: buscador/vehículo/protección solo donde hay pipeline completo */}
        {cityFull && (<>
        <View style={[styles.inputRow, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); if (dest) { setDest(null); setRoutes(null); } }}
            placeholder={t('map.searchPlaceholder')}
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

        {/* Vehículo del viaje (opcional, mejora la predicción) + prioridad de seguridad */}
        <View style={styles.metaRow}>
          <Text style={[styles.metaLbl, { color: c.textSecondary }]}>{t('map.vehicle')}</Text>
          <View style={styles.vehRow}>
            {VEHICLES.map((v) => {
              const on = effVehicle === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setTripVehicle(on ? null : v.key)}
                  hitSlop={4} // 36pt visual + 4pt por lado = área táctil ≥44pt (accesibilidad)
                  style={[styles.veh, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.backgroundSelected : 'transparent' }]}
                >
                  <Text style={{ fontSize: 14 }}>{v.icon}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {/* Barra de protección estilo volumen (reemplaza los chips largos) */}
        <ProtectionSlider
          value={priority}
          onChange={(v) => {
            setPriority(v);
            // Cambiar el nivel RECALCULA en vivo si hay ruta — también durante el
            // recorrido (desde la posición actual, sin cortar el viaje).
            if (routes && dest) goSafe(v, onTrip ? (userLoc ?? undefined) : undefined, onTrip);
          }}
        />
        </>)}

        {!cityFull ? (
          // Honestidad U3: en esta ciudad hoy solo hay capa de riesgo.
          <Text style={{ color: c.textSecondary, fontSize: 12.5, lineHeight: 18, textAlign: 'center', paddingVertical: 6 }}>
            {t('city.riskOnly', { city: CITIES[city].label })}
          </Text>
        ) : onTrip ? (
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
              <Text style={[styles.ctaText, { color: c.coral }]}>{t('map.cta.endTrip')}</Text>
            </Pressable>
          </View>
        ) : routes ? (
          <Pressable
            onPress={startTrip}
            style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.ctaText}>{t('map.cta.startTrip')}</Text>
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
              : <Text style={styles.ctaText}>{t('map.cta.go')}</Text>}
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
            <Text style={[styles.ctaText, { color: c.accent }]}>{t('map.cta.freeTrip')}</Text>
          </Pressable>
        )}
        {/* Descargo ético: visible siempre que hay ruta o recorrido activo */}
        {(routes || onTrip) && (
          <Text style={[styles.hintWeb, { color: c.textSecondary }]}>{t('map.disclaimer')}</Text>
        )}
        {Platform.OS === 'web' && (
          <Text style={[styles.hintWeb, { color: c.textSecondary }]}>{t('map.webHint')}</Text>
        )}
      </View>

      <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
      <ReportSheet visible={showReport} onClose={() => setShowReport(false)} location={userLoc} city={city} />
      <ProtectionSheet visible={showProtection} onClose={() => setShowProtection(false)} />
      <CitySheet visible={showCity} current={city} onSelect={switchCity} onClose={() => setShowCity(false)} />
      <NotificationsSheet visible={showNotifs} onClose={() => setShowNotifs(false)} />
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
  // Columna derecha; su `top` se calcula con la altura real de la barra inferior.
  rightStack: { position: 'absolute', right: 16, gap: 10 },
  inStack: { position: 'relative' },
  // Banner arriba, bajo el chip de ciudad.
  banner: {
    position: 'absolute', left: 24, right: 24, borderWidth: 1, borderRadius: 16,
    paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  healthDot: { width: 7, height: 7, borderRadius: 4 },
  unreadDot: {
    position: 'absolute', top: 6, right: 7, width: 10, height: 10, borderRadius: 5, borderWidth: 2,
  },
  brand: { position: 'absolute', alignSelf: 'center' },
  // U3: chip de ciudad bajo la marca, alineado al centro (estilo inDrive)
  cityChip: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  citySuggest: {
    position: 'absolute', left: 24, right: 24, gap: 8,
    borderWidth: 1.5, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  citySuggestBtn: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  sheet: {
    position: 'absolute', left: 0, right: 0, gap: 10,
    borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 14,
  },
  results: { maxHeight: 200, borderBottomWidth: 1, marginBottom: 2 },
  resultRow: { paddingVertical: 9, paddingHorizontal: 6, gap: 2, borderRadius: 8 },
  // Radios coherentes: todo control interactivo es píldora (999), como los FAB redondos.
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLbl: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  vehRow: { flexDirection: 'row', gap: 6 },
  veh: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  prioRow: { flex: 1, flexDirection: 'row', gap: 6, marginLeft: 12 },
  prio: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  cta: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tripRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  levelChip: {
    flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: 999,
  },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  tripStop: { flex: 1, backgroundColor: 'transparent', borderWidth: 1.5 },
  hintWeb: { fontSize: 11, textAlign: 'center' },
});
