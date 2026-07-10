// Historial de alertas (B6): hora / zona / acción recomendada, persistente en el
// dispositivo. Mismo espíritu que las alertas: la zona es un identificador de celda,
// nunca un nombre de barrio. Se muestra en la hoja de perfil («Tu protección»).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AlertLevel } from '@/lib/alerts';

export interface AlertRecord {
  t: string;                                  // ISO timestamp
  zone: string;                               // cell_id de la malla (no un barrio)
  level: Exclude<AlertLevel, 'despejado'>;
  action: string;                             // conducta recomendada mostrada al usuario
  kind: 'proximidad' | 'anticipada';          // en la zona vs. predicha por el modelo
}

const KEY = 'nomadaai_alert_log_v1';
const MAX = 100; // acotado: histórico local, no telemetría

export async function logAlert(rec: Omit<AlertRecord, 't'>): Promise<void> {
  try {
    const list = await getAlerts();
    list.unshift({ t: new Date().toISOString(), ...rec });
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* el recorrido nunca depende del histórico */ }
}

export async function getAlerts(): Promise<AlertRecord[]> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? (JSON.parse(s) as AlertRecord[]) : [];
  } catch { return []; }
}

export async function clearAlerts(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}

// «Sin leer»: marca de última vista — el puntico del FAB de notificaciones.
const SEEN_KEY = 'nomadaai_alerts_seen_v1';

export async function markAlertsSeen(): Promise<void> {
  try { await AsyncStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* ignore */ }
}

export async function hasUnseenAlerts(): Promise<boolean> {
  try {
    const [list, seen] = await Promise.all([getAlerts(), AsyncStorage.getItem(SEEN_KEY)]);
    if (!list.length) return false;
    return !seen || list[0].t > seen;
  } catch { return false; }
}
