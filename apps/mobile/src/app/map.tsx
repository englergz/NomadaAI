// Vista principal de la app de usuario (Fases 2–3): mapa + buscador de destino +
// ruta segura vs directa + alertas graduadas por acción durante el recorrido.
// Permisos (ubicación, notificaciones) SIEMPRE en contexto, nunca al abrir.
// Regla de ruteo: EVITAR cuando hay alternativa; AVISAR cuando el riesgo es inevitable.
//
// ARQUITECTURA (U7-ARCH): esta vista compone hooks con la lógica de negocio y se queda
// con la composición y el JSX:
//   hooks/use-city    ciudad activa, cobertura por grados, capa de riesgo y lugares
//   hooks/use-trip    recorrido, alertas, recálculo, inactividad, segundo plano
//   hooks/use-banner  aviso de estado con auto-descarte
//   hooks/use-health  estado del servicio con diagnóstico
//   hooks/use-ota     tarjeta de actualización y novedades
// Aquí siguen: ubicación (locate), ruteo (goSafe), búsqueda y la barra inferior.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Keyboard, Linking, Platform, Pressable,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_PROTECTION_LEVELS, lambdaForLevel } from '@nomadaai/shared';
import type { BuildRouteResponse, Coordinate } from '@nomadaai/shared';

import BrandWordmark from '@/components/brand';
import CitySheet from '@/components/city-sheet';
import WhatsNewSheet from '@/components/whats-new-sheet';
import { CLERK_ENABLED } from '@/lib/auth';
import ProtectionSheet from '@/components/protection-sheet';
import ReportSheet from '@/components/report-sheet';
import RiskMap from '@/components/risk-map';
import SettingsSheet, { VEHICLES } from '@/components/settings-sheet';
import NotificationsSheet from '@/components/notifications-sheet';
import HelpSheet from '@/components/help-sheet';
import LegalSheet from '@/components/legal-sheet';
import PrivacySheet from '@/components/privacy-sheet';
import ProtectionSlider from '@/components/protection-slider';
import { useBanner } from '@/hooks/use-banner';
import { useCity } from '@/hooks/use-city';
import { useHealth } from '@/hooks/use-health';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useOta } from '@/hooks/use-ota';
import { useWriteQueue } from '@/hooks/use-write-queue';
import { useTrip } from '@/hooks/use-trip';
import { markBootReady } from '@/lib/boot';
import { applyUpdate } from '@/lib/ota';
import { hasUnseenAlerts } from '@/lib/alert-log';
import type { RouteLines } from '@/components/risk-map.types';
import { useLang, useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme, useSettings } from '@/lib/settings';
import { CITIES, DEFAULT_CITY, type CityKey } from '@/constants/map';
import { Colors, Radii } from '@/constants/theme';
import { api } from '@/lib/api';
import { levelFor, zoneAt, type AlertLevel } from '@/lib/alerts';
import { coverageCity, searchPlaces, type Place } from '@/lib/geocode';

