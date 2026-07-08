// Contrato de la API NómadaAI — espejo de services/api/app/models/schemas.py
// Mantener ambos en sincronía.

export type Coordinate = [number, number]; // [lon, lat]

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Coordinate[];
}

// --- Predicción de destino (OE1) ---
export interface TrajectoryPoint {
  lon: number;
  lat: number;
  t?: number;
}

export interface PredictRequest {
  points: TrajectoryPoint[];
  type?: string;
  topk?: number;
}

export interface PredictionCandidate {
  rank: number;
  neighbor_id: string;
  geometry: LineStringGeometry;
  length_m: number;
  n_points: number;
  confidence: number;
}

export interface PredictResponse {
  candidates: PredictionCandidate[];
}

// --- Demostración con viajes reales (división 75/25) ---
export interface TripSummary {
  id: string;
  type: string;
  n_points: number;
  start: Coordinate;
}

export interface TripsResponse {
  trips: TripSummary[];
}

export interface DemoResponse {
  id: string;
  type: string;
  prefix: Coordinate[];
  truth: Coordinate[];
  candidates: {
    rank: number;
    neighbor_id: string;
    coordinates: Coordinate[];
    length_m: number;
    confidence: number;
  }[];
  fde_m: number | null;
  horizon_m: number | null;
}

// --- Corredores TRACLUS (OE1) ---
export interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
  note?: string;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

// --- Ruteo seguro (OE3) ---
export interface RouteRequest {
  origin: Coordinate;
  dest: Coordinate;
  risk_weight?: number;
}

export interface RouteResponse {
  geometry: LineStringGeometry;
  distance_m: number;
  risk_score: number;
  note?: string;
}

// --- Predicción en streaming (OE1+OE3): prefijo en vivo → destino probable + alerta anticipada ---
export interface OnlineRequest {
  points: TrajectoryPoint[]; // ubicaciones acumuladas hasta ahora (mín. 2)
  type?: string;
  hour?: number;
  day?: number;              // 0=lun … 6=dom
  t_seconds?: number;        // segundos desde medianoche en la posición actual
  threshold?: number;        // umbral de alerta sobre risk_norm
  speed_mps?: number;
  exclude_id?: string;
  topk?: number;
}

export interface RiskAlert {
  lon: number;
  lat: number;
  cell_id: string;
  risk: number;
  risk_norm: number;
  distance_m: number;
  eta_s?: number | null;
  hour: number;
  arrival_min: number;
  is_high: boolean;
}

export interface OnlineResponse {
  candidates: PredictionCandidate[];
  alert?: RiskAlert | null;
}

// --- Ruteo real sobre la red vial (usado por web y móvil) ---
export interface BuildRouteRequest {
  origin: Coordinate; // [lon, lat] — dónde estoy
  dest: Coordinate;   // [lon, lat] — a dónde voy
  type?: string;      // vehículo (opcional)
  hour?: number;      // 0–23
  risk_weight?: number; // λ: prioridad de seguridad (0–5)
}

export interface RouteComparison {
  safe_distance_m: number;
  direct_distance_m: number;
  safe_exposure: number;
  direct_exposure: number;
  exposure_reduction_pct: number;
}

export interface BuildRouteResponse {
  coords: Coordinate[];        // ruta segura
  distance_m: number;
  n: number;
  vehicle_restricted: boolean;
  directional: boolean;
  direct_coords: Coordinate[]; // ruta directa (para comparar)
  comparison?: RouteComparison | null;
}

// --- Riesgo (OE2) ---
export type RiskZonesResponse = FeatureCollection;

// --- Incidentes ---
export interface IncidentReport {
  lon: number;
  lat: number;
  category: string;
  description?: string;
  city?: string;
  hour?: number;
}

export interface IncidentResponse {
  accepted: boolean;
  id?: string;
  note?: string;
}

// --- Health ---
export interface HealthResponse {
  status: string;
  environment: string;
  predictor_ready: boolean;
  n_trajectories: number;
  n_train?: number;
  n_test?: number;
  n_segments: number;
  corridors_ready: boolean;
  n_corridors: number;
}
