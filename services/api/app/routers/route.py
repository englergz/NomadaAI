from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app import state
from app.ml.router import RouteGraph
from app.ml.routing import safe_route
from app.models.schemas import (
    BuildRouteRequest,
    BuildRouteResponse,
    LineStringGeometry,
    RouteComparison,
    RouteRequest,
    RouteResponse,
)
from app.state import get_route_graph_for

router = APIRouter(prefix="/route", tags=["routing"])


@router.post("/build", response_model=BuildRouteResponse)
def route_build(req: BuildRouteRequest) -> BuildRouteResponse:
    """Genera una ruta NUEVA (origen→destino) sobre la red vial real de la ciudad.

    El trazado se compone de tramos de calle reales, pero es una combinación que el
    modelo nunca vio como trayectoria: sirve para inyectar recorridos nuevos y probar
    la predicción sin sesgo. El destino NO se envía al modelo de predicción.

    `city` elige el grafo: Tumaco usa el de sus trayectorias, las demás el de su red vial
    de OSM. Si la ciudad no tiene red cargada, se responde 422 explicando qué SÍ funciona
    allí (mapa de riesgo y recorrido libre), en vez de un error genérico.
    """
    graph = get_route_graph_for(getattr(req, "city", None))
    r = graph.route(
        req.origin, req.dest, vtype=req.type,
        hour=req.hour, risk_weight=req.risk_weight, risk=state.risk,
    )
    if r is None:
        raise HTTPException(
            status_code=422,
            detail="No se pudo trazar una ruta entre esos puntos (¿muy lejos de la red o iguales?).",
        )
    comp = r.get("comparison")
    return BuildRouteResponse(
        coords=r["coords"], distance_m=r["distance_m"], n=r["n"],
        vehicle_restricted=r.get("vehicle_restricted", False),
        directional=r.get("directional", True),
        direct_coords=r.get("direct_coords", []),
        comparison=RouteComparison(**comp) if comp else None,
    )


@router.post("/safe", response_model=RouteResponse)
def route_safe(req: RouteRequest) -> RouteResponse:
    """Ruta segura (OE3) — stub: ruta directa hasta integrar el peso de riesgo."""
    r = safe_route(
        (req.origin[0], req.origin[1]),
        (req.dest[0], req.dest[1]),
        risk_weight=req.risk_weight,
    )
    return RouteResponse(
        geometry=LineStringGeometry(coordinates=r["coordinates"]),
        distance_m=r["distance_m"],
        risk_score=r["risk_score"],
        note=r["note"],
    )
