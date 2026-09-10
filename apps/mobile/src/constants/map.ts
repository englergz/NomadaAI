// Config de mapa compartida (web y nativo). Las teselas base viven en @nomadaai/shared
// (misma fuente que el escritorio): desde el 2026-09-10 son los lienzos de Esri, sin
// clave; CARTO pasó a exigir API key y servía «API KEY REQUIRED».
import {
  BASEMAP_ATTRIBUTION, BASEMAP_MAX_ZOOM, basemapKind, basemapLabelTiles, basemapTiles,
} from '@nomadaai/shared';

export { basemapTiles as baseTiles, basemapLabelTiles as baseLabelTiles };

// Estilo MapLibre (JSON) con base clara/oscura/satelital — sin API key.
export function baseStyle(dark: boolean, satellite = false) {
  const kind = basemapKind(dark, satellite);
  const labels = basemapLabelTiles(dark, satellite);
  return {
    version: 8 as const,
    // `glyphs` es necesario si alguna capa symbol usa texto; sin él, MapLibre nativo
    // lanza «Unable to parse resourceUrl». Fuente pública de glifos de OpenMapTiles.
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      base: {
        type: 'raster' as const,
        tiles: basemapTiles(dark, satellite),
        tileSize: 256,
        maxzoom: BASEMAP_MAX_ZOOM,
        attribution: BASEMAP_ATTRIBUTION[kind],
      },
      // Rótulos (calles, barrios) del lienzo de Esri: fuente aparte porque el
      // satelital no los trae. Van bajo el riesgo, igual que venían en CARTO.
      ...(labels ? { labels: { type: 'raster' as const, tiles: labels, tileSize: 256, maxzoom: BASEMAP_MAX_ZOOM } } : {}),
    },
    layers: [
      { id: 'base', type: 'raster' as const, source: 'base' },
      ...(labels ? [{ id: 'labels', type: 'raster' as const, source: 'labels' }] : []),
    ],
  };
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
export type CountryCode = 'CO' | 'EC' | 'PE';
export type CityKey =
  | 'tumaco' | 'cali' | 'pasto' | 'buenaventura' | 'bogota' | 'medellin' | 'barranquilla' | 'cartagena'
  | 'quito' | 'guayaquil' | 'esmeraldas'
  | 'lima';
export interface CityDef { label: string; country: CountryCode; center: [number, number]; zoom: number }
export const CITIES: Record<CityKey, CityDef> = {
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
// Ciudades que el servidor publica HOY (se usa solo si /risk/cities no responde):
// la cobertura de verdad la decide el backend en tiempo de ejecución.
export const SERVED_CITIES: readonly CityKey[] = ['tumaco', 'cali'];
