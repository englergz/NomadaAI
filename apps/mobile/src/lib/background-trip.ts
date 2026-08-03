// U7 · SEGUNDO PLANO DEL RECORRIDO
// La protección no puede depender de que la app esté en pantalla: si el usuario
// bloquea el teléfono o se pasa a otra app durante un viaje, el seguimiento sigue
// (servicio en primer plano en Android, background location en iOS) y al volver el
// recorrido se REANUDA con las posiciones capturadas mientras tanto.
//
// CIBERSEGURIDAD (U7-SEC), reglas de este módulo:
// - Las coordenadas NUNCA se imprimen en consola ni se mandan a terceros; solo
//   viven en el almacenamiento local del dispositivo y se borran al finalizar.
// - Se guarda el mínimo: un prefijo corto del recorrido, no el historial completo.
// - El servicio en primer plano de Android muestra SIEMPRE una notificación
//   persistente: el usuario ve que la app está midiendo su ruta, sin sorpresas.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const TRIP_TASK = 'nomadaai-trip-location';
/** Vigía de bajo consumo: detecta el arranque del viaje con la app cerrada. */
export const AUTOTRIP_TASK = 'nomadaai-autotrip-watch';

const KEY_TRIP = 'nomadaai.trip.active';
const KEY_QUEUE = 'nomadaai.trip.queue';
const KEY_WATCH = 'nomadaai.autotrip.last';

/** Máximo de posiciones que se retienen (prefijo del recorrido, no el viaje entero). */
const MAX_POINTS = 120;
/** Un viaje sin señales por más de esto se considera abandonado y no se reanuda. */
export const STALE_MS = 6 * 60 * 60 * 1000;
/** Tope duro de duración: ningún recorrido sigue midiendo más de esto. */
const MAX_TRIP_MS = 4 * 60 * 60 * 1000;
/** Sin movimiento real durante esto, el seguimiento se apaga solo. */
const MAX_IDLE_MS = 30 * 60 * 1000;
/** Metros a partir de los cuales se considera desplazamiento (y no ruido del GPS). */
const MOVE_M = 25;

export interface TripPoint { lon: number; lat: number; t: number }

export interface ActiveTrip {
  startedAt: number;
  updatedAt: number;
  /** Última vez que hubo desplazamiento real; apaga el servicio si te quedas quieto. */
  lastMoveAt?: number;
  city: string;
  vehicle: string | null;
  priority: number;
  alerts: number;
  /** Destino elegido, si el viaje lo tiene (para reanudar con ruta). */
  dest: { name: string; center: [number, number] } | null;
  points: TripPoint[];
  /** El viaje lo abrió el vigía automático, no un toque del usuario. */
  auto?: boolean;
}

// ---------- persistencia ----------

export async function loadActiveTrip(): Promise<ActiveTrip | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_TRIP);
    if (!raw) return null;
    const trip = JSON.parse(raw) as ActiveTrip;
    if (!trip?.startedAt) return null;
    return trip;
  } catch {
    return null;
  }
}

export async function saveActiveTrip(trip: ActiveTrip): Promise<void> {
  try {
    const points = trip.points.slice(-MAX_POINTS);
    await AsyncStorage.setItem(KEY_TRIP, JSON.stringify({ ...trip, points, updatedAt: Date.now() }));
  } catch { /* sin almacenamiento el viaje sigue vivo en memoria */ }
}

export async function clearActiveTrip(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY_TRIP, KEY_QUEUE]);
  } catch { /* nada que limpiar */ }
}

/** ¿El viaje guardado sigue vigente? Uno viejo se descarta en vez de reanudarse. */
export function isResumable(trip: ActiveTrip | null): trip is ActiveTrip {
  return !!trip && Date.now() - (trip.updatedAt || trip.startedAt) < STALE_MS;
}

// ---------- cola capturada en segundo plano ----------

/** Devuelve las posiciones capturadas mientras la app no estaba en pantalla y vacía la cola. */
export async function drainQueuedPoints(): Promise<TripPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_QUEUE);
    if (!raw) return [];
    await AsyncStorage.removeItem(KEY_QUEUE);
    const pts = JSON.parse(raw) as TripPoint[];
    return Array.isArray(pts) ? pts : [];
  } catch {
    return [];
  }
}

