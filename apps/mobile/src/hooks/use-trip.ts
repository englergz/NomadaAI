// RECORRIDO (Fase 3 + U7): seguimiento en tiempo real, alertas una-vez-por-zona,
// alerta anticipada por el modelo, recálculo al desviarse, inactividad, segundo
// plano (instantánea + reanudar + vigía automático). Es el corazón del producto.
//
// Sacado de map.tsx (U7-ARCH) sin cambiar comportamiento: la vista pasa lo que
// necesita (ubicación, ruta, destino, prioridad, vehículo) y recibe estado y
// acciones. `goSafe` llega por callback porque a su vez necesita los refs de
// comparación que viven aquí.
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { BuildRouteResponse, Coordinate, RiskZonesResponse } from '@nomadaai/shared';

import type { RouteLines } from '@/components/risk-map.types';
import { CITIES, type CityKey } from '@/constants/map';
import type { Banner } from '@/hooks/use-banner';
import { logAlert } from '@/lib/alert-log';
import { levelFor, ProximityTracker, zoneAt, type AlertLevel } from '@/lib/alerts';
import { api } from '@/lib/api';
import {
  clearActiveTrip, drainQueuedPoints, isResumable, loadActiveTrip,
  resumeBackgroundTrip,
  saveActiveTrip, saveNotificationCopy, startAutoTripWatch, startBackgroundTrip,
  stopAutoTripWatch, stopBackgroundTrip, type ActiveTrip,
} from '@/lib/background-trip';
import { bearingDeg, distM, distToPath, type Place } from '@/lib/geocode';
import { logTrip } from '@/lib/history';
import type { Translate } from '@/lib/i18n';
import { notifyAlert, setupAlerts } from '@/lib/notify';
import type { Settings } from '@/lib/settings';

export interface UseTripArgs {
  t: Translate;
  /** Color de acento (notificación persistente del servicio). */
  accent: string;
  settings: Settings;
  hydrated: boolean;
  city: CityKey;
  /** Hay modelo de predicción para la ciudad activa (alerta anticipada sin destino). */
  canPredict: boolean;
  riskRef: React.MutableRefObject<RiskZonesResponse | null>;
  routesRef: React.MutableRefObject<RouteLines | null>;
  destRef: React.MutableRefObject<Place | null>;
  dest: Place | null;
  effVehicle: string | null;
  effVehicleRef: React.MutableRefObject<string | null>;
  priority: number;
  setPriority: (p: number) => void;
  setTripVehicle: (v: string | null | undefined) => void;
  userLoc: [number, number] | null;
  setUserLoc: (l: [number, number]) => void;
  locate: () => Promise<[number, number] | null>;
  /** Recálculo silencioso desde la posición actual (al desviarse de la ruta segura). */
  goSafe: (prioIdx: number, origin: [number, number], silent: boolean) => Promise<void>;
  setBanner: (b: Banner | null) => void;
  setFocus: (f: { center: [number, number]; zoom: number } | null) => void;
  setUnread: (v: boolean) => void;
}

