// COLA DE ESCRITURAS SIN CONEXIÓN: reportes ciudadanos y registros de viaje que
// no pudieron enviarse se guardan y se reintentan cuando vuelve la señal.
//
// Reglas:
//   · Solo se encola lo que falló por RED (excepción al pedir). Un rechazo del
//     servidor (422, rate-limit) no se reintenta: ya hubo respuesta.
//   · Se envía en orden; al primer fallo de red se para y se espera a la próxima
//     oportunidad (arranque, app al frente, servicio de vuelta).
//   · Caduca a los 7 días: un reporte de hace una semana ya no describe la calle.
//   · La cola lleva coordenadas (el reporte) → va en el almacén CIFRADO, igual que
//     el rastro del viaje (lib/secure-storage).
import { api } from '@/lib/api';
import { authToken } from '@/lib/auth';
import { baseUrl } from '@/lib/api';
import { secureGet, secureRemove, secureSet } from '@/lib/secure-storage';
import type { IncidentReport } from '@nomadaai/shared';

const KEY = 'nomadaai.queue.v1';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MAX_JOBS = 50;

export type Job =
  | { id: string; kind: 'report'; t: number; body: IncidentReport }
  | { id: string; kind: 'trip'; t: number; body: Record<string, unknown> };

/** Cómo se envía cada tipo. Inyectable para las pruebas. */
export type Senders = { [K in Job['kind']]: (job: Extract<Job, { kind: K }>) => Promise<void> };

async function load(): Promise<Job[]> {
  try {
    const raw = await secureGet(KEY);
    const jobs = raw ? (JSON.parse(raw) as Job[]) : [];
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
}

async function save(jobs: Job[]): Promise<void> {
  if (!jobs.length) { await secureRemove(KEY); return; }
  await secureSet(KEY, JSON.stringify(jobs));
}

/** Descarta lo caducado y acota el tamaño (se conserva lo más reciente). Pura. */
export function prune(jobs: Job[], now = Date.now()): Job[] {
  return jobs.filter((j) => now - j.t <= MAX_AGE_MS).slice(-MAX_JOBS);
}

const listeners = new Set<(n: number) => void>();
function notify(n: number) { listeners.forEach((f) => f(n)); }

/** Suscripción al número de pendientes (para avisar en la interfaz). */
export function subscribePending(cb: (n: number) => void): () => void {
  listeners.add(cb);
  void load().then((j) => cb(prune(j).length));
  return () => { listeners.delete(cb); };
}

export async function enqueue(job: Omit<Job, 'id' | 't'>): Promise<void> {
  const jobs = prune(await load());
  const full = { ...job, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, t: Date.now() } as Job;
  jobs.push(full);
  await save(jobs);
  notify(jobs.length);
}

export async function pendingCount(): Promise<number> {
  return prune(await load()).length;
}

// Envíos reales. Un `throw` del sender = fallo de red → se conserva el trabajo.
// Una respuesta del servidor (aceptada o rechazada) = trabajo terminado.
const defaultSenders: Senders = {
  report: async (job) => {
    await api.reportIncident(job.body, await authToken());
  },
  trip: async (job) => {
    const t = await authToken();
    const r = await fetch(`${baseUrl}/history/trip`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(job.body),
    });
    // 5xx = el servidor no está; se reintenta luego. 4xx = rechazado, se descarta.
    if (r.status >= 500) throw new Error(`history ${r.status}`);
  },
};

let flushing = false;

/**
 * Intenta enviar todo lo pendiente, en orden. Devuelve cuántos salieron y cuántos
 * quedan. Reentrante-seguro: si ya hay un envío en curso, no lanza otro.
 */
export async function flush(senders: Senders = defaultSenders): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: await pendingCount() };
  flushing = true;
  try {
    const jobs = prune(await load());
    const left: Job[] = [];
    let sent = 0;
    let stopped = false;
    for (const job of jobs) {
      if (stopped) { left.push(job); continue; }
      try {
        if (job.kind === 'report') await senders.report(job);
        else await senders.trip(job);
        sent += 1;
      } catch {
        left.push(job);
        stopped = true; // sin red: no tiene sentido seguir intentando el resto ahora
      }
    }
    await save(left);
    notify(left.length);
    return { sent, remaining: left.length };
  } finally {
    flushing = false;
  }
}

/** Borra la cola (borrado de datos del usuario). */
export async function clearWriteQueue(): Promise<void> {
  await secureRemove(KEY);
  notify(0);
}
