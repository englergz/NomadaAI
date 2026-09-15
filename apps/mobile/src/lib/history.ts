// Histórico «Tu protección» — mismo backend /history que el panel de escritorio.
// Registra viajes del móvil (mode: 'mobile' → BI puede separar simulador vs. calle)
// y consulta agregados propios y de toda la comunidad.
//
// La identidad nunca va en la URL ni en el cuerpo: token si hay sesión y, si no, la
// llave del dispositivo (lib/uid), en cabeceras. Contrato común en @nomadaai/shared.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { claimLegacyHistoryOnce, type FlagStore, type HistorySummary, type TripLogIn } from '@nomadaai/shared';

import { api } from '@/lib/api';
import { historyAuth } from '@/lib/history-auth';
import { getDeviceKey, getUid } from '@/lib/uid';
import { enqueue } from '@/lib/write-queue';

export type { HistorySummary };

const flags: FlagStore = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
};

/**
 * Pasa a la llave, una sola vez, lo que este teléfono guardó con su uid anterior:
 * histórico, reportes y opiniones. true si ya no queda nada pendiente con ese uid.
 * `force` lo repite aunque ya se hubiera hecho (lo usa el borrado de datos).
 */
export async function claimLegacyHistory(opts: { force?: boolean } = {}): Promise<boolean> {
  return claimLegacyHistoryOnce(api, await getDeviceKey(), await getUid(), flags, opts);
}

export async function logTrip(rec: TripLogIn): Promise<void> {
  const body: TripLogIn = { mode: 'mobile', ...rec };
  try {
    const status = await api.logTrip(await historyAuth(), body);
    // 5xx: el servidor no está; se guarda y se reintenta al volver la señal.
    if (status >= 500) throw new Error(`history ${status}`);
  } catch {
    // Sin red: el viaje nunca depende de la DB, pero tampoco se pierde el registro.
    await enqueue({ kind: 'trip', body }).catch(() => {});
  }
}

export async function fetchSummaries(city = 'tumaco'): Promise<{ mine: HistorySummary | null; all: HistorySummary | null }> {
  // Antes de leer lo propio, que lo guardado con el uid anterior ya cuente como propio.
  await claimLegacyHistory();
  const auth = await historyAuth();
  const [mine, all] = await Promise.all([
    api.historySummary(auth, { city, scope: 'me' }).catch(() => null),
    api.historySummary(null, { city, scope: 'global' }).catch(() => null),
  ]);
  return { mine, all };
}

export async function resetHistory(): Promise<void> {
  try {
    await claimLegacyHistory();
    await api.deleteHistory(await historyAuth());
  } catch { /* ignore */ }
}
