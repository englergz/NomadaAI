from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Query

from app import state
from app.core.auth import verify_bearer
from app.data import incidents
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


@router.get("/incidents/aggregate")
def incidents_aggregate(
    city: str = Query("tumaco"),
    half_life_days: float = Query(30.0, gt=0, le=365),
) -> dict:
    """F_report(z,t) — agregación ANÓNIMA por celda con decaimiento exponencial (§6).

    Solo conteos ponderados (~110 m); jamás reportes individuales. Alimenta el factor
    'delito_reportado' del pipeline cuando haya volumen suficiente.
    """
    try:
        return incidents.aggregate(city, half_life_days)
    except Exception as e:  # noqa: BLE001
        return {"available": False, "error": str(e), "cells": []}


@router.post("/incidents/report", response_model=IncidentResponse)
def report_incident(
    report: IncidentReport, authorization: Optional[str] = Header(None)
) -> IncidentResponse:
    """Reporte ciudadano (OE2, participativo): persiste con rate-limit y sin exponer crudos.

    La identidad la manda el token cuando existe (usuario autenticado); si no, 'anon'.
    """
    try:
        data = report.model_dump()
        data["user_id"] = verify_bearer(authorization) or "anon"
        r = incidents.report(data)
        return IncidentResponse(accepted=r["accepted"], id=r.get("id"), note=r.get("note"))
    except Exception as e:  # noqa: BLE001 — el reporte nunca debe tumbar la app
        return IncidentResponse(accepted=False, note=f"Error al guardar: {e}")
