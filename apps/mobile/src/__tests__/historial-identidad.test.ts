// Histórico «Tu protección»: nadie lee ni borra lo de otra persona. El servidor ya no
// acepta un user_id del cliente; la identidad viaja en cabeceras (token o llave del
// dispositivo) y NUNCA en la URL. Si esto se rompe, o un invitado pierde su histórico,
// o se reabre la puerta a leer y borrar lo ajeno.
//
// Las fábricas de jest.mock son autocontenidas (ver cifrado.test.ts): el estado vive
// dentro de cada fábrica y se alcanza con jest.requireMock. react-native y async-storage
// resuelven al mismo stub, así que esta fábrica también expone `Platform`.
jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    __esModule: true,
    __mem: mem,
    Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android ?? o.default },
    default: {
      getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: async (k: string, v: string) => { mem.set(k, v); },
      removeItem: async (k: string) => { mem.delete(k); },
      getAllKeys: async () => [...mem.keys()],
      multiRemove: async (ks: string[]) => { ks.forEach((k) => mem.delete(k)); },
    },
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  const state = { failGet: false, sets: 0 };
  return {
    __store: store,
    __state: state,
    AFTER_FIRST_UNLOCK: 'afu',
    getItemAsync: async (k: string) => { if (state.failGet) throw new Error('keystore'); return store.get(k) ?? null; },
    setItemAsync: async (k: string, v: string) => { state.sets += 1; store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); },
  };
});

// Aquí importa el formato y que no se repitan, no la calidad del azar (esa la da expo-crypto).
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)),
}));

jest.mock('@/lib/secure-storage', () => {
  const mem = new Map<string, string>();
  return {
    secureGet: async (k: string) => mem.get(k) ?? null,
    secureSet: async (k: string, v: string) => { mem.set(k, v); },
    secureRemove: async (k: string) => { mem.delete(k); },
    wipeSecureMaterial: async () => {},
  };
});

jest.mock('@/lib/api', () => ({
  baseUrl: 'http://test',
  api: {
    claimLegacyHistory: jest.fn(async () => ({ ok: true, moved: 0 })),
    deleteHistory: jest.fn(async () => ({ ok: true, deleted: 0 })),
    deleteMyData: jest.fn(async () => ({ ok: true, deleted: { history: 0, reports: 0 }, unlinked: { feedback: 0 } })),
    logTrip: jest.fn(async () => 200),
    historySummary: jest.fn(async () => null),
    reportIncident: jest.fn(async () => ({ accepted: true })),
  },
}));

// Sesión simulada: el puente real lee EXPO_PUBLIC_* y Jest no transforma el módulo
// virtual de Expo que eso genera (por eso las demás pruebas también lo sustituyen).
jest.mock('@/lib/auth', () => {
  const session = { token: null as string | null };
  return { __session: session, authToken: async () => session.token };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  claimLegacyHistoryOnce, historyHeaders, isDeviceKey, isLegacyDeviceId, LEGACY_CLAIM_FLAG,
  NomadaApi, newDeviceKey, type FlagStore, type TripLogIn,
} from '@nomadaai/shared';

import { deleteAllMyData } from '@/lib/data-deletion';
import { getDeviceKey, getUid, wipeDeviceKey, wipeUid } from '@/lib/uid';
import { clearWriteQueue, enqueue, flush, pendingCount } from '@/lib/write-queue';

type SecureMock = { __store: Map<string, string>; __state: { failGet: boolean; sets: number } };
const secure = () => jest.requireMock('expo-secure-store') as SecureMock;
const session = () => (jest.requireMock('@/lib/auth') as { __session: { token: string | null } }).__session;
const mockedApi = () => (jest.requireMock('@/lib/api') as { api: Record<string, jest.Mock> }).api;
const memStore = (): FlagStore & { mem: Map<string, string> } => {
  const mem = new Map<string, string>();
  return { mem, get: async (k) => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, v); } };
};

const UUID = '3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b';
const K = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8'; // base64url de los bytes 0..31