export function useTrip({
  t, accent, settings, hydrated, city, canPredict, riskRef, routesRef, destRef, dest,
  effVehicle, effVehicleRef, priority, setPriority, setTripVehicle,
  userLoc, setUserLoc, locate, goSafe, setBanner, setFocus, setUnread,
}: UseTripArgs) {
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
  const lastRerouteRef = useRef(0);
  const reroutingRef = useRef(false);
  // Segundo plano: instantánea del viaje en disco para poder reanudarlo.
  const tripStartedAtRef = useRef(0);
  const lastPersistRef = useRef(0);
  const tripMetaRef = useRef<{
    city: string; vehicle: string | null; priority: number;
    dest: ActiveTrip['dest'];
  } | null>(null);

  // Notificación local (nativa). En web solo banner in-app.
  // Los avisos de riesgo van por el canal de ALTA importancia con vibración
  // (lib/notify): silenciosos o tarde no sirven de nada en la calle.
  function notifyLocal(title: string, body: string, level: AlertLevel = 'precaucion') {
    void notifyAlert(title, body, level);
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
    if (!canPredict) return; // sin modelo entrenado no hay alerta anticipada
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
        notifyLocal(t('map.pre.notifTitle', { title, eta }), body, lvl);
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
      notifyLocal(title, body, alert.level);
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
    persistTrip();
    // RECÁLCULO AL DESVIARSE: si te alejas >45 m de la ruta segura, se traza una
    // nueva desde tu posición actual (máx. 1 recálculo cada 12 s).
    const rt = routesRef.current;
    if (rt?.safe && rt.safe.length > 1 && destRef.current && !reroutingRef.current) {
      const off = distToPath(pos, rt.safe);
      if (off > 45 && Date.now() - lastRerouteRef.current > 12000) {
        lastRerouteRef.current = Date.now();
        reroutingRef.current = true;
        goSafe(priority, pos as [number, number], true).finally(() => { reroutingRef.current = false; });
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

  // ---------- piezas del recorrido, compartidas por «iniciar» y «reanudar» ----------

  // Vigilancia de inactividad: revisa cada 30 s cuánto llevas quieto.
  function startIdleTimer() {
    if (idleTimerRef.current) clearInterval(idleTimerRef.current);
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
  }

  // TIEMPO REAL: máxima precisión y refresco ~1 s / 3 m (antes 4 s / 15 m = el
  // «relento»). El rumbo del propio GPS (course) es más estable que la brújula
  // cuando hay velocidad, así que se usa como fuente principal en movimiento.
  async function startWatchers() {
    watchRef.current?.remove();
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
        headingSubRef.current?.remove();
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (deg >= 0) setHeading(deg);
        });
      } catch { /* sin brújula: rumbo por movimiento */ }
    }
  }

  // Consume las posiciones que la tarea de fondo capturó sin pantalla. Se descarta
  // lo que ya conocemos (la tarea también corre con la app abierta, así que la cola
  // puede traer posiciones viejas) y solo la ÚLTIMA pasa por el evaluador completo:
  // así el rastro queda continuo sin una lluvia de alertas atrasadas.
  function applyQueuedPoints(queued: { lon: number; lat: number; t: number }[]) {
    const pts = tripPtsRef.current;
    const lastKnownT = pts.length ? pts[pts.length - 1].t : 0;
    const fresh = queued.filter((p) => p.t > lastKnownT).sort((a, b) => a.t - b.t);
    if (!fresh.length) return;
    pts.push(...fresh.slice(0, -1));
    if (pts.length > 120) pts.splice(0, pts.length - 120);
    const last = fresh[fresh.length - 1];
    lastMoveAtRef.current = Date.now();
    idlePromptsRef.current = 0;
    handlePosition([last.lon, last.lat]);
  }

  // Instantánea del viaje en disco: permite REANUDAR si la app se cierra o el
  // sistema la mata durante el recorrido. Se escribe con freno (cada 10 s).
  function persistTrip() {
    if (Platform.OS === 'web') return;
    const meta = tripMetaRef.current;
    if (!meta) return;
    const now = Date.now();
    if (now - lastPersistRef.current < 10000) return;
    lastPersistRef.current = now;
    void saveActiveTrip({
      startedAt: tripStartedAtRef.current || now,
      updatedAt: now,
      city: meta.city,
      vehicle: meta.vehicle,
      priority: meta.priority,
      alerts: alertsRef.current,
      dest: meta.dest,
      points: tripPtsRef.current,
    });
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
        await setupAlerts();
      } catch { /* opcional: sin notificaciones seguimos con banners */ }
    }
    trackerRef.current.reset();
    tripPtsRef.current = [];
    lastPredictRef.current = 0;
    alertsRef.current = 0;
    lastMoveAtRef.current = Date.now();
    idlePromptsRef.current = 0;
    tripStartedAtRef.current = Date.now();
    lastPersistRef.current = 0;
    startIdleTimer();
    setTripLevel('despejado');
    setOnTrip(true);
    setBanner({ text: t('map.banner.tripStarted'), tone: 'info' });
    await startWatchers();
    persistTrip();
    void stopAutoTripWatch(); // el seguimiento fino del viaje sustituye al vigía
    // SEGUNDO PLANO: la protección no puede depender de que la pantalla esté
    // encendida. Se pide «Permitir siempre» EN CONTEXTO (ya empezaste a andar) y,
    // si el usuario dice que no, el recorrido sigue igual solo en primer plano.
    if (Platform.OS !== 'web') {
      const bgOn = await startBackgroundTrip({
        title: t('map.bg.notifTitle'),
        body: t('map.bg.notifBody'),
        color: accent,
      });
      // Si quedó activo, la notificación persistente (Android) y el indicador del
      // sistema (iOS) ya lo dicen; solo hace falta avisar cuando NO quedó activo.
      if (!bgOn) setBanner({ text: t('map.bg.off'), tone: 'warn' });
    }
  }

  function stopTrip() {
    watchRef.current?.remove();
    watchRef.current = null;
    headingSubRef.current?.remove();
    headingSubRef.current = null;
    if (idleTimerRef.current) { clearInterval(idleTimerRef.current); idleTimerRef.current = null; }
    // El seguimiento de fondo y el rastro guardado se apagan y se BORRAN al
    // terminar: no dejamos ubicaciones del usuario vivas en el dispositivo.
    void stopBackgroundTrip();
    void clearActiveTrip();
    tripStartedAtRef.current = 0;
    // Al terminar, si la protección automática sigue activa vuelve a quedar el
    // vigía de bajo consumo esperando el próximo arranque.
    if (settingsRef.current.autoTrip) {
      void startAutoTripWatch({ title: t('map.bg.watchTitle'), body: t('map.bg.watchBody'), color: accent });
    }
    setHeading(null);
    // Salida GARANTIZADA del modo navegación: además del reset de pitch/rumbo,
    // se fuerza un encuadre normal sobre la última posición conocida.
    // SIEMPRE se reencuadra (aunque no haya última posición): si no, el mapa se
    // queda rotado y con pitch del modo navegación hasta que cambies de ciudad.
    setFocus({ center: userLoc ?? CITIES[city].center, zoom: userLoc ? 15 : CITIES[city].zoom });
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

  // PROTECCIÓN AUTOMÁTICA EN SEGUNDO PLANO: mientras el ajuste esté activo y no
  // haya viaje, queda un vigía de bajo consumo que enciende la protección solo,
  // aunque la app esté cerrada. Los textos se guardan en disco porque la tarea
  // headless no tiene acceso al contexto de idioma de React.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    if (Platform.OS === 'web' || !hydrated) return;
    void saveNotificationCopy({
      title: t('map.bg.notifTitle'), body: t('map.bg.notifBody'), color: accent,
      autoTitle: t('map.bg.autoTitle'), autoBody: t('map.bg.autoBody'),
    });
    if (settings.autoTrip && !onTrip) {
      void startAutoTripWatch({ title: t('map.bg.watchTitle'), body: t('map.bg.watchBody'), color: accent });
    } else if (!settings.autoTrip) {
      void stopAutoTripWatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoTrip, onTrip, hydrated]);

  // Meta del viaje siempre fresca para la instantánea (la escribe un callback de
  // GPS que no ve re-renders).
  useEffect(() => {
    tripMetaRef.current = {
      city,
      vehicle: effVehicle ?? null,
      priority,
      dest: dest ? { name: dest.name, center: dest.coord as [number, number] } : null,
    };
  }, [city, effVehicle, priority, dest]);

  // REANUDAR AL VOLVER: si la app se cerró (o el sistema la mató) con un recorrido
  // en curso, al abrir se retoma donde quedó en vez de perderlo.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      const trip = await loadActiveTrip();
      if (!alive) return;
      if (!isResumable(trip)) { void clearActiveTrip(); void stopBackgroundTrip(); return; }
      // Sin permiso vigente no se puede retomar nada: se limpia y se sigue normal.
      const perm = await Location.getForegroundPermissionsAsync();
      if (!alive) return;
      if (perm.status !== 'granted') { void clearActiveTrip(); void stopBackgroundTrip(); return; }
      tripStartedAtRef.current = trip.startedAt;
      tripPtsRef.current = trip.points ?? [];
      alertsRef.current = trip.alerts ?? 0;
      lastMoveAtRef.current = Date.now();
      idlePromptsRef.current = 0;
      setPriority(trip.priority);
      if (trip.vehicle !== null) setTripVehicle(trip.vehicle);
      setOnTrip(true);
      startIdleTimer();
      try { await startWatchers(); } catch { /* sin GPS el viaje sigue con la última posición */ }
      if (!alive) return;
      // Se consume lo capturado mientras la app estuvo cerrada.
      const queued = await drainQueuedPoints();
      if (!alive) return;
      applyQueuedPoints(queued);
      // Si lo abrió el vigía automático, el usuario nunca tocó «iniciar»: hay que
      // decírselo con el copy de protección automática, no con el de «retomamos».
      setBanner({ text: trip.auto ? t('map.banner.autoTrip') : t('map.banner.tripResumed'), tone: 'info' });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RECONCILIACIÓN: mientras haya viaje, el seguimiento de fondo TIENE que estar
  // vivo. Se comprueba aquí en vez de encadenarlo al arranque porque ese camino se
  // puede interrumpir a mitad (la app se cerró, el efecto se canceló, el sistema
  // mató el servicio) y el usuario se quedaría sin protección sin enterarse.
  useEffect(() => {
    if (Platform.OS === 'web' || !onTrip) return;
    void (async () => {
      // NO se comprueba aquí `isBackgroundTripRunning()`: esa función informa del
      // REGISTRO de la tarea, que sobrevive a que el sistema mate la app, así que
      // devolvía «sí está corriendo» cuando el servicio ya estaba muerto y nunca
      // se reenganchaba. `resumeBackgroundTrip` hace el ciclo limpio de parada y
      // arranque, que es idempotente y seguro de llamar siempre.
      const ok = await resumeBackgroundTrip({
        title: t('map.bg.notifTitle'), body: t('map.bg.notifBody'), color: accent,
      });
      // Si no se pudo enganchar, el usuario TIENE que saberlo: creería que está
      // protegido con la pantalla apagada y no lo estaría. (En release los
      // console.warn se eliminan, así que el aviso en pantalla es además la única
      // señal observable de este fallo.)
      if (!ok) setBanner({ text: t('map.bg.off'), tone: 'warn' });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrip]);

  // Al volver del segundo plano se consumen las posiciones capturadas mientras la
  // app no estaba en pantalla: el rastro queda continuo, sin lluvia de alertas
  // viejas (solo la última posición pasa por el evaluador completo).
  const onTripStateRef = useRef(onTrip);
  useEffect(() => { onTripStateRef.current = onTrip; }, [onTrip]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !onTripStateRef.current) return;
      void drainQueuedPoints().then(applyQueuedPoints);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recorrido libre AUTOMÁTICO (Ajustes): vigilancia ligera SOLO si el permiso ya fue
  // concedido; al detectar movimiento sostenido (~≥15 km/h) el recorrido arranca solo.
  const onTripRef = useRef(onTrip);
  useEffect(() => { onTripRef.current = onTrip; }, [onTrip]);
  useEffect(() => {
    // Basta con la capa de riesgo: el recorrido y las alertas en zona no
    // dependen del modelo de predicción.
    if (!settings.autoTrip || onTrip) return;
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
  }, [settings.autoTrip, onTrip]);

  return {
    onTrip, heading, tripLevel,
    startTrip, stopTrip, handlePosition,
    comparisonRef, distancesRef,
  };
}