// Nivel de protección → λ (risk_weight) del backend. Naming de producto: habla del
// valor (protegerte), no de la geometría de la ruta; empata con «Tu protección».
// Los NIVELES (porcentajes) los define el panel admin y llegan por GET /config/app,
// igual que en el escritorio; λ del ruteo sale de lambdaForLevel(). Aquí solo
// quedan las palabras que acompañan a los extremos y al centro.
const PRIO_WORDS = ['map.prio.min', 'map.prio.balanced', 'map.prio.max'] as const;
function prioWordKey(i: number, total: number) {
  if (i === 0) return PRIO_WORDS[0];
  if (i === total - 1) return PRIO_WORDS[2];
  return PRIO_WORDS[1];
}

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
  const lang = useLang();
  const scheme = useResolvedScheme();
  const dark = scheme === 'dark';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  // Altura del teclado: la barra inferior (con el input y los resultados) sube por
  // encima del teclado en vez de quedar tapada.
  const kbHeight = useKeyboardHeight();
  const { settings, set, hydrated } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProtection, setShowProtection] = useState(false);
  // Notificaciones (historial de alertas) con puntico de «sin leer».
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(false);
  useEffect(() => { hasUnseenAlerts().then(setUnread); }, []);

  const { banner, setBanner } = useBanner();
  const [focus, setFocus] = useState<{ center: [number, number]; zoom: number } | null>(null);
  // Parar el viaje antes de cambiar de ciudad: stopTrip se crea más abajo (use-trip).
  const stopTripRef = useRef<() => void>(() => {});
  // U3 · Ciudad activa y cobertura por grados (riesgo / ruteo / predicción): hooks/use-city.ts.
  // Estado del servicio (/health cada 60 s, con diagnóstico): punto verde/coral del
  // chip de ciudad y aviso SOLO al cambiar de estado.
  const { healthOk, netState } = useHealth((key, state) => setBanner({ text: t(key), tone: state === 'lento' ? 'info' : 'warn' }));
  const online = netState === 'ok' || netState === 'lento';
  const {
    city, showCity, setShowCity, citySuggest, setCitySuggest, routeCities, riskCities, riskCitiesRef,
    canPredict, cityFull, riskData, riskRef, poisData, switchCity,
  } = useCity({
    t, lang, setBanner, setFocus, poisOn: settings.poisOn, online,
    onBeforeSwitch: () => { stopTripRef.current(); setDest(null); setRoutes(null); setQuery(''); setResults([]); },
  });
  const { otaPending, otaDismissed, setOtaDismissed, showNews, setShowNews } = useOta();


  // Vehículo del viaje: por defecto el del perfil (Ajustes), cambiable en cada viaje (B.6.1).
  // undefined = usar el predeterminado · null = «sin vehículo» explícito para este viaje.
  const [tripVehicle, setTripVehicle] = useState<string | null | undefined>(undefined);
  const effVehicle = tripVehicle === undefined ? settings.vehicle : tripVehicle;
  // Ref para los callbacks de GPS (se registran una vez y no ven re-renders):
  // el consejo de la alerta usa el vehículo EFECTIVO del viaje, no uno congelado.
  const effVehicleRef = useRef(effVehicle);
  useEffect(() => { effVehicleRef.current = effVehicle; }, [effVehicle]);

  const riskOn = settings.riskOn; // capa de riesgo: vive en Ajustes (con acceso rápido aquí)
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [outOfCoverage, setOutOfCoverage] = useState(false);

  // Centro REAL del área visible del mapa (entre el tope y la barra inferior):
  // ahí se centra la columna de FABs.
  const { height: winH } = useWindowDimensions();
  const [sheetH, setSheetH] = useState(320);
  const stackTop = Math.max(insets.top + 96, (winH - sheetH) / 2 - 135);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dest, setDest] = useState<Place | null>(null);
  // Índice del nivel de protección; arranca en el CENTRO de la escala (equilibrada).
  const [priority, setPriority] = useState(Math.floor((DEFAULT_PROTECTION_LEVELS.length - 1) / 2));
  const [routing, setRouting] = useState(false);
  const [routes, setRoutes] = useState<RouteLines | null>(null);
  const searchSeq = useRef(0);

  // Refs para los callbacks de GPS (ven estado fresco sin re-suscribir el watcher).
  const routesRef = useRef<RouteLines | null>(null);
  useEffect(() => { routesRef.current = routes; }, [routes]);
  const destRef = useRef<Place | null>(null);
  useEffect(() => { destRef.current = dest; }, [dest]);
  // Niveles de protección configurables desde el panel admin (misma fuente que el
  // escritorio). Si el servidor no responde, se usan los del contrato compartido.
  const [protLevels, setProtLevels] = useState<number[]>(DEFAULT_PROTECTION_LEVELS);
  const protLevelsRef = useRef(protLevels);
  useEffect(() => { protLevelsRef.current = protLevels; }, [protLevels]);
  useEffect(() => {
    let alive = true;
    api.appConfig()
      .then((cfg) => {
        const lv = cfg?.protection_levels;
        if (alive && Array.isArray(lv) && lv.length >= 2) setProtLevels(lv);
      })
      .catch(() => { /* sin config del servidor seguimos con los valores por defecto */ });
    return () => { alive = false; };
  }, []);

  // Reportes y viajes que se guardaron sin señal salen solos cuando vuelve.
  useWriteQueue(netState, (n) => setBanner({ text: t('queue.sent', { n }), tone: 'ok' }));


  // Ubicación por defecto al abrir: se pide con el DIÁLOGO NATIVO directamente
  // (cero fricción — nunca mandar al usuario a buscar el ajuste a mano).
  useEffect(() => {
    // El splash espera este paso: se marca al terminar, salga bien o mal.
    locate().finally(() => markBootReady('location'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const cov = coverageCity(loc as Coordinate, 40, riskCitiesRef.current as CityKey[]);
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
          risk_weight: lambdaForLevel(protLevelsRef.current[prioIdx] ?? 50),
          type: effVehicle ?? undefined, // calles según el vehículo (opcional)
          city,                          // grafo vial de la ciudad activa (Tumaco, Cali…)
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
      // Con la ruta lista, vuelve a TU ubicación (origen) para arrancar desde ahí.
      if (!silent) setFocus({ center: origin as [number, number], zoom: 15 });
      comparisonRef.current = r.comparison ?? null;
      distancesRef.current = {
        safe: r.comparison?.safe_distance_m ?? r.distance_m,
        direct: r.comparison?.direct_distance_m ?? null,
      };
      const red = r.comparison?.exposure_reduction_pct ?? 0;
      const km = (r.distance_m / 1000).toFixed(1);
      const lv = protLevelsRef.current;
      const prio = `${t(prioWordKey(prioIdx, lv.length))} (${lv[prioIdx] ?? 50}%)`;
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

  // RECORRIDO: seguimiento, alertas, recálculo, inactividad y segundo plano viven en
  // hooks/use-trip.ts (U7-ARCH). goSafe entra por callback porque necesita los refs
  // de comparación que allí se crean.
  const {
    onTrip, heading, tripLevel, startTrip, stopTrip, handlePosition, comparisonRef, distancesRef,
  } = useTrip({
    t, accent: c.accent, settings, hydrated, city, canPredict, riskRef, routesRef, destRef, dest,
    effVehicle, effVehicleRef, priority, setPriority, setTripVehicle,
    userLoc, setUserLoc, locate,
    goSafe: (prioIdx, origin, silent) => goSafe(prioIdx, origin, silent),
    setBanner, setFocus, setUnread,
  });
  stopTripRef.current = stopTrip;


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
      {/* Cerrar el teclado tocando el MAPA. Solo existe con el teclado abierto y
          solo cubre el área del mapa: así no roba toques al buscador (tocar dentro
          del input para mover el cursor no debe bajar el teclado) ni a los FABs.
          Antes, si abrías el buscador y no escribías nada, no había salida. */}
      {kbHeight > 0 && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: sheetH + kbHeight }}
          onPress={() => Keyboard.dismiss()}
          accessibilityLabel={t('map.dismissKeyboard')}
        />
      )}

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
      {otaPending && !otaDismissed && !citySuggest && (
        <View style={[styles.citySuggest, { top: insets.top + 94, backgroundColor: c.backgroundElement, borderColor: c.accent }]}>
          <Text style={{ color: c.text, fontSize: 12.5, textAlign: 'center' }}>
            {onTrip ? t('ota.onTrip') : t('ota.ready')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!onTrip && (
              <Pressable
                onPress={() => { void applyUpdate(); }}
                style={[styles.citySuggestBtn, { backgroundColor: c.accent }]}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('ota.applyNow')}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setOtaDismissed(true)}
              style={[styles.citySuggestBtn, { borderWidth: 1, borderColor: c.border }]}
            >
              <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('ota.later')}</Text>
            </Pressable>
          </View>
        </View>
      )}

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
      {banner && !citySuggest && !(otaPending && !otaDismissed) && (
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
        style={[styles.sheet, { bottom: kbHeight, paddingBottom: (kbHeight ? 12 : insets.bottom + 2), backgroundColor: c.backgroundElement, borderColor: c.border }]}
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
                  // Vuela al lugar elegido para VER el pin y confirmar que es el sitio
                  // correcto (como cualquier app de mapas) antes de trazar la ruta.
                  if (!onTrip) setFocus({ center: item.coord, zoom: 16 });
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
          levels={protLevels}
          value={priority}
          onChange={(v) => {
            setPriority(v);
            // Cambiar el nivel RECALCULA en vivo si hay ruta — también durante el
            // recorrido (desde la posición actual, sin cortar el viaje).
            if (routes && dest) goSafe(v, onTrip ? (userLoc ?? undefined) : undefined, onTrip);
          }}
        />
        </>)}

        {!cityFull && !onTrip ? (
          // Honestidad U3: aquí no hay ruta segura todavía, PERO sí protección.
          <>
            <Text style={{ color: c.textSecondary, fontSize: 12.5, lineHeight: 18, textAlign: 'center', paddingVertical: 6 }}>
              {t('city.riskOnly', { city: CITIES[city].label })}
            </Text>
            <Pressable
              onPress={startTrip}
              style={({ pressed }) => [styles.cta, styles.ctaGhost, { borderColor: c.accent, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: c.accent, fontSize: 15, fontWeight: '700' }}>{t('map.cta.freeTrip')}</Text>
            </Pressable>
          </>
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

      <HelpSheet visible={showHelp} onClose={() => setShowHelp(false)} />
      <LegalSheet visible={showLegal} mode="read" onClose={() => setShowLegal(false)} />
      <PrivacySheet visible={showPrivacy} city={city} onClose={() => setShowPrivacy(false)} />
      <SettingsSheet visible={showSettings}
        onHelp={() => { setShowSettings(false); setShowHelp(true); }}
        onLegal={() => { setShowSettings(false); setShowLegal(true); }}
        onPrivacy={() => { setShowSettings(false); setShowPrivacy(true); }} onClose={() => setShowSettings(false)} />
      <ReportSheet visible={showReport} onClose={() => setShowReport(false)} location={userLoc} city={city} />
      <ProtectionSheet visible={showProtection} onClose={() => setShowProtection(false)} />
      <CitySheet visible={showCity} current={city} riskCities={riskCities} routeCities={routeCities} onSelect={switchCity} onClose={() => setShowCity(false)} />
      <WhatsNewSheet visible={showNews} onClose={() => setShowNews(false)} />
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
    position: 'absolute', left: 24, right: 24, borderWidth: 1, borderRadius: Radii.card,
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
    borderWidth: 1.5, borderRadius: Radii.control, paddingVertical: 10, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  citySuggestBtn: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  sheet: {
    position: 'absolute', left: 0, right: 0, gap: 10,
    borderTopWidth: 1, borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 16, paddingTop: 16,
  },
  results: { maxHeight: 200, borderBottomWidth: 1, marginBottom: 2 },
  resultRow: { paddingVertical: 9, paddingHorizontal: 10, gap: 2, borderRadius: Radii.control },
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