describe('llave del dispositivo (formato común)', () => {
  it('32 bytes de un generador criptográfico, en base64url de 43 caracteres', () => {
    const rnd = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
    const a = newDeviceKey(rnd);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isDeviceKey(a)).toBe(true);
    expect(newDeviceKey(rnd)).not.toBe(a);
  });

  it('codifica exacto (vectores comprobados contra base64url de Python)', () => {
    expect(newDeviceKey(() => Uint8Array.from({ length: 32 }, (_, i) => i))).toBe(K);
    const altos = Uint8Array.from([...Array.from({ length: 10 }, () => [0xfb, 0xff, 0xbf]).flat(), 0xfb, 0xff]);
    expect(newDeviceKey(() => altos)).toBe(`${'-_-_'.repeat(10)}-_8`);
  });

  it('sin generador válido falla: nunca inventa una llave débil', () => {
    expect(() => newDeviceKey(() => new Uint8Array(16))).toThrow();
  });

  it('el uid anterior no vale como llave; solo un uid de dispositivo se puede reclamar', () => {
    expect(isDeviceKey(UUID)).toBe(false);
    expect(isDeviceKey('anon')).toBe(false);
    expect(isLegacyDeviceId(UUID)).toBe(true);
    expect(isLegacyDeviceId('u_1725000000000_k3j4h5g6f7')).toBe(true);
    for (const ajeno of ['user_2abcDEF', 'anon', 'dev_0123456789abcdef', UUID.toUpperCase(), `${UUID}\n`]) {
      expect(isLegacyDeviceId(ajeno)).toBe(false);
    }
  });
});

