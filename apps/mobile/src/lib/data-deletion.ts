// DERECHO DE SUPRESIÓN (Ley 1581 de 2012, art. 8).
//
// Borra TODO lo que la app guarda del usuario: en el teléfono y en el servidor.
// Es una acción irreversible, así que la interfaz exige doble confirmación; aquí
// solo vive la ejecución.
//
// Qué se borra en el dispositivo: histórico de viajes, registro de alertas,
// recorrido en curso y su cola, preferencias e identificador anónimo. Se conserva
// ÚNICAMENTE la constancia de aceptación legal, porque es prueba de un acto del
// usuario, no un dato personal que él haya aportado.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/lib/api';
import { authToken } from '@/lib/auth';

/** Prefijos de todo lo que la app escribe en el dispositivo. */
const OWNED_PREFIXES = ['nomadaai'];
/** Ajustes: NO se conservan tal cual; se reescriben dejando solo la constancia legal. */
const SETTINGS_KEY = 'nomadaai_settings_v1';

export interface DeletionResult {
  localOk: boolean;
  serverOk: boolean;
  serverError?: string;
}

export async function deleteAllMyData(uid: string, city: string): Promise<DeletionResult> {
  let serverOk = false;
  let serverError: string | undefined;

  // 1. Servidor primero: si falla, el usuario debe enterarse ANTES de perder lo
  //    local, para poder reintentar sabiendo que allá aún quedan datos.
  try {
    const r = await api.deleteMyData(uid, city, await authToken());
    serverOk = r?.ok !== false;
    if (!serverOk) serverError = r?.error;
  } catch (e) {
    serverError = String(e);
  }

  // 2. Dispositivo.
  let localOk = true;
  try {
    // La constancia de aceptación legal se rescata ANTES de borrar: es prueba de
    // un acto del usuario (cuándo y qué versión aceptó), no un dato personal que
    // él haya aportado, y borrarla obligaría a re-aceptar sin motivo.
    let legal: Record<string, unknown> = {};
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      legal = { legalAccepted: prev.legalAccepted ?? '', legalAcceptedAt: prev.legalAcceptedAt ?? '' };
    } catch { /* sin ajustes previos no hay nada que rescatar */ }

    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => OWNED_PREFIXES.some((p) => k.startsWith(p)));
    if (mine.length) await AsyncStorage.multiRemove(mine);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(legal));
  } catch {
    localOk = false;
  }

  return { localOk, serverOk, serverError };
}
