// Config de mapa compartida (web y nativo) — mismas bases raster gratis que apps/web.
export const cartoTiles = (name: string) =>
  ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/${name}/{z}/{x}/{y}.png`);

// Tiles satelitales (ESRI World Imagery), como en el panel de escritorio.
export const SATELLITE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];

// Tiles de la base según tema/satélite (compartido web y nativo).
export function baseTiles(dark: boolean, satellite = false): string[] {
  return satellite ? SATELLITE_TILES : cartoTiles(dark ? 'dark_all' : 'light_all');
}

// Estilo MapLibre (JSON) con base clara/oscura/satelital — sin API key.
export function baseStyle(dark: boolean, satellite = false) {
  return {
    version: 8 as const,
    // `glyphs` es necesario si alguna capa symbol usa texto; sin él, MapLibre nativo
    // lanza «Unable to parse resourceUrl». Fuente pública de glifos de OpenMapTiles.
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      base: {
        type: 'raster' as const,
        tiles: baseTiles(dark, satellite),
        tileSize: 256,
        attribution: satellite ? 'Imagery © Esri' : '© OpenStreetMap · © CARTO',
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
// Rango recalibrado a pedido: 50% = aspecto suave por defecto, 100% = el antiguo
// tope medio (no satura), 0% = aún más tenue que antes.
export function riskFillColor(palette: HeatPaletteKey, intensity: number) {
  const base = [0.0, 0.35, 0.6, 0.85, 1.0];
  const scale = 2.0 - intensity; // 0→2.0 (muy suave) · 0.5→1.5 (default) · 1→1.0 (máximo)
  const stops = base.map((s, i) => Math.min(1, s * scale) + i * 1e-6); // estrictamente creciente
  const colors = HEAT_PALETTES[palette].colors;
  const expr: unknown[] = ['interpolate', ['linear'], ['get', 'risk_norm']];
  stops.forEach((s, i) => expr.push(s, colors[i]));
  return expr;
}

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

export type CityKey = 'tumaco' | 'cali';
export const CITIES: Record<CityKey, { label: string; center: [number, number]; zoom: number }> = {
  tumaco: { label: 'Tumaco', center: [-78.785, 1.806], zoom: 13 },
  cali: { label: 'Cali', center: [-76.532, 3.451], zoom: 12 },
};
export const DEFAULT_CITY: CityKey = 'tumaco';
