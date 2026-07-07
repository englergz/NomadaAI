// Interfaz común del mapa (web y nativo comparten estas props).
import type { RiskZonesResponse } from '@nomadaai/shared';

export interface RiskMapProps {
  dark: boolean;
  riskOn: boolean;
  riskData: RiskZonesResponse | null;
  userLocation: [number, number] | null; // [lon, lat]
}
