"""Esquemas Pydantic = contrato de la API.

Estos modelos son el espejo de los tipos TypeScript en
`packages/shared/src/types.ts`. Mantener ambos en sincronía.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# --- Geometría ligera (GeoJSON-like) ---
Coordinate = list[float]  # [lon, lat]


class LineStringGeometry(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[Coordinate]


# --- Predicción de destino ---
class TrajectoryPoint(BaseModel):
    lon: float
    lat: float
    t: float = 0.0


class PredictRequest(BaseModel):
    points: list[TrajectoryPoint] = Field(..., min_length=3)
    type: Optional[str] = None
    topk: Optional[int] = Field(default=None, ge=1, le=100)


class PredictionCandidate(BaseModel):
    rank: int
    neighbor_id: str
    geometry: LineStringGeometry
    length_m: float
    n_points: int
    confidence: float


class PredictResponse(BaseModel):
    candidates: list[PredictionCandidate]


# --- Predicción online (streaming) + alerta anticipada (OE3) ---
class OnlineRequest(BaseModel):
    points: list[TrajectoryPoint] = Field(..., min_length=2)
    type: Optional[str] = None
    hour: int = Field(default=19, ge=0, le=23)
    day: Optional[int] = Field(default=None, ge=0, le=6)  # 0=lun … 6=dom
    # Reloj de la simulación: segundos desde medianoche en la posición ACTUAL.
    # Si se envía, el riesgo se evalúa a la hora de llegada a cada zona.
    t_seconds: Optional[float] = Field(default=None, ge=0, le=86400)
    threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    speed_mps: float = Field(default=8.3, gt=0.0, le=40.0)
    exclude_id: Optional[str] = None
    topk: int = Field(default=1, ge=1, le=5)


class RiskAlert(BaseModel):
    lon: float
    lat: float
    cell_id: str = ""
    risk: float
    risk_norm: float
    distance_m: float
    eta_s: Optional[float] = None
    hour: int
    arrival_min: int = 0
    is_high: bool


class OnlineResponse(BaseModel):
    candidates: list[PredictionCandidate]
    alert: Optional[RiskAlert] = None


# --- Generación de ruta NUEVA (OE3) ---
class BuildRouteRequest(BaseModel):
    origin: Coordinate  # [lon, lat] — dónde estoy
    dest: Coordinate    # [lon, lat] — a dónde voy
    type: Optional[str] = None  # vehículo (opcional)
    hour: int = Field(default=19, ge=0, le=23)
    risk_weight: float = Field(default=0.0, ge=0.0, le=5.0)  # λ: prioridad de seguridad
    city: Optional[str] = None  # grafo a usar; None = ciudad por defecto (tumaco)


class RouteComparison(BaseModel):
    safe_distance_m: float
    direct_distance_m: float
    safe_exposure: float
    direct_exposure: float
    exposure_reduction_pct: float


class BuildRouteResponse(BaseModel):
    coords: list[Coordinate]              # ruta segura (la que se simula)
    distance_m: float
    n: int
    vehicle_restricted: bool = False
    directional: bool = True
    direct_coords: list[Coordinate] = []  # ruta directa (para comparar)
    comparison: Optional[RouteComparison] = None


# --- Ruteo seguro (OE3 - stub tipado) ---
class RouteRequest(BaseModel):
    origin: Coordinate  # [lon, lat]
    dest: Coordinate
    risk_weight: float = Field(default=0.0, ge=0.0, le=1.0)


class RouteResponse(BaseModel):
    geometry: LineStringGeometry
    distance_m: float
    risk_score: float
    note: Optional[str] = None


# --- Riesgo por zonas (OE2 - stub tipado) ---
class RiskZonesResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict[str, Any]] = []
    note: Optional[str] = None


# --- Reporte ciudadano de incidente (cimiento "tiempo real") ---
class IncidentReport(BaseModel):
    lon: float
    lat: float
    category: str
    description: Optional[str] = Field(default=None, max_length=500)
    city: str = "tumaco"
    hour: Optional[int] = Field(default=None, ge=0, le=23)
    # identificador anónimo del dispositivo: sin él, TODOS los invitados compartían un
    # solo cubo "anon" de 5 reportes/hora, y un abusador bloqueaba a la ciudad entera
    device_id: Optional[str] = Field(default=None, max_length=64)


class IncidentResponse(BaseModel):
    accepted: bool
    id: Optional[str] = None
    note: Optional[str] = None


class FeedbackIn(BaseModel):
    """Cuatro respuestas obligatorias (1–5); el comentario es opcional."""
    useful: int = Field(ge=1, le=5)
    on_time: int = Field(ge=1, le=5)
    trust: int = Field(ge=1, le=5)
    recommend: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=800)
    city: str = "tumaco"
    platform: Optional[str] = Field(default=None, max_length=20)
    # identificador anónimo del dispositivo: rate-limit por persona sin exigir cuenta
    device_id: Optional[str] = Field(default=None, max_length=64)


class FeedbackResponse(BaseModel):
    accepted: bool
    id: Optional[str] = None
    note: Optional[str] = None
