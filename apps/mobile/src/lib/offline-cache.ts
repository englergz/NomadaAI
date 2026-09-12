// CACHÉ SIN CONEXIÓN de las LECTURAS públicas (capa de riesgo, lugares, ciudades,
// configuración). Red primero; si la red falla, se sirve lo último descargado y
// se dice claramente que es una copia guardada y de cuándo.
//
// Por qué así y no al revés (caché primero): el riesgo cambia con la hora y la
// promesa del producto es tiempo real; la copia es la red de seguridad, no el
// modo normal. Lo que cabe: Cali pesa ~1,6 MB y Tumaco ~0,2 MB; AsyncStorage en
// Android admite 6 MB, así que se guarda UNA capa por ciudad (la última) y se
// rechaza cualquier entrada mayor que MAX_BYTES para no reventar el almacén.
//
// Nada de aquí es dato personal (es lo que sirve el servidor a cualquiera), por
// eso va en AsyncStorage y no en el almacén cifrado.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'nomadaai.cache.v1:';
const MAX_BYTES = 3_000_000;

export interface CacheHit<T> {
  data: T;
  /** true si viene de la copia guardada (la red falló). */
  fromCache: boolean;
  /** Momento en que se descargó lo que se está devolviendo. */
  savedAt: number;
}

async function readEntry<T>(key: string): Promise<{ t: number; data: T } | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; data: T };
    return typeof parsed?.t === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeEntry<T>(key: string, data: T): Promise<void> {
  try {
    const raw = JSON.stringify({ t: Date.now(), data });
    if (raw.length > MAX_BYTES) return; // demasiado grande para el almacén: sin copia
    await AsyncStorage.setItem(PREFIX + key, raw);
  } catch { /* sin espacio o sin almacén: la app sigue sin copia */ }
}

/**
 * Red primero, copia si la red falla. Lanza solo si no hay red NI copia.
 * `key` identifica la entrada (p. ej. `risk:cali`); cada clave guarda una sola copia.
 */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<CacheHit<T>> {
  try {
    const data = await fetcher();
    void writeEntry(key, data);
    return { data, fromCache: false, savedAt: Date.now() };
  } catch (e) {
    const hit = await readEntry<T>(key);
    if (!hit) throw e;
    return { data: hit.data, fromCache: true, savedAt: hit.t };
  }
}

/** Solo lectura de la copia (sin tocar la red), para arranques sin señal. */
export async function readCached<T>(key: string): Promise<CacheHit<T> | null> {
  const hit = await readEntry<T>(key);
  return hit ? { data: hit.data, fromCache: true, savedAt: hit.t } : null;
}

/** Borra todas las copias (borrado de datos, o cambio de versión de formato). */
export async function clearOfflineCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch { /* nada que borrar */ }
}

/** «hace 2 h», «hace 3 d»… para decir de cuándo es la copia. Pura, para probarla. */
export function ageLabel(savedAt: number, now = Date.now(), lang: 'es' | 'en' = 'es'): string {
  const min = Math.max(0, Math.round((now - savedAt) / 60000));
  if (min < 60) return lang === 'es' ? `hace ${min} min` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return lang === 'es' ? `hace ${h} h` : `${h} h ago`;
  const d = Math.round(h / 24);
  return lang === 'es' ? `hace ${d} d` : `${d} d ago`;
}
