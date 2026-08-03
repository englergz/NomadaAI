// DIAGNÓSTICO HONESTO DE CONEXIÓN.
//
// Antes la app solo sabía «el chequeo de salud falló» y decía «revisa tu
// conexión», culpando al usuario incluso cuando el problema era NUESTRO. Aquí se
// distingue de verdad qué está pasando, porque cada caso pide un mensaje y una
// conducta distintos:
//
//   sin-red        → el teléfono no tiene internet. La app sigue navegando con lo
//                    que ya descargó; no tiene sentido reintentar en bucle.
//   servicio-caído → hay internet pero nuestro servidor no responde o devuelve
//                    5xx. La culpa es nuestra y hay que decirlo.
//   lento          → responde, pero tarde. Se avisa para que el usuario entienda
//                    por qué la ruta demora, sin alarmarlo.
//   ok             → todo bien.
import * as Network from 'expo-network';

export type NetState = 'ok' | 'lento' | 'sin-red' | 'servicio-caido';

/** Por encima de esto la respuesta se considera lenta (red móvil mala). */
const SLOW_MS = 2500;

export interface NetDiagnosis {
  state: NetState;
  /** Milisegundos que tardó el chequeo, si llegó a responder. */
  ms?: number;
  /** Código HTTP si el servidor respondió con error. */
  status?: number;
}

/** ¿El dispositivo tiene una red utilizable? (no dice si NUESTRO servicio va bien) */
export async function hasNetwork(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    // isInternetReachable puede ser null si el sistema aún no lo sabe: en ese caso
    // no se afirma que no hay red (sería un falso negativo muy visible).
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true; // ante la duda, se asume que hay red y que el fallo es nuestro
  }
}

/**
 * Clasifica el estado real comprobando NUESTRO servicio. `probe` debe hacer la
 * petición de salud y devolver el código HTTP (o lanzar si no hubo respuesta).
 */
export async function diagnose(probe: () => Promise<number>): Promise<NetDiagnosis> {
  const t0 = Date.now();
  try {
    const status = await probe();
    const ms = Date.now() - t0;
    if (status >= 500) return { state: 'servicio-caido', ms, status };
    if (ms > SLOW_MS) return { state: 'lento', ms, status };
    return { state: 'ok', ms, status };
  } catch {
    // No hubo respuesta: hay que saber si es el teléfono o nosotros.
    const online = await hasNetwork();
    return { state: online ? 'servicio-caido' : 'sin-red', ms: Date.now() - t0 };
  }
}

/** Clave de traducción del mensaje para cada estado (null = no molestar). */
export function messageKeyFor(state: NetState): string | null {
  switch (state) {
    case 'sin-red': return 'net.offline';
    case 'servicio-caido': return 'net.serverDown';
    case 'lento': return 'net.slow';
    default: return null;
  }
}
