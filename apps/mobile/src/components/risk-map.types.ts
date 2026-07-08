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

export interface RiskStyle {
  palette: 'calor' | 'semaforo' | 'frio';
  intensity: number; // 0–1
  opacity: number;   // 0–1 (transparencia global de la capa)
}

export interface RiskMapProps {
  dark: boolean;
  riskOn: boolean;
  riskData: RiskZonesResponse | null;
  userLocation: [number, number] | null; // [lon, lat]
  routes?: RouteLines | null;
  destination?: [number, number] | null; // marcador de destino
  riskStyle?: RiskStyle;
  satellite?: boolean;                       // base satelital (Ajustes → Mapa)
  poisData?: RiskZonesResponse | null;       // capa Lugares (FeatureCollection de puntos)
  poisOn?: boolean;
}

// Colores de POIs por categoría (mismos del panel de escritorio).
export const POI_CIRCLE_COLOR = [
  'match', ['get', 'category'],
  'seguridad', '#2563eb', 'salud', '#ef4444', 'educación', '#a855f7',
  'combustible', '#f97316', 'banco', '#16a34a', 'transporte', '#0ea5e9',
  'comercio', '#b45309', 'culto', '#64748b', '#94a3b8',
] as const;
