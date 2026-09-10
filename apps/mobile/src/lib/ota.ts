// ACTUALIZACIONES POR AIRE (OTA) — expo-updates.
// Permite corregir la parte JS (pantallas, textos, lógica, diseño) sin volver a
// publicar el APK. Lo que toca código NATIVO (permisos, módulos, splash) SÍ exige
// una build nueva: por eso runtimeVersion usa la política `fingerprint`, que
// invalida sola las actualizaciones cuando lo nativo cambia.
//
// REGLA DE SEGURIDAD DEL PRODUCTO: nunca se recarga la app en mitad de un
// recorrido. Una actualización que reinicia la interfaz mientras alguien navega
// por una zona de riesgo es exactamente lo que no puede pasar; se descarga, se
// AVISA (tarjeta en el mapa) y solo se aplica si el usuario lo pide sin recorrido
// en curso, o sola en el siguiente arranque en frío.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

export interface OtaResult {
  /** Hay una actualización descargada y lista para el próximo arranque. */
  pending: boolean;
  error?: string;
}

// Estado compartido: `_layout` busca la actualización al arrancar y el mapa la
// muestra. Un módulo con suscriptores evita pasar props por toda la app.
let pending = false;
const listeners = new Set<(p: boolean) => void>();

export function isUpdatePending(): boolean {
  return pending;
}

export function subscribeUpdatePending(cb: (p: boolean) => void): () => void {
  listeners.add(cb);
  cb(pending);
  return () => { listeners.delete(cb); };
}

function setPending(p: boolean): void {
  pending = p;
  listeners.forEach((f) => f(p));
}

/**
 * Busca y descarga una actualización. NO recarga la app: devuelve si quedó una
 * pendiente para que la interfaz pueda avisar («Novedades disponibles»).
 */
export async function checkForUpdate(): Promise<OtaResult> {
  // En desarrollo el módulo está deshabilitado a propósito (Metro manda).
  if (__DEV__ || !Updates.isEnabled) return { pending: false };
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { pending: false };
    await Updates.fetchUpdateAsync();
    setPending(true);
    return { pending: true };
  } catch (e) {
    return { pending: false, error: String(e) };
  }
}

/**
 * Aplica la actualización descargada reiniciando la app. Quien llame DEBE
 * comprobar antes que no hay un recorrido en curso.
 */
export async function applyUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch { /* si falla, se aplicará sola en el próximo arranque en frío */ }
}

/** Identificador de la versión en ejecución (útil para soporte y BI). */
export function currentUpdateId(): string | null {
  return Updates.updateId ?? null;
}

// ---- Novedades ----------------------------------------------------------------
//
// La hoja de «Novedades» se muestra UNA vez, en el primer arranque con una versión
// distinta de la última vista. En la instalación inicial no se muestra (no hay
// nada «nuevo» respecto a nada); se registra la versión y ya.

const SEEN_KEY = 'nomadaai.ota.seen.v1';

/** Pura, para poder probarla: ¿toca mostrar novedades? */
export function whatsNewDecision(seen: string | null, current: string): 'show' | 'silent' {
  return seen !== null && seen !== current ? 'show' : 'silent';
}

export async function shouldShowWhatsNew(): Promise<boolean> {
  // En desarrollo no hay updateId; se usa un marcador fijo para no molestar.
  const current = currentUpdateId() ?? 'embedded';
  try {
    const seen = await AsyncStorage.getItem(SEEN_KEY);
    if (seen !== current) await AsyncStorage.setItem(SEEN_KEY, current);
    return whatsNewDecision(seen, current) === 'show';
  } catch {
    return false;
  }
}
