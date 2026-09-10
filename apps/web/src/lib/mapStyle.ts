// La base cartográfica vive en @nomadaai/shared (misma fuente que la app móvil):
// estilos vectoriales de OpenFreeMap (Positron / Dark) y satelital de Esri, sin clave.
// CARTO dejó de servir sin clave el 2026-09-10 («API KEY REQUIRED» sobre todo el mapa)
// y los lienzos de Esri no tienen calles de Tumaco a zoom de ciudad; ver basemap.ts.
export { basemapStyle, keepOwnLayers } from "@nomadaai/shared";

// Centro aproximado del Distrito de Tumaco, Nariño.
export const TUMACO_CENTER: [number, number] = [-78.785, 1.806];
export const TUMACO_ZOOM = 13;
