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
  city?: string;      // grafo vial a usar; si se omite, la ciudad por defecto
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
  /** uid anónimo de versiones anteriores a la llave del dispositivo; con token o llave no se envía */
  device_id?: string;
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
  /** El histórico exige token o llave del dispositivo (ver history.ts). Ausente en backends anteriores. */
  history_identity?: boolean;
  /** Existe `DELETE /me/data`: histórico, reportes y opiniones. Ausente en backends anteriores. */
  data_deletion?: boolean;
}

/** Respuesta de «Borrar mis datos» en el servidor. */
export interface DataDeletionResponse {
  ok?: boolean;
  /** Filas borradas: histórico de viajes y reportes ciudadanos. */
  deleted?: { history: number; reports: number };
  /** Opiniones desvinculadas: se conservan sin nada que las ate a la persona. */
  unlinked?: { feedback: number };
  error?: string;
}

/** Formulario de opinión: cuatro respuestas obligatorias (1–5), comentario opcional. */
export interface FeedbackIn {
  useful: number;
  on_time: number;
  trust: number;
  recommend: number;
  comment?: string;
  city?: string;
  platform?: string;
  /** uid anónimo de versiones anteriores a la llave del dispositivo; con token o llave no se envía */
  device_id?: string;
}

export interface FeedbackResponse {
  accepted: boolean;
  id?: string;
  note?: string;
}

// --- Histórico «Tu protección» ---
/** Agregados de `/history/summary`: propios con `scope=me`, de todos con `scope=global`. */
export interface HistorySummary {
  available: boolean;
  scope?: "me" | "global";
  trips: number;
  users: number;
  alerts: number;
  prediccion: {
    n: number; model_acc50_pct: number; base_acc50_pct: number; mejora_pp: number;
    model_err_mean_m: number; base_err_mean_m: number;
  } | null;
  proteccion: { n: number; exposure_reduction_avg_pct: number } | null;
  since: string | null;
  updated: string | null;
}

/** Un viaje para `POST /history/trip`. Sin `user_id`: la identidad va en las cabeceras. */
export interface TripLogIn {
  session_id?: string | null;
  mode?: string | null;
  vehicle?: string | null;
  hour?: number | null;
  n_pred?: number;
  model_err_sum?: number;
  base_err_sum?: number;
  model_hit50?: number;
  base_hit50?: number;
  alerts?: number;
  exposure_reduction_pct?: number | null;
  safe_exposure?: number | null;
  direct_exposure?: number | null;
  safe_dist_m?: number | null;
  direct_dist_m?: number | null;
  city?: string;
}
