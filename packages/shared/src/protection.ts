// FUENTE ÚNICA de la barra de protección. Los niveles los define el panel admin
// (GET /config/app) y valen para la app móvil Y el escritorio; esto es solo el
// contrato compartido: valores por defecto, etiquetas y el paso a λ del ruteo.

/** Niveles por defecto si el servidor aún no responde (mismo orden en ambas apps). */
export const DEFAULT_PROTECTION_LEVELS = [0, 25, 50, 75, 100];

/** Rampa azul→morado: más protección = azul más intenso (el rojo NO significa «más seguro»). */
export const PROTECTION_RAMP = ['#8fc0ff', '#5aa2ff', '#2f81f7', '#4a6df0', '#6d5cf5'];

/** λ (risk_weight) que entiende el backend de ruteo. */
export function lambdaForLevel(pct: number): number {
  return pct / 20;
}

/** Color del nivel `i` dentro de una escala de `total` niveles. */
export function protectionColor(i: number, total: number): string {
  if (total <= 1) return PROTECTION_RAMP[Math.floor(PROTECTION_RAMP.length / 2)];
  const idx = Math.round((i / (total - 1)) * (PROTECTION_RAMP.length - 1));
  return PROTECTION_RAMP[Math.min(PROTECTION_RAMP.length - 1, Math.max(0, idx))];
}

/**
 * Etiqueta del extremo/medio. Solo los extremos y el centro llevan palabra: los
 * nombres largos en cada tope no caben y fue justo lo que hubo que quitar.
 */
export function isEdgeOrMiddle(i: number, total: number): boolean {
  return i === 0 || i === total - 1 || i === Math.floor((total - 1) / 2);
}
