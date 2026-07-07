// Config de mapa compartida (web y nativo) — mismas bases raster gratis que apps/web.
export const cartoTiles = (name: string) =>
  ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/${name}/{z}/{x}/{y}.png`);

// Estilo MapLibre (JSON) con base clara u oscura según el tema — sin API key.
export function baseStyle(dark: boolean) {
  return {
    version: 8 as const,
    sources: {
      base: {
        type: 'raster' as const,
        tiles: cartoTiles(dark ? 'dark_all' : 'light_all'),
        tileSize: 256,
        attribution: '© OpenStreetMap · © CARTO',
      },
    },
    layers: [{ id: 'base', type: 'raster' as const, source: 'base' }],
  };
}

// Capa de riesgo (mapa de calor): aquí SÍ se permite el rojo; la paleta
// azul→ámbar→coral queda reservada a rutas y alertas.
// Paletas personalizables (Ajustes): colores por parada de risk_norm.
export const HEAT_PALETTES = {
  calor: { // por defecto: verde → ámbar → naranja → rojo
    label: 'Calor',
    colors: ['rgba(34,197,94,0)', 'rgba(245,165,36,0.36)', 'rgba(249,115,22,0.56)', 'rgba(239,68,68,0.76)', 'rgba(220,38,38,1)'],
    line: 'rgba(239,68,68,0.25)',
  },
  semaforo: { // verde → amarillo → rojo
    label: 'Semáforo',
    colors: ['rgba(22,163,74,0)', 'rgba(132,204,22,0.36)', 'rgba(250,204,21,0.56)', 'rgba(249,115,22,0.76)', 'rgba(220,38,38,1)'],
    line: 'rgba(220,38,38,0.25)',
  },
  frio: { // azul → morado → rojo
    label: 'Frío',
    colors: ['rgba(59,130,246,0)', 'rgba(99,102,241,0.36)', 'rgba(168,85,247,0.56)', 'rgba(217,70,239,0.76)', 'rgba(225,29,72,1)'],
    line: 'rgba(168,85,247,0.25)',
  },
} as const;
export type HeatPaletteKey = keyof typeof HEAT_PALETTES;

// Expresión de color del heatmap. `intensity` desplaza las paradas: con intensidad
// alta los colores fuertes aparecen desde riesgos más bajos (y viceversa).
export function riskFillColor(palette: HeatPaletteKey, intensity: number) {
  const base = [0.0, 0.35, 0.6, 0.85, 1.0];
  const scale = 1.5 - intensity; // 0→1.5 (suave) · 0.5→1.0 (default) · 1→0.5 (fuerte)
  const stops = base.map((s, i) => Math.min(1, s * scale) + i * 1e-6); // estrictamente creciente
  const colors = HEAT_PALETTES[palette].colors;
  const expr: unknown[] = ['interpolate', ['linear'], ['get', 'risk_norm']];
  stops.forEach((s, i) => expr.push(s, colors[i]));
  return expr;
}

// Compatibilidad: valores por defecto (paleta calor, intensidad media).
export const RISK_FILL_COLOR = riskFillColor('calor', 0.5);
export const RISK_LINE_COLOR = HEAT_PALETTES.calor.line;

export type CityKey = 'tumaco' | 'cali';
export const CITIES: Record<CityKey, { label: string; center: [number, number]; zoom: number }> = {
  tumaco: { label: 'Tumaco', center: [-78.785, 1.806], zoom: 13 },
  cali: { label: 'Cali', center: [-76.532, 3.451], zoom: 12 },
};
export const DEFAULT_CITY: CityKey = 'tumaco';
