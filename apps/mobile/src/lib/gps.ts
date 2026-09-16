// GPS POR ESCALONES.
//
// Un único intento de alta precisión con 25 s de margen tiene dos caras malas: bajo
// techo agota los 25 s para acabar fallando, y en la calle hace esperar de más cuando
// una precisión menor habría bastado para centrar el mapa.
//
// Aquí se pide la posición en escalones: primero rápido y barato, y solo si no llega se
// insiste con más precisión y más margen, con una espera creciente entre intentos para
// no castigar la batería ni el chip de GPS. En cuanto uno responde, se corta.
//
// La pieza no sabe de `expo-location` a propósito: recibe cómo pedir la posición. Así se
// prueba sin dispositivo y sirve igual para el móvil y para la web.

export interface IntentoGps<A> {
  /** Precisión con la que se pide al sistema (la decide quien llama). */
  accuracy: A;
  /** Cuánto se espera esta vez antes de darla por fallida. */
  timeoutMs: number;
}

function dormir(ms: number): Promise<void> {
  return new Promise((listo) => setTimeout(listo, ms));
}

/** Corta la espera de una promesa. La original se ignora (nunca deja un fallo suelto). */
function conTiempoLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((cumplir, fallar) => {
    const reloj = setTimeout(() => fallar(new Error(`gps: sin respuesta en ${ms} ms`)), ms);
    promesa.then(
      (valor) => { clearTimeout(reloj); cumplir(valor); },
      (error) => { clearTimeout(reloj); fallar(error); },
    );
  });
}

/**
 * Pide la posición subiendo de escalón hasta que una responda.
 * Si fallan todas, lanza el último error: quien llama decide qué contar al usuario.
 */
export async function fixEscalonado<A, P>(
  pedir: (accuracy: A) => Promise<P>,
  intentos: readonly IntentoGps<A>[],
  opts: { esperaMs?: number; alFallar?: (indice: number, error: unknown) => void } = {},
): Promise<P> {
  if (!intentos.length) throw new Error('gps: sin intentos configurados');
  const espera = opts.esperaMs ?? 300;
  let ultimo: unknown = new Error('gps: sin respuesta');
  for (let i = 0; i < intentos.length; i++) {
    try {
      return await conTiempoLimite(pedir(intentos[i].accuracy), intentos[i].timeoutMs);
    } catch (error) {
      ultimo = error;
      opts.alFallar?.(i, error);
      // Espera creciente: 1×, 2×, 3×… Da aire al chip entre intentos sin alargar de más.
      if (i < intentos.length - 1 && espera > 0) await dormir(espera * (i + 1));
    }
  }
  throw ultimo;
}
