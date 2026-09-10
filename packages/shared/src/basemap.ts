// BASE CARTOGRÁFICA — fuente única para el escritorio y la app (web y nativo).
//
// Por qué existe: hasta el 2026-09-10 las bases claras/oscuras eran CARTO Positron y
// Dark Matter. Ese día CARTO empezó a servir la tesela «API KEY REQUIRED» a toda
// petición sin clave, y el mapa quedó tapado en producción (escritorio y app).
// Se cambia a los lienzos gris claro / gris oscuro de Esri, que se sirven sin clave
// (igual que el satelital, que ya usábamos) y tienen el mismo carácter neutro para
// que el riesgo y las rutas sigan siendo lo que resalta.
//
// Cada lienzo de Esri viene en DOS capas: el fondo (calles sin rótulos) y la
// referencia (nombres de calles y lugares). Se piden por separado para que los
// rótulos queden ENCIMA de la capa de riesgo y sigan legibles.
export type BasemapKind = 'light' | 'dark' | 'satellite';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const BASEMAP_TILES: Record<BasemapKind, string[]> = {
  light: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
  dark: [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
  satellite: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
};

/** Rótulos (calles, barrios) del lienzo correspondiente; el satelital no los trae. */
export const BASEMAP_LABEL_TILES: Record<Exclude<BasemapKind, 'satellite'>, string[]> = {
  light: [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
  dark: [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
};

export const BASEMAP_ATTRIBUTION: Record<BasemapKind, string> = {
  light: '© Esri, HERE, Garmin · © OpenStreetMap contributors',
  dark: '© Esri, HERE, Garmin · © OpenStreetMap contributors',
  satellite: 'Imagery © Esri',
};

/** Los lienzos de Esri se sirven hasta este zoom; más allá MapLibre reescala la última tesela. */
export const BASEMAP_MAX_ZOOM = 18;

export function basemapKind(dark: boolean, satellite = false): BasemapKind {
  return satellite ? 'satellite' : dark ? 'dark' : 'light';
}

export function basemapTiles(dark: boolean, satellite = false): string[] {
  return BASEMAP_TILES[basemapKind(dark, satellite)];
}

/** Teselas de rótulos para la base activa; `null` en satelital (no tiene). */
export function basemapLabelTiles(dark: boolean, satellite = false): string[] | null {
  return satellite ? null : BASEMAP_LABEL_TILES[dark ? 'dark' : 'light'];
}
