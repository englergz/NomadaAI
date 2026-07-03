from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app import state
from app.data.risk import RiskStore
from app.models.schemas import IncidentReport, IncidentResponse
from app.state import get_risk

router = APIRouter(tags=["risk"])


@router.get("/risk/cities")
def risk_cities() -> dict:
    """Ciudades con mapa de riesgo disponible (para el selector)."""
    return {"cities": sorted(state.risk_cities.keys()) or ["tumaco"]}


@router.get("/risk/zones")
def risk_zones(
    hour: int = Query(19, ge=0, le=23, description="Hora del día (0-23)"),
    day: int | None = Query(None, ge=0, le=6, description="Día de la semana (0=lun … 6=dom)"),
    city: str = Query("tumaco", description="Ciudad (tumaco, cali, …)"),
    risk: RiskStore = Depends(get_risk),
) -> dict:
    """Zonas de riesgo por hora, día y ciudad (OE2): riesgo espacio-temporal por zona."""
    store = state.risk_cities.get(city, risk)
    fc = store.zones_geojson(hour, day)
    fc["max_risk"] = round(store.max_risk, 2)
    fc["city"] = city
    return fc


@router.post("/incidents/report", response_model=IncidentResponse)
def report_incident(report: IncidentReport) -> IncidentResponse:
    """Reporte ciudadano (cimiento de 'tiempo real') — stub: aún no persiste."""
    return IncidentResponse(
        accepted=False,
        id=None,
        note="Stub: la persistencia de reportes se habilita con la tabla incidents (OE2).",
    )
