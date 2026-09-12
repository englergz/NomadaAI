// Config de mapa compartida (web y nativo). La base cartográfica vive en
// @nomadaai/shared (misma fuente que el escritorio): estilos vectoriales de
// OpenFreeMap (Positron / Dark) y satelital de Esri, todo sin clave. Ver basemap.ts
// para la historia (CARTO exigió clave el 2026-09-10; Esri no cubre Tumaco).
import { basemapStyle, keepOwnLayers } from '@nomadaai/shared';

export { keepOwnLayers };

// Estilo MapLibre: URL vectorial (claro/oscuro) o JSON raster (satelital).
export function baseStyle(dark: boolean, satellite = false) {
  return basemapStyle(dark, satellite);
}

// Capa de riesgo (mapa de calor): aquí SÍ se permite el rojo; la paleta
// azul→ámbar→coral queda reservada a rutas y alertas.
// Paletas personalizables (Ajustes): colores por parada de risk_norm.
// Paletas y rampa de color: FUENTE ÚNICA en @nomadaai/shared (las comparte con el
// escritorio; antes había una copia en cada app y se corregía dos veces lo mismo).
import { HEAT_PALETTES, riskFillColor, type HeatPaletteKey } from '@nomadaai/shared';

export { HEAT_PALETTES, riskFillColor, paletteGradient, DEFAULT_RISK_PREFS } from '@nomadaai/shared';
export type { HeatPaletteKey, RiskPrefs } from '@nomadaai/shared';

// Compatibilidad: valores por defecto (paleta calor, intensidad media).
export const RISK_FILL_COLOR = riskFillColor('calor', 0.5);
export const RISK_LINE_COLOR = HEAT_PALETTES.calor.line;

// --- HEATMAP SUAVE (estilo Rappi/Uber): superficie difuminada en vez de grillas. ---
// La capa `heatmap` de MapLibre necesita PUNTOS pesados; convertimos cada celda de
// riesgo (polígono) en su centroide con peso = risk_norm.
interface PolyFeature { geometry?: { type?: string; coordinates?: unknown }; properties?: { risk_norm?: number } }
export function riskPointsFC(fc: { features?: PolyFeature[] } | null) {
  const out: unknown[] = [];
  for (const f of fc?.features ?? []) {
    const w = Number(f.properties?.risk_norm ?? 0);
    if (!w) continue;
    let ring: number[][] | undefined;
    const g = f.geometry;
    if (g?.type === 'Polygon') ring = (g.coordinates as number[][][])?.[0];
    else if (g?.type === 'MultiPolygon') ring = (g.coordinates as number[][][][])?.[0]?.[0];
    if (!ring || ring.length < 3) continue;
    let x = 0, y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x / ring.length, y / ring.length] },
      properties: { w },
    });
  }
  return { type: 'FeatureCollection', features: out };
}

// Pintura de la capa heatmap. La paleta define el degradado; intensidad y opacidad
// vienen de Ajustes. El radio crece con el zoom para que se vea fino de lejos y de cerca.
export function heatmapPaint(palette: HeatPaletteKey, intensity: number, opacity: number) {
  const cols = HEAT_PALETTES[palette].colors; // [transparente, …, fuerte]
  // heatmap-color va de densidad 0 (transparente) a 1 (color fuerte).
  const color = [
    'interpolate', ['linear'], ['heatmap-density'],
    0, 'rgba(0,0,0,0)',
    0.2, cols[1], 0.4, cols[2], 0.6, cols[3], 0.85, cols[4],
  ];
  return {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1],
    'heatmap-intensity': 0.6 + intensity * 1.1,          // Ajustes → intensidad
    'heatmap-color': color,
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 14, 13, 26, 16, 48],
    'heatmap-opacity': opacity,
  };
}

