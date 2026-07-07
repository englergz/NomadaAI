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
export const RISK_FILL_COLOR = [
  'interpolate', ['linear'], ['get', 'risk_norm'],
  0.0, 'rgba(34,197,94,0.00)',
  0.35, 'rgba(245,165,36,0.18)',
  0.6, 'rgba(249,115,22,0.28)',
  0.85, 'rgba(239,68,68,0.38)',
  1.0, 'rgba(220,38,38,0.5)',
] as const;

export const RISK_LINE_COLOR = 'rgba(239,68,68,0.25)';

export type CityKey = 'tumaco' | 'cali';
export const CITIES: Record<CityKey, { label: string; center: [number, number]; zoom: number }> = {
  tumaco: { label: 'Tumaco', center: [-78.785, 1.806], zoom: 13 },
  cali: { label: 'Cali', center: [-76.532, 3.451], zoom: 12 },
};
export const DEFAULT_CITY: CityKey = 'tumaco';