describe('peticiones del histórico (cliente compartido)', () => {
  const api = new NomadaApi('http://test/');
  let calls: { url: string; init: RequestInit }[] = [];
  let spy: jest.SpyInstance;
  // Servidor simulado: /health anuncia el contrato nuevo y el resumen devuelve el alcance
  // pedido, salvo que la prueba imite a un backend anterior.
  let health: Record<string, unknown>;
  let answerScope: 'pedido' | 'global';
  const headersOf = (i: number) => (calls[i].init.headers ?? {}) as Record<string, string>;
  const sinHealth = () => calls.filter((c) => !c.url.endsWith('/health'));

  beforeEach(() => {
    calls = [];
    health = { status: 'ok', history_identity: true };
    answerScope = 'pedido';
    spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      const pedido = new URL(url).searchParams.get('scope');
      const body = url.endsWith('/health')
        ? health
        : { available: true, ok: true, scope: answerScope === 'global' ? 'global' : pedido };
      return { ok: true, status: 200, json: async () => body, text: async () => '' } as Response;
    });
  });
  afterEach(() => spy.mockRestore());

  it('lo propio lleva la llave en cabecera, y ni la llave ni un user_id en la URL', async () => {
    await api.historySummary({ deviceKey: K }, { city: 'tumaco', scope: 'me' });
    expect(calls[0].url).toBe('http://test/history/summary?scope=me&city=tumaco');
    expect(headersOf(0)).toEqual({ 'X-Device-Key': K });
  });

  it('con sesión viaja solo el token, nunca también la llave', () => {
    expect(historyHeaders({ token: 't0k', deviceKey: K })).toEqual({ Authorization: 'Bearer t0k' });
    expect(historyHeaders({ deviceKey: null })).toEqual({});
  });

  it('lo de todos no lleva identidad aunque haya credenciales', async () => {
    await api.historySummary({ token: 't0k' }, { scope: 'global' });
    expect(calls[0].url).toBe('http://test/history/summary?scope=global');
    expect(headersOf(0)).toEqual({});
  });

  it('sin credenciales ni siquiera pide lo propio', async () => {
    expect(await api.historySummary({ deviceKey: null }, { scope: 'me' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('un viaje encolado por una versión anterior no reenvía su user_id', async () => {
    expect(await api.logTrip({ deviceKey: K }, { user_id: 'victima', alerts: 2 } as TripLogIn)).toBe(200);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ alerts: 2 });
    expect(headersOf(0)).toEqual({ 'content-type': 'application/json', 'X-Device-Key': K });
  });

  it('borrar: todo lo propio, o solo una ciudad; nunca por user_id', async () => {
    await api.deleteHistory({ token: 't0k' });
    await api.deleteHistory({ deviceKey: K }, 'cali');
    const borrados = sinHealth();
    expect(borrados.map((c) => [c.init.method, c.url])).toEqual([
      ['DELETE', 'http://test/history'],
      ['DELETE', 'http://test/history?city=cali'],
    ]);
    expect(borrados.map((c) => c.init.headers)).toEqual([{ Authorization: 'Bearer t0k' }, { 'X-Device-Key': K }]);
  });

  it('si el servidor no anuncia que verifica la identidad, no se envía ningún DELETE', async () => {
    // Contra el backend anterior, DELETE /history sin user_id borraba la ciudad entera.
    health = { status: 'ok' };
    await expect(api.deleteHistory({ deviceKey: K })).rejects.toThrow();
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url])).toEqual([['GET', 'http://test/health']]);
  });

  it('borrar mis datos: un DELETE /me/data por identidad, con la identidad en cabecera', async () => {
    health = { status: 'ok', history_identity: true, data_deletion: true };
    await api.deleteMyData({ token: 't0k' });
    await api.deleteMyData({ deviceKey: K });
    expect(sinHealth().map((c) => [c.init.method, c.url, c.init.headers])).toEqual([
      ['DELETE', 'http://test/me/data', { Authorization: 'Bearer t0k' }],
      ['DELETE', 'http://test/me/data', { 'X-Device-Key': K }],
    ]);
  });

  it('si el servidor no anuncia el borrado completo, no se envía ningún DELETE', async () => {
    for (const h of [{ status: 'ok', history_identity: true }, { status: 'ok', data_deletion: true }]) {
      calls = [];
      health = h;
      await expect(api.deleteMyData({ deviceKey: K })).rejects.toThrow();
      expect(sinHealth()).toHaveLength(0);
    }
  });

  it('reportes y opiniones: identidad en cabecera y sin el uid anterior en el cuerpo', async () => {
    const reporte = { lon: -78.78, lat: 1.8, category: 'robo', device_id: UUID };
    const opinion = { useful: 4, on_time: 4, trust: 4, recommend: 4, device_id: UUID };
    await api.reportIncident(reporte, { deviceKey: K });
    await api.sendFeedback(opinion, { token: 't0k' });
    expect(calls.map((c) => [c.url, c.init.headers, JSON.parse(String(c.init.body))])).toEqual([
      ['http://test/incidents/report', { 'content-type': 'application/json', 'X-Device-Key': K }, { lon: -78.78, lat: 1.8, category: 'robo' }],
      ['http://test/feedback', { 'content-type': 'application/json', Authorization: 'Bearer t0k' }, { useful: 4, on_time: 4, trust: 4, recommend: 4 }],
    ]);
    expect(reporte.device_id).toBe(UUID); // no altera el cuerpo encolado
  });

  it('sin credenciales, un reporte encolado por una versión anterior conserva su uid', async () => {
    await api.reportIncident({ lon: 1, lat: 2, category: 'robo', device_id: UUID }, null);
    expect(JSON.parse(String(calls[0].init.body)).device_id).toBe(UUID);
    expect(headersOf(0)).toEqual({ 'content-type': 'application/json' });
  });

  it('una respuesta «de todos» a una petición propia no se muestra como propia', async () => {
    answerScope = 'global'; // backend anterior: ignora scope y, sin user_id, responde lo de todos
    expect(await api.historySummary({ deviceKey: K }, { scope: 'me' })).toBeNull();
    expect(await api.historySummary(null, { scope: 'global' })).toEqual({ available: true, ok: true, scope: 'global' });
  });
});

describe('reclamo del uid anterior (una sola vez)', () => {
  it('reclama, deja marca y no vuelve a pedir', async () => {
    const store = memStore();
    const claim = jest.fn(async () => ({ ok: true, moved: 2 }));
    expect(await claimLegacyHistoryOnce({ claimLegacyHistory: claim }, K, UUID, store)).toBe(true);
    expect(await claimLegacyHistoryOnce({ claimLegacyHistory: claim }, K, UUID, store)).toBe(true);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith(K, UUID);
    expect(store.mem.has(LEGACY_CLAIM_FLAG)).toBe(true);
  });

  it('sin red no deja marca: se reintenta la próxima vez', async () => {
    const store = memStore();
    const claim = jest.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce({ ok: true, moved: 1 });
    expect(await claimLegacyHistoryOnce({ claimLegacyHistory: claim }, K, UUID, store)).toBe(false);
    expect(store.mem.has(LEGACY_CLAIM_FLAG)).toBe(false);
    expect(await claimLegacyHistoryOnce({ claimLegacyHistory: claim }, K, UUID, store)).toBe(true);
  });

  it('si el servidor no confirma, tampoco hay marca', async () => {
    const store = memStore();
    expect(await claimLegacyHistoryOnce({ claimLegacyHistory: async () => ({ ok: false }) }, K, UUID, store)).toBe(false);
    expect(store.mem.size).toBe(0);
  });

  it('nunca pide reclamar ids de cuenta ni anon, y sin llave no reclama', async () => {
    const claim = jest.fn(async () => ({ ok: true }));
    for (const ajeno of ['user_2abcDEF', 'anon', null]) {
      expect(await claimLegacyHistoryOnce({ claimLegacyHistory: claim }, K, ajeno, memStore())).toBe(true);
    }
    expect(await claimLegacyHistoryOnce({ claimLegacyHistory: claim }, null, UUID, memStore())).toBe(false);
    expect(claim).not.toHaveBeenCalled();
  });
});

