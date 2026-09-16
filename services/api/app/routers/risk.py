from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

from app import state
from app.core import identity
from app.data import incidents
from app.models.schemas import IncidentReport, IncidentResponse

router = APIRouter(tags=["risk"])
# Los errores se registran aquí y al cliente llega un mensaje genérico: el texto de una
# excepción puede traer detalles internos, como el servidor de la base de datos.
logger = logging.getLogger("nomadaai.risk")


@router.get("/risk/cities")
def risk_cities() -> dict:
    """Ciudades con mapa de riesgo disponible (para el selector)."""
    return {"cities": sorted(state.risk_cities.keys()) or ["tumaco"]}


@router.get("/risk/zones")
def risk_zones(
    hour: int = Query(19, ge=0, le=23, description="Hora del día (0-23)"),
    day: int | None = Query(None, ge=0, le=6, description="Día de la semana (0=lun … 6=dom)"),
    city: str = Query("tumaco", description="Ciudad (tumaco, cali, …)"),
) -> dict:
    """Zonas de riesgo por hora, día y ciudad (OE2): riesgo espacio-temporal por zona.

    Una ciudad sin malla responde 404. Antes caía a la malla de Tumaco y la devolvía
    etiquetada con la ciudad pedida (`/risk/zones?city=bogota` → las 475 celdas de Tumaco
    como si fueran de Bogotá): un cliente o un script que pidiera una ciudad recién dada
    de alta en el catálogo recibía datos de otra ciudad sin ninguna señal de que lo eran.
    El criterio es el mismo que usa el ruteo (`state.get_risk_for`).
    """
    key = city.strip().lower()
    store = state.get_risk_for(key)
    if store is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay mapa de riesgo para «{city}». Ciudades con mapa: {', '.join(sorted(state.risk_cities) or ['tumaco'])}.",
        )
    fc = store.zones_geojson(hour, day)
    fc["max_risk"] = round(store.max_risk, 2)
    fc["city"] = key
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
    except Exception:  # noqa: BLE001
        logger.exception("GET /incidents/aggregate")
        return {"available": False, "error": "No se pudieron leer los reportes", "cells": []}


@router.post("/incidents/report", response_model=IncidentResponse)
def report_incident(
    report: IncidentReport,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> IncidentResponse:
    """Reporte ciudadano (OE2, participativo): persiste con rate-limit y sin exponer crudos.

    Se atribuye a quien prueba su identidad (token o llave del dispositivo), para que «Borrar mis
    datos» lo alcance y el límite por hora sea por persona. Reglas en `identity.write_attribution`.
    """
    try:
        data = report.model_dump()
        # `device_id` no es columna: solo lo mandan las versiones de la app anteriores a la llave.
        data["user_id"] = identity.write_attribution(authorization, x_device_key, data.pop("device_id", None))
        r = incidents.report(data)
        return IncidentResponse(accepted=r["accepted"], id=r.get("id"), note=r.get("note"))
    except Exception:  # noqa: BLE001 — el reporte nunca debe tumbar la app
        logger.exception("POST /incidents/report")
        return IncidentResponse(accepted=False, note="No se pudo guardar tu reporte. Intenta de nuevo más tarde.")
