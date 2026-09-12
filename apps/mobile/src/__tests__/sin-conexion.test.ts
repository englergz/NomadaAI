// Sin conexión: la capa de riesgo sale de la copia guardada y las escrituras
// (reportes, viajes) esperan en cola hasta que vuelve la señal. Si esto falla,
// el usuario pierde su reporte o se queda sin mapa justo cuando más lo necesita.

// Almacén en memoria para AsyncStorage (la copia pública).
jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => { mem.set(k, v); },
      removeItem: async (k: string) => { mem.delete(k); },
      getAllKeys: async () => [...mem.keys()],
      multiRemove: async (ks: string[]) => { ks.forEach((k) => mem.delete(k)); },
    },
    __mem: mem,
  };
});
// Almacén cifrado en memoria (la cola lleva coordenadas).
jest.mock('@/lib/secure-storage', () => {
  const mem = new Map<string, string>();
  return {
    secureGet: async (k: string) => mem.get(k) ?? null,
    secureSet: async (k: string, v: string) => { mem.set(k, v); },
    secureRemove: async (k: string) => { mem.delete(k); },
  };
});
jest.mock('@/lib/api', () => ({ api: {}, baseUrl: 'http://test' }));
jest.mock('@/lib/auth', () => ({ authToken: async () => null }));

import { ageLabel, cachedFetch, clearOfflineCache, readCached } from '@/lib/offline-cache';
import { clearWriteQueue, enqueue, flush, pendingCount, prune, type Job, type Senders } from '@/lib/write-queue';

describe('caché sin conexión (lecturas)', () => {
  beforeEach(() => clearOfflineCache());

  it('red primero: lo que llega se devuelve y queda guardado', async () => {
    const r = await cachedFetch('risk:tumaco', async () => ({ cells: 475 }));
    expect(r.fromCache).toBe(false);
    expect(r.data).toEqual({ cells: 475 });
    const saved = await readCached<{ cells: number }>('risk:tumaco');
    expect(saved?.data.cells).toBe(475);
  });

  it('sin red, sirve la copia y lo dice (fromCache) con su fecha', async () => {
    await cachedFetch('risk:cali', async () => ({ cells: 4268 }));
    const r = await cachedFetch('risk:cali', async () => { throw new Error('sin red'); });
    expect(r.fromCache).toBe(true);
    expect(r.data).toEqual({ cells: 4268 });
    expect(Date.now() - r.savedAt).toBeLessThan(5000);
  });

  it('sin red y sin copia, falla como antes (el mapa sigue, el usuario se entera)', async () => {
    await expect(cachedFetch('risk:pasto', async () => { throw new Error('sin red'); })).rejects.toThrow('sin red');
  });

  it('una copia por clave: la nueva descarga sustituye a la anterior', async () => {
    await cachedFetch('risk:tumaco', async () => ({ hour: 19 }));
    await cachedFetch('risk:tumaco', async () => ({ hour: 9 }));
    const r = await cachedFetch('risk:tumaco', async () => { throw new Error('sin red'); });
    expect(r.data).toEqual({ hour: 9 });
  });

  it('la edad de la copia se lee en humano', () => {
    const now = Date.now();
    expect(ageLabel(now - 5 * 60000, now)).toBe('hace 5 min');
    expect(ageLabel(now - 3 * 3600000, now)).toBe('hace 3 h');
    expect(ageLabel(now - 3 * 86400000, now, 'en')).toBe('3 d ago');
  });
});

describe('cola de escrituras (reportes y viajes)', () => {
  beforeEach(() => clearWriteQueue());

  const report = { lon: -78.78, lat: 1.8, category: 'atraco', city: 'tumaco', hour: 20, device_id: 'd1' };

  it('encola y cuenta pendientes', async () => {
    await enqueue({ kind: 'report', body: report });
    await enqueue({ kind: 'trip', body: { user_id: 'd1', mode: 'mobile', alerts: 2 } });
    expect(await pendingCount()).toBe(2);
  });

  it('con señal envía en orden y vacía la cola', async () => {
    await enqueue({ kind: 'report', body: report });
    await enqueue({ kind: 'trip', body: { user_id: 'd1', mode: 'mobile' } });
    const order: string[] = [];
    const senders: Senders = {
      report: async () => { order.push('report'); },
      trip: async () => { order.push('trip'); },
    };
    const r = await flush(senders);
    expect(r).toEqual({ sent: 2, remaining: 0 });
    expect(order).toEqual(['report', 'trip']);
    expect(await pendingCount()).toBe(0);
  });

  it('sin señal se para en el primer fallo y NO pierde nada', async () => {
    await enqueue({ kind: 'report', body: report });
    await enqueue({ kind: 'trip', body: { user_id: 'd1', mode: 'mobile' } });
    let calls = 0;
    const senders: Senders = {
      report: async () => { calls += 1; throw new Error('sin red'); },
      trip: async () => { calls += 1; },
    };
    const r = await flush(senders);
    expect(r).toEqual({ sent: 0, remaining: 2 });
    expect(calls).toBe(1); // no siguió intentando el segundo sin red
  });

  it('caduca a los 7 días y acota a 50 (se conserva lo más reciente)', () => {
    const now = Date.now();
    const mk = (i: number, ageMs: number): Job => ({ id: String(i), kind: 'trip', t: now - ageMs, body: {} });
    const jobs = [mk(0, 8 * 86400000), ...Array.from({ length: 60 }, (_, i) => mk(i + 1, i * 1000))];
    const kept = prune(jobs, now);
    expect(kept).toHaveLength(50);
    expect(kept.find((j) => j.id === '0')).toBeUndefined();
    expect(kept[kept.length - 1].id).toBe('60');
  });
});
