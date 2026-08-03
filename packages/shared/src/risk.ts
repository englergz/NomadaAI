// FUENTE ÚNICA de la capa de riesgo: paletas, rampa de color y valores por
// defecto. La app móvil y el escritorio IMPORTAN de aquí — antes cada una tenía
// su copia y se arreglaba dos veces lo mismo (o peor, solo en una).
//
// Si cambias un color, cambia en las dos plataformas a la vez. Esa es la idea.

export const HEAT_PALETTES = {
  calor: {
    // por defecto: verde → ámbar → naranja → rojo
    label: 'Calor',
    colors: ['rgba(34,197,94,0)', 'rgba(245,165,36,0.36)', 'rgba(249,115,22,0.56)', 'rgba(239,68,68,0.76)', 'rgba(220,38,38,1)'],
    line: 'rgba(239,68,68,0.25)',
  },
  semaforo: {
    // verde → amarillo → rojo
    label: 'Semáforo',
    colors: ['rgba(22,163,74,0)', 'rgba(132,204,22,0.36)', 'rgba(250,204,21,0.56)', 'rgba(249,115,22,0.76)', 'rgba(220,38,38,1)'],
    line: 'rgba(220,38,38,0.25)',
  },
  frio: {
    // azul → morado → rojo
    label: 'Frío',
    colors: ['rgba(59,130,246,0)', 'rgba(99,102,241,0.36)', 'rgba(168,85,247,0.56)', 'rgba(217,70,239,0.76)', 'rgba(225,29,72,1)'],
    line: 'rgba(168,85,247,0.25)',
  },
} as const;

export type HeatPaletteKey = keyof typeof HEAT_PALETTES;

export interface RiskPrefs {
  palette: HeatPaletteKey;
  intensity: number; // 0..1
  opacity: number;   // 0..1
}

/** Defaults acordados en campo: semáforo, intensidad 50 %, opacidad 25 %. */
export const DEFAULT_RISK_PREFS: RiskPrefs = { palette: 'semaforo', intensity: 0.5, opacity: 0.25 };

/**
 * Expresión de color del relleno para MapLibre (web y nativo hablan el mismo
 * lenguaje de estilos). `intensity` desplaza las paradas: con intensidad alta los
 * colores fuertes aparecen desde riesgos más bajos.
 * 0 → 2.0 (muy tenue) · 0.5 → 1.5 (defecto) · 1 → 1.0 (máximo)
 */
export function riskFillColor(palette: HeatPaletteKey, intensity: number): unknown[] {
  const base = [0.0, 0.35, 0.6, 0.85, 1.0];
  const scale = 2.0 - intensity;
  const stops = base.map((s, i) => Math.min(1, s * scale) + i * 1e-6); // estrictamente creciente
  const colors = HEAT_PALETTES[palette].colors;
  const expr: unknown[] = ['interpolate', ['linear'], ['get', 'risk_norm']];
  stops.forEach((s, i) => expr.push(s, colors[i]));
  return expr;
}

/** Vista previa de la paleta como degradado CSS (selector de Ajustes). */
export function paletteGradient(k: HeatPaletteKey): string {
  const stops = HEAT_PALETTES[k].colors
    .map((c) => c.replace(/[\d.]+\)$/, '1)'))
    .map((c, i, a) => `${c} ${Math.round((i / (a.length - 1)) * 100)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
