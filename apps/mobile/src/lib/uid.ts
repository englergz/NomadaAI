// Identidad anónima del dispositivo, en dos piezas con papeles distintos:
//
// · uid: identificador anónimo que acompaña reportes y opiniones (rate-limit por persona
//   sin exigir cuenta). Antes ataba también el histórico del servidor, pero viajaba en la
//   URL y el servidor lo guarda tal cual, así que no prueba nada. Para el histórico solo
//   sirve una vez: reclamar lo que se guardó con él (lib/history).
// · llave del dispositivo: la PRUEBA de que un histórico es de este teléfono en modo
//   invitado. 32 bytes del generador criptográfico del sistema; solo viaja en la cabecera
//   X-Device-Key y el servidor guarda su hash. Con sesión manda el token.
//
// Las dos viven en SecureStore (Keystore/Keychain), no en AsyncStorage: en claro serían
// legibles desde una copia de seguridad. El uid guardado antes en AsyncStorage se migra la
// primera vez.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isDeviceKey, newDeviceKey } from '@nomadaai/shared';

const KEY = 'nomadaai.uid.v1';          // SecureStore admite solo [A-Za-z0-9._-]
const LEGACY_KEY = 'nomadaai_uid';      // donde vivía antes, en claro
const DEVICE_KEY = 'nomadaai.devkey.v1';
let cached: string | null = null;
let keyCached: string | null = null;
let keyPending: Promise<string | null> | null = null;

/** Claves de AsyncStorage con identidad (la versión web no tiene SecureStore y las guarda ahí). */
export const IDENTITY_STORAGE_KEYS: readonly string[] = [LEGACY_KEY, DEVICE_KEY];

const OPTS: SecureStore.SecureStoreOptions =
  Platform.OS === 'ios' ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : {};

function nuevo(): string {
  return globalThis.crypto?.randomUUID?.() ?? `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function getUid(): Promise<string> {
  if (cached) return cached;
  try {
    if (Platform.OS === 'web') {
      let u = await AsyncStorage.getItem(LEGACY_KEY);
      if (!u) { u = nuevo(); await AsyncStorage.setItem(LEGACY_KEY, u); }
      cached = u;
      return u;
    }
    let u = await SecureStore.getItemAsync(KEY, OPTS);
    if (!u) {
      // Migración: conservar el uid anterior para no perder el histórico del servidor.
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      u = legacy || nuevo();
      await SecureStore.setItemAsync(KEY, u, OPTS);
      if (legacy) await AsyncStorage.removeItem(LEGACY_KEY);
    }
    cached = u;
    return u;
  } catch {
    return 'anon';
  }
}

/** Borra el uid (derecho de supresión). La siguiente llamada crea uno nuevo. */
export async function wipeUid(): Promise<void> {
  cached = null;
  try { await SecureStore.deleteItemAsync(KEY, OPTS); } catch { /* ya no existía */ }
  try { await AsyncStorage.removeItem(LEGACY_KEY); } catch { /* ídem */ }
}

/**
 * Llave del dispositivo para el histórico, o null si no hay almacén seguro o generador
 * criptográfico. Sin llave el invitado no ve histórico propio: nunca se cae a un valor
 * débil o compartido.
 */
export function getDeviceKey(): Promise<string | null> {
  if (keyCached) return Promise.resolve(keyCached);
  // Dos llamadas simultáneas en el primer uso generarían dos llaves y la segunda pisaría a
  // la primera: lo registrado con la primera quedaría huérfano en el servidor.
  if (!keyPending) keyPending = loadDeviceKey().finally(() => { keyPending = null; });
  return keyPending;
}

async function loadDeviceKey(): Promise<string | null> {
  try {
    const web = Platform.OS === 'web';
    const saved = web ? await AsyncStorage.getItem(DEVICE_KEY) : await SecureStore.getItemAsync(DEVICE_KEY, OPTS);
    if (isDeviceKey(saved)) return (keyCached = saved);
    const fresh = newDeviceKey(getRandomBytes);
    // Solo se usa una llave que quedó guardada: si guardar falla, no hay llave.
    if (web) await AsyncStorage.setItem(DEVICE_KEY, fresh);
    else await SecureStore.setItemAsync(DEVICE_KEY, fresh, OPTS);
    return (keyCached = fresh);
  } catch {
    return null;
  }
}

/** Borra la llave (derecho de supresión): lo guardado con ella en el servidor queda inalcanzable. */
export async function wipeDeviceKey(): Promise<void> {
  keyCached = null;
  keyPending = null;
  try { await SecureStore.deleteItemAsync(DEVICE_KEY, OPTS); } catch { /* ya no existía */ }
  try { await AsyncStorage.removeItem(DEVICE_KEY); } catch { /* ídem */ }
}
