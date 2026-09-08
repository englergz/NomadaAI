// CIFRADO EN REPOSO del histórico local (Ley 1581/2012: seguridad del dato).
//
// Qué protege: lo que revela DÓNDE estuvo el usuario — el recorrido en curso y su
// cola de posiciones capturadas en segundo plano, la última posición del vigía y el
// registro de alertas (celda + hora). Hasta ahora vivían en AsyncStorage en texto
// plano: legibles desde una copia de seguridad o un dispositivo con root.
//
// Cómo: AES-256-GCM nativo de `expo-crypto`, con la clave custodiada por
// `expo-secure-store` (Keystore en Android, Keychain en iOS). El histórico NUNCA va a
// SecureStore: algunas plataformas rechazan valores de ~2 KB. Va la CLAVE (64 hex).
//
// Decisiones que importan:
// - AAD = nombre de la clave de almacenamiento. Un blob cifrado de `trip.queue` no puede
//   colarse como `trip.active` aunque se copie el valor: la autenticación falla.
// - Migración transparente: lo legado en claro se lee tal cual y se reescribe cifrado
//   en la siguiente escritura; no hay paso de migración que pueda quedar a medias.
// - SIN fallback a claro. Si cifrar falla, se pierde esa escritura; el viaje sigue en
//   memoria. Antes perder una posición que dejarla en texto plano.
// - iOS: la clave se guarda con AFTER_FIRST_UNLOCK. La tarea en segundo plano cifra con
//   el teléfono bloqueado; con el WHEN_UNLOCKED por defecto la clave sería ilegible
//   justo cuando hace falta.
// - Web: sin AES nativo; se guarda en claro. La app web no lleva recorrido ni alertas
//   locales, así que hoy no hay dato sensible que pase por aquí en esa plataforma.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Clave de SecureStore que custodia la clave AES (solo [A-Za-z0-9._-]). */
const AES_KEY_ID = 'nomadaai.aes.v1';
/** Prefijo del sobre cifrado; la versión permite rotar formato sin romper lo guardado. */
const PREFIX = 'enc1:';

const SECURE_OPTS: SecureStore.SecureStoreOptions =
  Platform.OS === 'ios' ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : {};

let keyCache: AESEncryptionKey | null = null;

/** Clave AES-256 del dispositivo: se crea una vez y vive en Keystore/Keychain. */
async function aesKey(): Promise<AESEncryptionKey> {
  if (keyCache) return keyCache;
  const hex = await SecureStore.getItemAsync(AES_KEY_ID, SECURE_OPTS);
  if (hex) {
    keyCache = (await AESEncryptionKey.import(hex, 'hex')) as AESEncryptionKey;
    return keyCache;
  }
  const fresh = (await AESEncryptionKey.generate()) as AESEncryptionKey;
  await SecureStore.setItemAsync(AES_KEY_ID, await fresh.encoded('hex'), SECURE_OPTS);
  keyCache = fresh;
  return fresh;
}

// UTF-8 sin depender de TextEncoder/TextDecoder (no garantizados en Hermes).
function utf8ToBytes(s: string): Uint8Array {
  const bin = unescape(encodeURIComponent(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToUtf8(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return decodeURIComponent(escape(bin));
}

async function encrypt(storageKey: string, plaintext: string): Promise<string> {
  const sealed = await aesEncryptAsync(utf8ToBytes(plaintext), await aesKey(), {
    additionalData: utf8ToBytes(storageKey),
  });
  return PREFIX + (await sealed.combined('base64'));
}

async function decrypt(storageKey: string, envelope: string): Promise<string> {
  const sealed = AESSealedData.fromCombined(envelope.slice(PREFIX.length));
  const bytes = await aesDecryptAsync(sealed, await aesKey(), {
    additionalData: utf8ToBytes(storageKey),
    output: 'bytes',
  });
  return bytesToUtf8(bytes as Uint8Array);
}

/** Lee un valor. Devuelve null si no existe o si el cifrado no valida (nunca datos corruptos). */
export async function secureGet(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return null;
  if (Platform.OS === 'web' || !raw.startsWith(PREFIX)) {
    // Legado en claro (escrito antes del cifrado): se devuelve y se cifra en la
    // siguiente escritura. No se reescribe aquí para no convertir una lectura en
    // una escritura dentro de la tarea en segundo plano.
    return raw;
  }
  try {
    return await decrypt(key, raw);
  } catch {
    return null;
  }
}

/** Escribe cifrado. Si cifrar falla, NO escribe en claro: se pierde esa escritura. */
export async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  const envelope = await encrypt(key, value);   // si lanza, no se escribe nada
  await AsyncStorage.setItem(key, envelope);
}

export async function secureRemove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/** Borra la clave AES: todo lo cifrado con ella queda irrecuperable. Parte del derecho de supresión. */
export async function wipeSecureMaterial(): Promise<void> {
  keyCache = null;
  try { await SecureStore.deleteItemAsync(AES_KEY_ID, SECURE_OPTS); } catch { /* ya no existía */ }
}

/** Solo para pruebas: olvida la clave en memoria sin borrarla del almacén seguro. */
export function _resetKeyCacheForTests(): void { keyCache = null; }
