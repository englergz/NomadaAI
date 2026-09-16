// COLA DE AVISOS DEL MAPA.
//
// Hasta ahora mandaba el último: un aviso trivial («Recorrido iniciado») podía BORRAR de
// la pantalla una alerta de riesgo que el usuario aún no había leído. En una app cuyo
// trabajo es avisar a tiempo, eso no puede pasar.
//
// Reglas, de más a menos importante:
//   · Una alerta (coral) o una advertencia (warn) nunca las tapa algo de menor peso: lo
//     de menor peso ESPERA su turno.
//   · Si llega algo igual o más importante, se muestra ya; lo que estaba se guarda para
//     después solo si merecía leerse (advertencia o alerta), no si era un simple «ok».
//   · Nada repetido: el mismo texto no se encola dos veces ni se reemplaza a sí mismo.
//   · La cola tiene tope: si se llena, cae lo menos importante y más viejo. Un aviso que
//     llega tardísimo ya no sirve de nada.

export type BannerTone = 'ok' | 'warn' | 'info' | 'coral';
export interface Banner { text: string; tone: BannerTone }

/** Cuánto pesa cada tono cuando compiten por la pantalla. */
export const PESO: Record<BannerTone, number> = { info: 0, ok: 1, warn: 2, coral: 3 };
/** A partir de este peso, un aviso desplazado merece guardarse para después. */
const PESO_QUE_ESPERA = PESO.warn;
/** Tope de la cola: más allá, un aviso llegaría tarde y estorbaría. */
export const TOPE_COLA = 3;

export interface EstadoBanners { actual: Banner | null; cola: Banner[] }

export const VACIO: EstadoBanners = { actual: null, cola: [] };

function yaEsta(estado: EstadoBanners, aviso: Banner): boolean {
  return estado.actual?.text === aviso.text || estado.cola.some((b) => b.text === aviso.text);
}

/** Inserta por peso (el más importante primero) conservando el orden de llegada. */
function insertar(cola: Banner[], aviso: Banner): Banner[] {
  const i = cola.findIndex((b) => PESO[b.tone] < PESO[aviso.tone]);
  const siguiente = i === -1 ? [...cola, aviso] : [...cola.slice(0, i), aviso, ...cola.slice(i)];
  return siguiente.slice(0, TOPE_COLA);   // lo que sobra es lo menos importante y más viejo
}

/** Llega un aviso nuevo (o `null` para limpiar la pantalla y pasar al siguiente). */
export function empujar(estado: EstadoBanners, aviso: Banner | null): EstadoBanners {
  if (!aviso) return siguiente(estado);
  if (yaEsta(estado, aviso)) return estado;
  if (!estado.actual) return { actual: aviso, cola: estado.cola };
  if (PESO[aviso.tone] >= PESO[estado.actual.tone]) {
    const desplazado = estado.actual;
    const cola = PESO[desplazado.tone] >= PESO_QUE_ESPERA ? insertar(estado.cola, desplazado) : estado.cola;
    return { actual: aviso, cola };
  }
  return { actual: estado.actual, cola: insertar(estado.cola, aviso) };
}

/** Se acabó el tiempo del aviso en pantalla (o lo cerró el usuario): entra el siguiente. */
export function siguiente(estado: EstadoBanners): EstadoBanners {
  const [primero, ...resto] = estado.cola;
  return { actual: primero ?? null, cola: resto };
}
