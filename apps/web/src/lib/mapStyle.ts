import type { StyleSpecification } from "maplibre-gl";

// Estilo MapLibre gratis, sin API key. Tres bases raster que se alternan por visibilidad:
//  - light : CARTO Positron (claro, limpio) — tema claro
//  - dark  : CARTO Dark Matter (oscuro)     — tema oscuro
//  - satellite : ESRI World Imagery
const carto = (name: string) =>
  ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/${name}/{z}/{x}/{y}.png`);

export const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    light: { type: "raster", tiles: carto("light_all"), tileSize: 256, attribution: "© OpenStreetMap · © CARTO" },
    dark: { type: "raster", tiles: carto("dark_all"), tileSize: 256, attribution: "© OpenStreetMap · © CARTO" },
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Imagery © Esri",
    },
  },
  layers: [
    { id: "light", type: "raster", source: "light" },
    { id: "dark", type: "raster", source: "dark", layout: { visibility: "none" } },
    { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
  ],
};

// Centro aproximado del Distrito de Tumaco, Nariño.
export const TUMACO_CENTER: [number, number] = [-78.785, 1.806];
export const TUMACO_ZOOM = 13;
