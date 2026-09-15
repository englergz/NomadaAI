// Identidad del histórico «Tu protección» — la misma lógica en web y móvil.
//
// El servidor no acepta un user_id del cliente para leer ni borrar histórico: bastaba
// conocer el id de otra persona para ver o borrar lo suyo. La identidad sale de una prueba:
//   · con sesión, el token de Clerk (Authorization: Bearer …);
//   · en modo invitado, una LLAVE DEL DISPOSITIVO: 32 bytes de un generador criptográfico,
//     guardados en el dispositivo y enviados solo en la cabecera X-Device-Key. El servidor
//     guarda su hash, nunca la llave.
// Lo que cambia por plataforma (dónde se guarda la llave, de dónde salen los bytes) vive en
// cada app; aquí, el formato, las cabeceras y el reclamo del uid anterior.
import type { NomadaApi } from "./client";

/** Cabecera de la llave. Nunca va en la URL: las URLs acaban en los logs de acceso. */
export const DEVICE_KEY_HEADER = "X-Device-Key";

/** Credenciales de quien consulta o borra SU histórico. */
export interface HistoryAuth {
  token?: string | null;
  deviceKey?: string | null;
}

const DEVICE_KEY_BYTES = 32;
const DEVICE_KEY_RE = /^[A-Za-z0-9_-]{43,128}$/;
// Formatos del uid anónimo que los clientes usaban antes de la llave:
// crypto.randomUUID() o el respaldo `u_<Date.now()>_<Math.random() en base 36>`.
const LEGACY_ID_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|u_[0-9]{10,16}_[a-z0-9]{1,16})$/;
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function isDeviceKey(v: unknown): v is string {
  return typeof v === "string" && DEVICE_KEY_RE.test(v);
}

/** Uid anónimo anterior a la llave. Nunca un id de cuenta (`user_…`), `dev_…` ni `anon`. */
export function isLegacyDeviceId(v: unknown): v is string {
  return typeof v === "string" && LEGACY_ID_RE.test(v);
}

/**
 * Llave nueva a partir de un generador CRIPTOGRÁFICO (`crypto.getRandomValues` en el
 * navegador, `expo-crypto` en el teléfono). No hay respaldo con Math.random: sin generador
 * no hay histórico propio, que es mejor que una llave adivinable.
 */
export function newDeviceKey(randomBytes: (n: number) => Uint8Array): string {
  const b = randomBytes(DEVICE_KEY_BYTES);
  if (!b || b.length !== DEVICE_KEY_BYTES) throw new Error("generador de bytes aleatorios no válido");
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64URL[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64URL[n & 63];
  }
  return out;
}

/** Cabeceras de identidad: el token si hay sesión; si no, la llave. Nunca las dos. */
export function historyHeaders(auth?: HistoryAuth | null): Record<string, string> {
  if (auth?.token) return { Authorization: `Bearer ${auth.token}` };
  if (auth?.deviceKey) return { [DEVICE_KEY_HEADER]: auth.deviceKey };
  return {};
}

/** Dónde guarda cada app la marca de «uid anterior ya reclamado». */
export interface FlagStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// v2: el reclamo pasó a mover también reportes y opiniones; los dispositivos que ya habían
// reclamado con v1 lo repiten una vez para que esos datos también queden en su llave.
export const LEGACY_CLAIM_FLAG = "nomadaai_hist_legacy_claimed_v2";

/**
 * Lo que el dispositivo guardó con su uid anterior (histórico, reportes y opiniones) pasa a su
 * llave, UNA vez. Con `force` se repite aunque ya se hiciera: el borrado de datos lo usa para no
 * dejar atrás nada escrito con ese uid después del primer reclamo.
 *
 * Devuelve true cuando no queda nada pendiente con ese uid (se reclamó ahora o antes, o no
 * es un uid de dispositivo) y false si no se pudo (sin red, sin llave, sin confirmación del
 * servidor). Quien necesite certeza —el borrado de datos— debe tratar false como incompleto.
 */
export async function claimLegacyHistoryOnce(
  api: Pick<NomadaApi, "claimLegacyHistory">,
  deviceKey: string | null | undefined,
  legacyId: string | null | undefined,
  store: FlagStore,
  opts: { force?: boolean } = {},
): Promise<boolean> {
  if (!opts.force && (await store.get(LEGACY_CLAIM_FLAG).catch(() => null))) return true;
  if (!isLegacyDeviceId(legacyId)) return true;
  if (!isDeviceKey(deviceKey)) return false;
  try {
    const r = await api.claimLegacyHistory(deviceKey, legacyId);
    if (r?.ok !== true) return false;
  } catch {
    return false;
  }
  await store.set(LEGACY_CLAIM_FLAG, new Date().toISOString()).catch(() => {});
  return true;
}