async function queuePoints(points: TripPoint[]): Promise<void> {
  if (!points.length) return;
  try {
    const raw = await AsyncStorage.getItem(KEY_QUEUE);
    const prev = raw ? (JSON.parse(raw) as TripPoint[]) : [];
    const next = [...prev, ...points].slice(-MAX_POINTS);
    await AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(next));
  } catch { /* la cola es best-effort: al volver se sigue con el GPS en vivo */ }
}

/** Distancia aproximada en metros (equirectangular: sobra para umbrales de decenas de metros). */
function metersBetween(a: TripPoint, b: TripPoint): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * R;
}

// ---------- tarea de segundo plano ----------
// defineTask DEBE ejecutarse en el ámbito global del bundle (el runtime headless no
// monta vistas), por eso vive aquí y este módulo se importa desde el layout raíz.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(TRIP_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (!locations?.length) return;
    const pts: TripPoint[] = locations.map((l) => ({
      lon: l.coords.longitude,
      lat: l.coords.latitude,
      t: l.timestamp / 1000,
    }));
    await queuePoints(pts);
    const trip = await loadActiveTrip();
    if (!trip) { await stopBackgroundTrip(); return; }
    // FRENOS DE BATERÍA. Si la app fue cerrada, el temporizador de inactividad de la
    // interfaz ya no existe: estas dos guardas son las únicas que pueden apagar el
    // servicio, y por eso viven aquí dentro (se ejecutan aunque no haya UI).
    const now = Date.now();
    const prev = trip.points[trip.points.length - 1];
    const moved = pts.some((p) => !prev || metersBetween(prev, p) > MOVE_M);
    const lastMoveAt = moved ? now : (trip.lastMoveAt ?? trip.startedAt);
    if (now - trip.startedAt > MAX_TRIP_MS || now - lastMoveAt > MAX_IDLE_MS) {
      await stopBackgroundTrip();
      await clearActiveTrip();
      return;
    }
    // Marca de vida del viaje: permite distinguir «viaje en curso» de «abandonado».
    await saveActiveTrip({ ...trip, lastMoveAt, points: [...trip.points, ...pts] });
  });
}

// ---------- vigía de protección automática (app cerrada) ----------
// El «recorrido libre automático» no puede depender de tener la app abierta: si el
// usuario arranca la moto con el teléfono en el bolsillo, la protección debe
// activarse sola. Este vigía usa precisión BAJA y avisos cada ~150 m para no
// castigar la batería; cuando detecta desplazamiento sostenido, ASCIENDE al
// seguimiento fino del viaje y avisa al usuario.

/** Velocidad a partir de la cual se considera que el usuario va en camino (~15 km/h). */
const AUTOTRIP_SPEED_MS = 4;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(AUTOTRIP_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const loc = locations?.[locations.length - 1];
    if (!loc) return;
    // Si ya hay un viaje en curso, el vigía sobra.
    if (await loadActiveTrip()) { await stopAutoTripWatch(); return; }
    const now = { lon: loc.coords.longitude, lat: loc.coords.latitude, t: Date.now() };
    let prev: TripPoint | null = null;
    try {
      const raw = await AsyncStorage.getItem(KEY_WATCH);
      prev = raw ? (JSON.parse(raw) as TripPoint) : null;
    } catch { /* primera muestra */ }
    try { await AsyncStorage.setItem(KEY_WATCH, JSON.stringify(now)); } catch { /* best-effort */ }
    if (!prev) return;
    const dt = (now.t - prev.t) / 1000;
    if (dt <= 0) return;
    const speed = metersBetween(prev, now) / dt;
    if (speed < AUTOTRIP_SPEED_MS) return;
    // Vas en camino: se abre el viaje y se sube a seguimiento fino.
    await startTripFromBackground(now);
  });
}

/** Abre un viaje desde el vigía y asciende al seguimiento fino del recorrido. */
async function startTripFromBackground(point: TripPoint): Promise<void> {
  const notif = await loadNotificationCopy();
  await saveActiveTrip({
    startedAt: point.t,
    updatedAt: point.t,
    lastMoveAt: point.t,
    city: '',
    vehicle: null,
    priority: 1,
    alerts: 0,
    dest: null,
    points: [point],
    auto: true,
  });
  await stopAutoTripWatch();
  await startBackgroundTrip(notif);
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title: notif.autoTitle, body: notif.autoBody },
      trigger: null,
    });
  } catch { /* sin notificaciones, el usuario lo ve al abrir la app */ }
}

