// Interfaz común del mapa (web y nativo comparten estas props).
import type { Coordinate, RiskZonesResponse } from '@nomadaai/shared';

export interface RouteLines {
  safe: Coordinate[];    // ruta segura
  direct: Coordinate[];  // ruta directa (gris, comparación)
  // Nivel de riesgo POR TRAMO de la ruta segura (length = safe.length - 1):
  // la línea se pinta azul → ámbar → coral según el tramo (paleta del proyecto).
  safeLevels?: ('despejado' | 'precaucion' | 'atencion')[];
}

// Colores de ruta por nivel (azul → ámbar → coral; rojo puro solo en el heatmap).
export const ROUTE_LEVEL_COLORS = {
  despejado: '#2f81f7',
  precaucion: '#f5a524',
  atencion: '#ff6b5e',
} as const;

// FeatureCollection de segmentos coloreables (compartido por web y nativo).
export function segmentsFeatureCollection(routes: RouteLines) {
  const levels = routes.safeLevels ?? [];
  return {
    type: 'FeatureCollection' as const,
    features: routes.safe.slice(0, -1).map((p, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [p, routes.safe[i + 1]] },
      properties: { level: levels[i] ?? 'despejado' },
    })),
  };
}

export interface RiskMapProps {
  dark: boolean;
  riskOn: boolean;
  riskData: RiskZonesResponse | null;
  userLocation: [number, number] | null; // [lon, lat]
  routes?: RouteLines | null;
  destination?: [number, number] | null; // marcador de destino
}
