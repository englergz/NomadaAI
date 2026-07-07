// Interfaz común del mapa (web y nativo comparten estas props).
import type { Coordinate, RiskZonesResponse } from '@nomadaai/shared';

export interface RouteLines {
  safe: Coordinate[];    // ruta segura (azul)
  direct: Coordinate[];  // ruta directa (gris, comparación)
}

export interface RiskMapProps {
  dark: boolean;
  riskOn: boolean;
  riskData: RiskZonesResponse | null;
  userLocation: [number, number] | null; // [lon, lat]
  routes?: RouteLines | null;
  destination?: [number, number] | null; // marcador de destino
}
