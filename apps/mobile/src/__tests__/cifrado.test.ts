// Cifrado en reposo: se prueba la LÓGICA DEL ENVOLTORIO (sobre enc1:, AAD atada a la
// clave, migración de legado, wipe, sin fallback a claro). El AES real es nativo de
// Expo y se verifica en el dispositivo; aquí se simula preservando su contrato:
// roundtrip, clave distinta falla, AAD distinta falla.
//
// Las fábricas de jest.mock son AUTOCONTENIDAS: Jest prohíbe referenciar variables
// externas, y además Babel iza los `import` por encima de cualquier `const`, así que
// una fábrica que corra durante el import del módulo bajo prueba vería la variable sin
// inicializar. El estado vive dentro de cada fábrica y se expone por `exports`.
// En el mapper de este repo, react-native y async-storage resuelven al MISMO stub, y
// jest.mock registra por ruta resuelta: esta fabrica sirve a los dos, por eso expone
// tambien `Platform`.
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
    },
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    AFTER_FIRST_UNLOCK: 'afu',
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); },
  };
});

jest.mock('expo-crypto', () => {
  // AES simulado: XOR con (clave ⊕ nonce) + etiqueta que autentica ciphertext y AAD.
  // El envoltorio trata `combined` como opaco: basta hex puro.
  const hex = (u: Uint8Array) => Array.from(u, (x) => x.toString(16).padStart(2, '0')).join('');
  const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));
  const tagOf = (key: string, ct: Uint8Array, aad: Uint8Array) => {
    let h = 7; const all = [...Array.from(key, (c) => c.charCodeAt(0)), ...ct, ...aad];
    for (const x of all) h = (h * 31 + x) >>> 0;
    return h.toString(16).padStart(8, '0');
  };
  class AESEncryptionKey {
    hex: string;
    constructor(hex: string) { this.hex = hex; }
    static async generate() { return new AESEncryptionKey(Math.random().toString(16).slice(2).padEnd(64, 'a')); }
    static async import(h: string) { return new AESEncryptionKey(h); }
    async encoded() { return this.hex; }
  }
  class AESSealedData {
    combined64: string;
    constructor(combined64: string) { this.combined64 = combined64; }
    static fromCombined(c: string) { return new AESSealedData(c); }
    async combined() { return this.combined64; }
  }
  return {
    AESEncryptionKey, AESSealedData,
    aesEncryptAsync: async (pt: Uint8Array, key: AESEncryptionKey, o: { additionalData: Uint8Array }) => {
      const nonce = new Uint8Array(12).map(() => Math.floor(Math.random() * 256));
      const ct = pt.map((b, i) => b ^ nonce[i % 12] ^ key.hex.charCodeAt(i % key.hex.length));
      return new AESSealedData(`${hex(nonce)}.${hex(ct)}.${tagOf(key.hex, ct, o.additionalData)}`);
    },
    aesDecryptAsync: async (sd: AESSealedData, key: AESEncryptionKey, o: { additionalData: Uint8Array }) => {
      const [n64, c64, tag] = sd.combined64.split('.');
      const nonce = unhex(n64), ct = unhex(c64);
      if (tagOf(key.hex, ct, o.additionalData) !== tag) throw new Error('auth failed');
      return ct.map((b, i) => b ^ nonce[i % 12] ^ key.hex.charCodeAt(i % key.hex.length));
    },
  };
});

import { secureGet, secureSet, secureRemove, wipeSecureMaterial, _resetKeyCacheForTests } from '@/lib/secure-storage';

const mem: Map<string, string> = (jest.requireMock('@react-native-async-storage/async-storage') as { __mem: Map<string, string> }).__mem;
const secure: Map<string, string> = (jest.requireMock('expo-secure-store') as { __store: Map<string, string> }).__store;

beforeEach(() => { mem.clear(); secure.clear(); _resetKeyCacheForTests(); });

describe('cifrado en reposo', () => {
  test('lo guardado no queda en claro y vuelve intacto (incluye tildes)', async () => {
    const v = JSON.stringify({ points: [{ lon: -78.79, lat: 1.80, t: 1 }], nota: 'precaución · ñ' });
    await secureSet('nomadaai.trip.active', v);
    const raw = mem.get('nomadaai.trip.active')!;
    expect(raw.startsWith('enc1:')).toBe(true);
    expect(raw).not.toContain('-78.79');
    expect(await secureGet('nomadaai.trip.active')).toBe(v);
  });

  test('la clave AES vive en SecureStore, no en AsyncStorage', async () => {
    await secureSet('k', 'x');
    expect(secure.has('nomadaai.aes.v1')).toBe(true);
    expect([...mem.keys()]).not.toContain('nomadaai.aes.v1');
  });

  test('AAD: un blob copiado a otra clave no se acepta', async () => {
    await secureSet('nomadaai.trip.queue', '[{"lon":1,"lat":2,"t":3}]');
    mem.set('nomadaai.trip.active', mem.get('nomadaai.trip.queue')!);
    expect(await secureGet('nomadaai.trip.active')).toBeNull();
  });

  test('legado en claro se lee tal cual y queda cifrado tras reescribir', async () => {
    mem.set('nomadaai_alert_log_v1', '[{"zone":"1000042"}]');
    expect(await secureGet('nomadaai_alert_log_v1')).toBe('[{"zone":"1000042"}]');
    await secureSet('nomadaai_alert_log_v1', '[{"zone":"1000042"}]');
    expect(mem.get('nomadaai_alert_log_v1')!.startsWith('enc1:')).toBe(true);
  });

  test('wipe: sin clave, lo cifrado deja de ser legible y no se reescribe en claro', async () => {
    await secureSet('k', 'secreto');
    await wipeSecureMaterial();
    expect(secure.has('nomadaai.aes.v1')).toBe(false);
    expect(await secureGet('k')).toBeNull();          // nueva clave ≠ vieja → auth falla → null
    expect(mem.get('k')).not.toContain('secreto');
  });

  test('remove borra y get devuelve null', async () => {
    await secureSet('k', 'v'); await secureRemove('k');
    expect(await secureGet('k')).toBeNull();
  });
});
