import type { StyleSpecification } from "maplibre-gl";
import { BASEMAP_ATTRIBUTION, BASEMAP_LABEL_TILES, BASEMAP_MAX_ZOOM, BASEMAP_TILES } from "@nomadaai/shared";

// Estilo MapLibre sin API key. Las teselas viven en @nomadaai/shared (misma fuente que
// la app): lienzos gris claro / gris oscuro de Esri + satelital Esri. CARTO dejó de
// servir sin clave el 2026-09-10 («API KEY REQUIRED» sobre todo el mapa).
// Las bases se alternan por visibilidad; los rótulos van en capas aparte para poder
// ponerlos ENCIMA del riesgo y las rutas.
const raster = (tiles: string[], attribution?: string) =>
  ({ type: "raster", tiles, tileSize: 256, maxzoom: BASEMAP_MAX_ZOOM, ...(attribution ? { attribution } : {}) }) as const;

export const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    light: raster(BASEMAP_TILES.light, BASEMAP_ATTRIBUTION.light),
    dark: raster(BASEMAP_TILES.dark, BASEMAP_ATTRIBUTION.dark),
    satellite: raster(BASEMAP_TILES.satellite, BASEMAP_ATTRIBUTION.satellite),
    "light-labels": raster(BASEMAP_LABEL_TILES.light),
    "dark-labels": raster(BASEMAP_LABEL_TILES.dark),
  },
  layers: [
    { id: "light", type: "raster", source: "light" },
    { id: "dark", type: "raster", source: "dark", layout: { visibility: "none" } },
    { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
  ],
};

// Capas de rótulos: se añaden al FINAL del estilo (tras riesgo y rutas) para que los
// nombres de calles queden legibles sobre la capa de riesgo.
export const labelLayers: StyleSpecification["layers"] = [
  { id: "light-labels", type: "raster", source: "light-labels" },
  { id: "dark-labels", type: "raster", source: "dark-labels", layout: { visibility: "none" } },
];

// Centro aproximado del Distrito de Tumaco, Nariño.
export const TUMACO_CENTER: [number, number] = [-78.785, 1.806];
export const TUMACO_ZOOM = 13;
