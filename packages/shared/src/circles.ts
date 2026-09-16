// CÍRCULOS DE CUIDADO — tipos y reglas que comparten app móvil y escritorio.
//
// La ubicación viaja por EXCEPCIÓN: solo mientras hay un evento abierto (riesgo alto,
// inactividad, pánico o desvío), y al cerrarlo el servidor borra ese rastro. Lo que aquí se
// describe es el círculo, quién comparte y cuándo; nunca un historial de posiciones.

/** Motivos por los que alguien empieza a compartir. Los define el diseño, no el cliente. */
export type CircleEventKind = "riesgo" | "inactividad" | "panico" | "desvio";

/** Cómo comparte cada persona en cada círculo. El valor inicial nunca es «siempre». */
export type CircleShareMode = "never" | "on_trigger" | "always";

/** Disparadores de CADA persona en CADA círculo: solo ella los cambia. */
export interface CircleTriggers {
  riesgo: boolean;
  precaucion: boolean;
  inactividad: boolean;
  desvio: boolean;
}

export interface CircleSummary {
  id: number;
  code: string;
  name: string;
  kind: string;
  role: "owner" | "member";
  alias: string;
  members: number;
  open_events: number;
}

export interface CircleMember {
  alias: string;
  role: "owner" | "member";
  joined_at: string;
  /** Distingue a dos miembros sin publicar su cuenta; cambia de un círculo a otro. */
  pseudonym: string;
}

export interface CirclePrefs {
  triggers: Partial<CircleTriggers>;
  share_mode: CircleShareMode;
}

export interface CirclePosition {
  lon: number;
  lat: number;
  acc: number | null;
  t: string;
}

export interface CircleOpenEvent {
  id: number;
  pseudonym: string;
  kind: CircleEventKind;
  started_at: string;
  /** Última señal de quien comparte; null si todavía no mandó ninguna. */
  last: CirclePosition | null;
}

export interface CircleEventOpened {
  id: number;
  kind: CircleEventKind;
  started_at: string;
  /** Pedir ayuda dos veces no abre dos eventos: se reutiliza el que estaba abierto. */
  reused: boolean;
}

/** Disparadores de fábrica: solo el riesgo alto. Coincide con el servidor. */
export const DEFAULT_CIRCLE_TRIGGERS: CircleTriggers = {
  riesgo: true,
  precaucion: false,
  inactividad: false,
  desvio: false,
};

/** Alfabeto de los códigos: sin 0/O ni 1/I/L, para dictarlos sin confusiones. */
export const CIRCLE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CIRCLE_CODE_LENGTH = 8;

/**
 * Normaliza lo que escribe o pega la persona —mayúsculas, sin espacios ni guiones, así que
 * «abcd-efgh» y «ABCD EFGH» valen igual— y comprueba que solo use el alfabeto de los
 * códigos. Devuelve null si no puede ser un código, para avisar antes de preguntar al servidor.
 */
export function normalizeCircleCode(input: string): string | null {
  const limpio = (input ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (limpio.length !== CIRCLE_CODE_LENGTH) return null;
  for (const ch of limpio) {
    if (!CIRCLE_CODE_ALPHABET.includes(ch)) return null;
  }
  return limpio;
}

/** Cómo mostrar un código para dictarlo: en dos bloques de cuatro. */
export function formatCircleCode(code: string): string {
  return code.length === CIRCLE_CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
