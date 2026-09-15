// DERECHO DE SUPRESIÓN (Ley 1581 de 2012, art. 8).
//
// Borra TODO lo que la app guarda del usuario: en el teléfono y en el servidor.
// Es una acción irreversible, así que la interfaz exige doble confirmación; aquí
// solo vive la ejecución.
//
// Qué se hace en el servidor (DELETE /me/data), para la cuenta si hay sesión y para el
// dispositivo (su llave): se borran el histórico y los reportes ciudadanos, y las opiniones
// se desvinculan (se conservan sin nada que las ate a la persona, porque se piden justo
// antes de borrar). Antes se reclama lo guardado con el uid anterior a la llave, aunque ya
// se hubiera reclamado, para que el borrado también lo alcance.
//
// Cuenta: con sesión, y solo si el usuario lo marca, se elimina también la cuenta de Clerk
// (nombre, correo y perfil). Siempre DESPUÉS de que el servidor confirme el borrado hecho con
// el token de esa cuenta: eliminarla antes dejaría allá sus datos sin nadie que pueda borrarlos.
//
// Qué se borra en el dispositivo: histórico de viajes, registro de alertas,
// recorrido en curso y su cola, preferencias, identificador anónimo y llave. Se
// conserva ÚNICAMENTE la constancia de aceptación legal, porque es prueba de un acto
// del usuario, no un dato personal que él haya aportado.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/lib/api';
import { authToken } from '@/lib/auth';
import { claimLegacyHistory } from '@/lib/history';
import { wipeSecureMaterial } from '@/lib/secure-storage';
import { getDeviceKey, IDENTITY_STORAGE_KEYS, wipeDeviceKey, wipeUid } from '@/lib/uid';

/** Prefijos de todo lo que la app escribe en el dispositivo. */
const OWNED_PREFIXES = ['nomadaai'];
/** Ajustes: NO se conservan tal cual; se reescriben dejando solo la constancia legal. */
const SETTINGS_KEY = 'nomadaai_settings_v1';

export interface DeletionResult {
  localOk: boolean;
  serverOk: boolean;
  serverError?: string;
  /** Solo si se pidió eliminar la cuenta: si quedó eliminada. */
  accountOk?: boolean;
  accountError?: string;
}

export interface DeletionOptions {
  /** Elimina la cuenta de la sesión activa (lib/auth). Sin él, la cuenta no se toca. */
  deleteAccount?: () => Promise<void>;
}

export async function deleteAllMyData(opts: DeletionOptions = {}): Promise<DeletionResult> {
  let serverOk = false;
  let serverError: string | undefined;
  let accountTokenUsed = false;

  // 1. Servidor primero: si falla, el usuario debe enterarse ANTES de perder lo
  //    local, para poder reintentar sabiendo que allá aún quedan datos.
  try {
    if (!(await claimLegacyHistory({ force: true }))) throw new Error('no se pudo reclamar lo guardado con el identificador anterior');
    // Cuenta y dispositivo son identidades distintas en el servidor: se borran las dos.
    const token = await authToken();
    accountTokenUsed = Boolean(token);
    const deviceKey = await getDeviceKey();
    for (const auth of [token ? { token } : null, deviceKey ? { deviceKey } : null]) {
      if (!auth) continue;
      const r = await api.deleteMyData(auth);
      if (r?.ok !== true) throw new Error(r?.error ?? 'el servidor no confirmó el borrado');
    }
    serverOk = true;
  } catch (e) {
    serverError = String(e);
  }

  // 2. Cuenta, si se pidió: solo con el borrado del servidor confirmado CON el token de la cuenta.
  let accountOk: boolean | undefined;
  let accountError: string | undefined;
  if (opts.deleteAccount) {
    if (serverOk && accountTokenUsed) {
      try {
        await opts.deleteAccount();
        accountOk = true;
      } catch (e) {
        accountOk = false;
        accountError = String(e);
      }
    } else {
      accountOk = false;
      accountError = serverOk
        ? 'sin sesión activa: no se borraron los datos de la cuenta, así que no se elimina'
        : 'el servidor no confirmó el borrado, así que la cuenta no se elimina';
    }
  }

  // 3. Dispositivo.
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

    // Si el servidor no confirmó, el uid y la llave se CONSERVAN: sin ellos lo que quedó
    // allá no se podría borrar nunca, y el aviso pide reintentar. Lo demás se borra igual.
    const keep: readonly string[] = serverOk ? [] : IDENTITY_STORAGE_KEYS;
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => OWNED_PREFIXES.some((p) => k.startsWith(p)) && !keep.includes(k));
    if (mine.length) await AsyncStorage.multiRemove(mine);
    // La clave AES, el uid y la llave viven en Keystore/Keychain, fuera de AsyncStorage.
    await Promise.all([wipeSecureMaterial(), ...(serverOk ? [wipeUid(), wipeDeviceKey()] : [])]);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(legal));
  } catch {
    localOk = false;
  }

  return { localOk, serverOk, serverError, ...(opts.deleteAccount ? { accountOk, accountError } : {}) };
}