/**
 * Textos de la notificación persistente. Los guarda la app (que sí sabe el idioma
 * elegido) para que el vigía headless no dependa del contexto de React.
 */
const KEY_COPY = 'nomadaai.bg.copy';
export interface BgCopy { title: string; body: string; color?: string; autoTitle: string; autoBody: string }
const FALLBACK_COPY: BgCopy = {
  title: 'Nómada.AI', body: 'Cuidando tu recorrido.',
  autoTitle: 'Protección activada', autoBody: 'Detectamos que vas en camino.',
};
export async function saveNotificationCopy(copy: BgCopy): Promise<void> {
  try { await AsyncStorage.setItem(KEY_COPY, JSON.stringify(copy)); } catch { /* usa el de reserva */ }
}
async function loadNotificationCopy(): Promise<BgCopy> {
  try {
    const raw = await AsyncStorage.getItem(KEY_COPY);
    if (raw) return { ...FALLBACK_COPY, ...(JSON.parse(raw) as BgCopy) };
  } catch { /* reserva */ }
  return FALLBACK_COPY;
}

export async function startAutoTripWatch(notification: { title: string; body: string; color?: string }): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;
    if (await Location.hasStartedLocationUpdatesAsync(AUTOTRIP_TASK)) return true;
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_TASK)) return false; // ya hay viaje
    await Location.startLocationUpdatesAsync(AUTOTRIP_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 150,
      pausesUpdatesAutomatically: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: notification.title,
        notificationBody: notification.body,
        notificationColor: notification.color ?? '#2F81F7',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopAutoTripWatch(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(AUTOTRIP_TASK)) {
      await Location.stopLocationUpdatesAsync(AUTOTRIP_TASK);
    }
    await AsyncStorage.removeItem(KEY_WATCH);
  } catch { /* ya estaba detenido */ }
}

// ---------- control del seguimiento ----------

/**
 * Permiso de segundo plano. Se pide SOLO al iniciar un recorrido (permiso en
 * contexto) y su negativa no bloquea nada: el viaje sigue en primer plano.
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === 'granted') return true;
    if (!bg.canAskAgain) return false;
    const asked = await Location.requestBackgroundPermissionsAsync();
    return asked.status === 'granted';
  } catch {
    return false;
  }
}

export async function isBackgroundTripRunning(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRIP_TASK);
  } catch {
    return false;
  }
}

/**
 * Arranca el seguimiento en segundo plano. `notification` es el texto de la
 * notificación persistente de Android: debe decir la verdad de lo que hace.
 * Devuelve false si no hay permiso (el viaje continúa solo en primer plano).
 */
export async function startBackgroundTrip(notification: {
  title: string;
  body: string;
  color?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const granted = await requestBackgroundPermission();
  if (!granted) return false;
  try {
    if (await isBackgroundTripRunning()) return true;
    await Location.startLocationUpdatesAsync(TRIP_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 4000,
      distanceInterval: 20,
      // iOS: navegación vehicular y sin pausas automáticas (una pausa en mitad de
      // un viaje es justo cuando el usuario necesita el aviso).
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      // Android: servicio en primer plano = notificación persistente visible.
      foregroundService: {
        notificationTitle: notification.title,
        notificationBody: notification.body,
        notificationColor: notification.color ?? '#2F81F7',
        // false a propósito: cerrar la app deslizándola NO debe cancelar la
        // protección en mitad de un viaje. Las guardas de la tarea (tope de 4 h y
        // 30 min sin moverse) son las que lo apagan solo.
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Vuelve a enganchar el seguimiento de fondo al REANUDAR un viaje (la app fue
 * cerrada y con ella murió el servicio). A diferencia de `startBackgroundTrip`,
 * aquí NO se pide permiso: reabrir la app no es momento de sacar un diálogo.
 */
export async function resumeBackgroundTrip(notification: {
  title: string; body: string; color?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;
  } catch {
    return false;
  }
  return startBackgroundTrip(notification);
}

export async function stopBackgroundTrip(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await isBackgroundTripRunning()) await Location.stopLocationUpdatesAsync(TRIP_TASK);
  } catch { /* ya estaba detenido */ }
}
