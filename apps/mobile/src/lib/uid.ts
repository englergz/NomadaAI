// Identidad anónima persistente del dispositivo (mismo esquema que el panel web):
// habilita el histórico «Tu protección» y BI sin registro. Se enlazará al login real
// sin cambiar el esquema (la API prioriza el token cuando existe).
//
// Vive en SecureStore (Keystore/Keychain), no en AsyncStorage: es la llave que ata
// todo el histórico del servidor a este teléfono, y en claro era legible desde una
// copia de seguridad. Lo guardado antes en AsyncStorage se migra la primera vez.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'nomadaai.uid.v1';          // SecureStore admite solo [A-Za-z0-9._-]
const LEGACY_KEY = 'nomadaai_uid';      // donde vivía antes, en claro
let cached: string | null = null;

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

/** Borra la identidad (derecho de supresión). La siguiente llamada crea una nueva. */
export async function wipeUid(): Promise<void> {
  cached = null;
  try { await SecureStore.deleteItemAsync(KEY, OPTS); } catch { /* ya no existía */ }
  try { await AsyncStorage.removeItem(LEGACY_KEY); } catch { /* ídem */ }
}
