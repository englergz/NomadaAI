// Histórico «Tu protección» — mismo backend /history que el panel de escritorio.
// Registra viajes del móvil (mode: 'mobile' → BI puede separar simulador vs. calle)
// y consulta agregados por usuario y de toda la comunidad.
import { baseUrl } from '@/lib/api';
import { getUid } from '@/lib/uid';

export interface HistorySummary {
  available: boolean;
  trips: number;
  users: number;
  alerts: number;
  prediccion: {
    n: number; model_acc50_pct: number; base_acc50_pct: number; mejora_pp: number;
    model_err_mean_m: number; base_err_mean_m: number;
  } | null;
  proteccion: { n: number; exposure_reduction_avg_pct: number } | null;
  since: string | null;
  updated: string | null;
}

export interface TripLog {
  vehicle?: string | null;
  hour?: number;
  alerts?: number;
  exposure_reduction_pct?: number | null;
  safe_exposure?: number | null;
  direct_exposure?: number | null;
  safe_dist_m?: number | null;
  direct_dist_m?: number | null;
  city?: string;
}

export async function logTrip(rec: TripLog): Promise<void> {
  try {
    const user_id = await getUid();
    await fetch(`${baseUrl}/history/trip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id, mode: 'mobile', ...rec }),
    });
  } catch { /* el viaje nunca depende de la DB */ }
}

export async function fetchSummaries(city = 'tumaco'): Promise<{ mine: HistorySummary | null; all: HistorySummary | null }> {
  const user_id = await getUid();
  const get = async (qs: string) => {
    try {
      const r = await fetch(`${baseUrl}/history/summary?city=${city}${qs}`);
      return r.ok ? ((await r.json()) as HistorySummary) : null;
    } catch { return null; }
  };
  const [mine, all] = await Promise.all([get(`&user_id=${encodeURIComponent(user_id)}`), get('')]);
  return { mine, all };
}

export async function resetHistory(): Promise<void> {
  try {
    const user_id = await getUid();
    await fetch(`${baseUrl}/history?user_id=${encodeURIComponent(user_id)}`, { method: 'DELETE' });
  } catch { /* ignore */ }
}
