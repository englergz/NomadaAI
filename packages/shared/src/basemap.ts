// BASE CARTOGRÁFICA — fuente única para el escritorio y la app (web y nativo).
//
// Historia, para no repetirla:
//   · Hasta el 2026-09-10 las bases claras/oscuras eran CARTO Positron / Dark Matter
//     (raster). Ese día CARTO empezó a exigir API key y sirvió la tesela
//     «API KEY REQUIRED» sobre todo el mapa, en producción, escritorio y app.
//   · Los lienzos raster de Esri se sirven sin clave pero NO tienen calles de Tumaco a
//     zoom de ciudad («Map data not yet available»); medido con teselas reales: a z16
//     Esri devuelve 2 KB (placeholder) donde OSM devuelve 5–9 KB.
//   · Se pasa a TESELAS VECTORIALES de OpenFreeMap (OpenMapTiles sobre OpenStreetMap):
//     sin clave, sin registro, con los estilos Positron y Dark (el mismo carácter neutro
//     que teníamos) y con cobertura completa de Tumaco y Cali. El satelital sigue siendo
//     Esri World Imagery (raster, sin clave).
//
// Con un estilo vectorial remoto, cambiar de tema es `setStyle`, que descarta las capas
// propias (riesgo, rutas, lugares). `keepOwnLayers` es el `transformStyle` que las
// conserva: todo lo nuestro va en fuentes GeoJSON, así que se distingue por el tipo.
export type BasemapKind = 'light' | 'dark' | 'satellite';

export const BASEMAP_STYLE_URL: Record<Exclude<BasemapKind, 'satellite'>, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/** Glifos para capas de texto propias (los estilos remotos ya traen los suyos). */
export const BASEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export const SATELLITE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];
export const SATELLITE_ATTRIBUTION = 'Imagery © Esri';

export function basemapKind(dark: boolean, satellite = false): BasemapKind {
  return satellite ? 'satellite' : dark ? 'dark' : 'light';
}

/** Estilo del satelital: raster de Esri, misma forma (JSON) en las tres plataformas. */
export function satelliteStyle() {
  return {
    version: 8 as const,
    glyphs: BASEMAP_GLYPHS,
    sources: {
      satellite: {
        type: 'raster' as const,
        tiles: SATELLITE_TILES,
        tileSize: 256,
        attribution: SATELLITE_ATTRIBUTION,
      },
    },
    layers: [{ id: 'satellite', type: 'raster' as const, source: 'satellite' }],
  };
}

/** URL del estilo vectorial (claro/oscuro) o el JSON del satelital. */
export function basemapStyle(dark: boolean, satellite = false): string | ReturnType<typeof satelliteStyle> {
  return satellite ? satelliteStyle() : BASEMAP_STYLE_URL[dark ? 'dark' : 'light'];
}

// Tipos mínimos del estilo (subconjunto de la especificación de MapLibre) para no
// depender de maplibre-gl en el paquete compartido.
interface StyleLike {
  sources?: Record<string, { type?: string } & Record<string, unknown>>;
  layers?: ({ id: string; source?: string } & Record<string, unknown>)[];
  [k: string]: unknown;
}

/**
 * `transformStyle` para `map.setStyle(next, { transformStyle: keepOwnLayers })`:
 * conserva las fuentes GeoJSON del estilo anterior (con sus datos) y las capas que
 * las usan, colocadas ENCIMA de la base nueva y en su orden original.
 */
export function keepOwnLayers(previous: StyleLike | undefined, next: StyleLike): StyleLike {
  if (!previous) return next;
  const own = Object.fromEntries(
    Object.entries(previous.sources ?? {}).filter(([, s]) => s?.type === 'geojson'),
  );
  const ownLayers = (previous.layers ?? []).filter((l) => l.source !== undefined && l.source in own);
  return {
    ...next,
    sources: { ...(next.sources ?? {}), ...own },
    layers: [...(next.layers ?? []), ...ownLayers],
  };
}