// CATÁLOGO DE CIUDADES por país. Estar aquí NO significa tener cobertura: el estado
// real (disponible / próximamente / no disponible) lo dicen /risk/cities y
// /route/cities del servidor (ver lib/city-status.ts). El catálogo existe para que
// el usuario encuentre su ciudad con su nombre oficial y sepa qué hay en ella.
export type CountryCode = string;   // ISO-2; el catálogo del servidor puede traer países nuevos
export type CityKey = string;       // clave del catálogo; el servidor puede añadir ciudades sin publicar app
export interface CityDef { label: string; country: CountryCode; center: [number, number]; zoom: number }

/** Ciudades integradas en la app: lo que se ve sin red y el respaldo si el catálogo falla. */
export const BUILTIN_CITIES: Record<CityKey, CityDef> = {
  tumaco: { label: 'Tumaco', country: 'CO', center: [-78.785, 1.806], zoom: 13 },
  cali: { label: 'Cali', country: 'CO', center: [-76.532, 3.451], zoom: 12 },
  pasto: { label: 'Pasto', country: 'CO', center: [-77.281, 1.214], zoom: 13 },
  buenaventura: { label: 'Buenaventura', country: 'CO', center: [-77.032, 3.883], zoom: 13 },
  bogota: { label: 'Bogotá', country: 'CO', center: [-74.081, 4.652], zoom: 11 },
  medellin: { label: 'Medellín', country: 'CO', center: [-75.574, 6.245], zoom: 12 },
  barranquilla: { label: 'Barranquilla', country: 'CO', center: [-74.797, 10.981], zoom: 12 },
  cartagena: { label: 'Cartagena', country: 'CO', center: [-75.514, 10.400], zoom: 12 },
  quito: { label: 'Quito', country: 'EC', center: [-78.483, -0.188], zoom: 12 },
  guayaquil: { label: 'Guayaquil', country: 'EC', center: [-79.896, -2.190], zoom: 12 },
  esmeraldas: { label: 'Esmeraldas', country: 'EC', center: [-79.652, 0.968], zoom: 13 },
  lima: { label: 'Lima', country: 'PE', center: [-77.043, -12.046], zoom: 11 },
};
export const DEFAULT_CITY: CityKey = 'tumaco';

// CATÁLOGO VIVO. Arranca con las integradas y el servidor puede AMPLIARLO en
// caliente (GET /cities/catalog, que edita el panel admin): dar de alta una
// ciudad dejó de exigir publicar versión de la app. Estar en el catálogo no da
// cobertura — eso lo siguen diciendo /risk/cities y /route/cities.
const registry: Record<CityKey, CityDef> = { ...BUILTIN_CITIES };
const listeners = new Set<() => void>();

export const CITIES: Record<CityKey, CityDef> = registry;

/** Def de una ciudad, con la ciudad por defecto como red de seguridad. */
export function cityDef(key: CityKey): CityDef {
  return registry[key] ?? registry[DEFAULT_CITY];
}

/** Mezcla el catálogo del servidor sobre lo integrado. Devuelve true si algo cambió. */
export function registerCities(list: { key: string; label: string; country: string; center: [number, number]; zoom: number }[]): boolean {
  let changed = false;
  for (const c of list) {
    if (!c?.key || !Array.isArray(c.center)) continue;
    const prev = registry[c.key];
    if (prev && prev.label === c.label && prev.country === c.country
      && prev.center[0] === c.center[0] && prev.center[1] === c.center[1] && prev.zoom === c.zoom) continue;
    registry[c.key] = { label: c.label, country: c.country, center: c.center, zoom: c.zoom };
    changed = true;
  }
  if (changed) listeners.forEach((f) => f());
  return changed;
}

export function subscribeCities(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
// Ciudades que el servidor publica HOY (se usa solo si /risk/cities no responde):
// la cobertura de verdad la decide el backend en tiempo de ejecución.
export const SERVED_CITIES: readonly CityKey[] = ['tumaco', 'cali'];