describe('llave en el teléfono', () => {
  beforeEach(async () => {
    secure().__state.failGet = false;
    await wipeDeviceKey();
    await wipeUid();
    secure().__state.sets = 0;
  });

  it('se crea una vez, vive en el almacén seguro y se reutiliza', async () => {
    const k = await getDeviceKey();
    expect(isDeviceKey(k)).toBe(true);
    expect(secure().__store.get('nomadaai.devkey.v1')).toBe(k);
    expect(await getDeviceKey()).toBe(k);
  });

  it('dos consultas a la vez en el primer uso dan la MISMA llave', async () => {
    const [a, b] = await Promise.all([getDeviceKey(), getDeviceKey()]);
    expect(a).toBe(b);
    expect(secure().__state.sets).toBe(1);
  });

  it('si el almacén seguro falla no hay llave, y nunca una débil', async () => {
    secure().__state.failGet = true;
    expect(await getDeviceKey()).toBeNull();
  });

  it('la llave no es el uid, y borrarla deja otra distinta', async () => {
    const k = await getDeviceKey();
    expect(k).not.toBe(await getUid());
    await wipeDeviceKey();
    expect(await getDeviceKey()).not.toBe(k);
  });
});

describe('borrado de datos (Ley 1581)', () => {
  const LEGACY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  beforeEach(async () => {
    secure().__state.failGet = false;
    await wipeDeviceKey();
    await wipeUid();
    secure().__store.set('nomadaai.uid.v1', LEGACY); // teléfono con histórico de antes de la llave
    const mem = (jest.requireMock('@react-native-async-storage/async-storage') as { __mem: Map<string, string> }).__mem;
    mem.clear();
    mem.set('nomadaai_settings_v1', JSON.stringify({ legalAccepted: '1.0.0', legalAcceptedAt: 'x', theme: 'dark' }));
    Object.values(mockedApi()).forEach((f) => f.mockClear());
    session().token = null;
  });

  it('con sesión borra la cuenta Y el dispositivo, tras reclamar lo del uid anterior', async () => {
    session().token = 'tok-ana';
    const api = mockedApi();
    const r = await deleteAllMyData();
    expect(r).toEqual({ localOk: true, serverOk: true, serverError: undefined });
    const key = api.claimLegacyHistory.mock.calls[0][0];
    expect(isDeviceKey(key)).toBe(true);
    expect(api.claimLegacyHistory).toHaveBeenCalledWith(key, LEGACY);
    expect(api.deleteMyData.mock.calls).toEqual([[{ token: 'tok-ana' }], [{ deviceKey: key }]]);
    expect(api.deleteHistory).not.toHaveBeenCalled(); // el borrado completo no se queda en el histórico
    // Uid, llave y marca de reclamo fuera; queda solo la constancia legal.
    expect(secure().__store.has('nomadaai.uid.v1')).toBe(false);
    expect(secure().__store.has('nomadaai.devkey.v1')).toBe(false);
    expect(await AsyncStorage.getAllKeys()).toEqual(['nomadaai_settings_v1']);
    expect(JSON.parse((await AsyncStorage.getItem('nomadaai_settings_v1'))!)).toEqual({ legalAccepted: '1.0.0', legalAcceptedAt: 'x' });
  });

  it('si el servidor no confirma, conserva uid y llave para poder terminar al reintentar', async () => {
    const api = mockedApi();
    api.deleteMyData.mockRejectedValueOnce(new Error('API 503'));
    const r = await deleteAllMyData();
    expect([r.serverOk, r.localOk]).toEqual([false, true]);
    const key = secure().__store.get('nomadaai.devkey.v1');
    expect(isDeviceKey(key)).toBe(true);
    expect(secure().__store.get('nomadaai.uid.v1')).toBe(LEGACY);
    expect(await AsyncStorage.getAllKeys()).toEqual(['nomadaai_settings_v1']); // lo demás, fuera

    const retry = await deleteAllMyData();
    expect(retry.serverOk).toBe(true);
    expect(api.deleteMyData).toHaveBeenLastCalledWith({ deviceKey: key });
    expect(secure().__store.has('nomadaai.devkey.v1')).toBe(false);
  });

  it('si no se pudo reclamar lo del uid anterior, el borrado no se da por completo', async () => {
    mockedApi().claimLegacyHistory.mockRejectedValueOnce(new Error('sin red'));
    const r = await deleteAllMyData();
    expect(r.serverOk).toBe(false);
    expect(mockedApi().deleteMyData).not.toHaveBeenCalled();
    expect(secure().__store.get('nomadaai.uid.v1')).toBe(LEGACY);
  });

  it('eliminar la cuenta: solo después de que el servidor confirme el borrado hecho con su token', async () => {
    session().token = 'tok-ana';
    const orden: string[] = [];
    const api = mockedApi();
    for (let i = 0; i < 2; i += 1) {
      api.deleteMyData.mockImplementationOnce(async (auth: { token?: string }) => {
        orden.push(auth.token ? 'datos de la cuenta' : 'datos del dispositivo');
        return { ok: true };
      });
    }
    const deleteAccount = jest.fn(async () => { orden.push('cuenta'); });
    const r = await deleteAllMyData({ deleteAccount });
    expect(r).toMatchObject({ serverOk: true, localOk: true, accountOk: true });
    expect(orden).toEqual(['datos de la cuenta', 'datos del dispositivo', 'cuenta']);
  });

  it('si el servidor no confirma, la cuenta NO se elimina', async () => {
    session().token = 'tok-ana';
    mockedApi().deleteMyData.mockRejectedValueOnce(new Error('API 503'));
    const deleteAccount = jest.fn(async () => {});
    const r = await deleteAllMyData({ deleteAccount });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(r).toMatchObject({ serverOk: false, accountOk: false });
  });

  it('sin token de la cuenta no se elimina: lo suyo en el servidor no se pudo borrar', async () => {
    const deleteAccount = jest.fn(async () => {});
    const r = await deleteAllMyData({ deleteAccount });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(r).toMatchObject({ serverOk: true, accountOk: false });
  });

  it('si Clerk rechaza la eliminación se informa, sin ocultar que los datos sí se borraron', async () => {
    session().token = 'tok-ana';
    const r = await deleteAllMyData({ deleteAccount: async () => { throw new Error('403'); } });
    expect(r).toMatchObject({ serverOk: true, localOk: true, accountOk: false });
  });

  it('reclama lo del uid anterior aunque ya constara reclamado: nada escrito después se queda atrás', async () => {
    await AsyncStorage.setItem(LEGACY_CLAIM_FLAG, 'antes');
    const r = await deleteAllMyData();
    expect(r.serverOk).toBe(true);
    expect(mockedApi().claimLegacyHistory).toHaveBeenCalledTimes(1);
  });
});

describe('cola: viajes encolados', () => {
  beforeEach(async () => {
    await clearWriteQueue();
    Object.values(mockedApi()).forEach((f) => f.mockClear());
    session().token = null;
    secure().__state.failGet = false;
  });

  it('se reenvían con la identidad del momento del envío; 5xx se conserva y 4xx se descarta', async () => {
    const api = mockedApi();
    await enqueue({ kind: 'trip', body: { alerts: 1 } });
    api.logTrip.mockResolvedValueOnce(503);
    expect(await flush()).toEqual({ sent: 0, remaining: 1 });
    expect(api.logTrip).toHaveBeenCalledWith({ deviceKey: await getDeviceKey() }, { alerts: 1 });

    session().token = 'tok-ana';
    api.logTrip.mockResolvedValueOnce(401);
    expect(await flush()).toEqual({ sent: 1, remaining: 0 });
    expect(api.logTrip).toHaveBeenLastCalledWith({ token: 'tok-ana' }, { alerts: 1 });
    expect(await pendingCount()).toBe(0);
  });
});
