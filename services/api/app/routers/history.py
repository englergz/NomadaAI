"""Histórico de efectividad **por usuario** (persistido en Postgres/Supabase).

Un registro por viaje simulado, atado a `user_id`, con dos comparaciones: predicción (modelo vs
línea recta) y protección (ruta segura vs directa). Expone agregados por usuario, globales y un
panel BI. Degrada con elegancia si no hay base de datos configurada.

Identidad (`app/core/identity.py`): todo lo PERSONAL —leer los agregados propios, borrar y
reclamar el histórico del uid anterior— exige probar quién se es con el token de sesión o con la
llave del dispositivo. El `user_id` que mande el cliente se ignora siempre, y no existe borrado de
una ciudad entera.
"""
from __future__ import annotations

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.core import identity
from app.data import feedback, history, incidents

router = APIRouter(prefix="/history", tags=["history"])
logger = logging.getLogger("nomadaai.history")

# Viajes sin identidad probada: cuentan en la estadística global, pero no son de nadie.
# Ninguna prueba resuelve a este valor, así que nadie puede leerlos ni borrarlos.
SIN_ATRIBUIR = "anon"


class TripRecord(BaseModel):
    # Sin `user_id`: la identidad sale de las cabeceras. Si un cliente antiguo lo manda,
    # Pydantic lo descarta.
    session_id: Optional[str] = None
    mode: Optional[str] = None
    vehicle: Optional[str] = None
    hour: Optional[int] = None
    n_pred: int = 0
    model_err_sum: float = 0.0
    base_err_sum: float = 0.0
    model_hit50: int = 0
    base_hit50: int = 0
    alerts: int = 0
    exposure_reduction_pct: Optional[float] = None
    safe_exposure: Optional[float] = None
    direct_exposure: Optional[float] = None
    safe_dist_m: Optional[float] = None
    direct_dist_m: Optional[float] = None
    city: str = "tumaco"


class ClaimRequest(BaseModel):
    legacy_id: str


def _require_identity(authorization: Optional[str], device_key: Optional[str]) -> str:
    """`user_id` probado o 401. Una prueba que no vale nunca cae a otra identidad."""
    try:
        uid = identity.resolve(authorization, device_key)
    except identity.InvalidCredentials as e:
        raise HTTPException(status_code=401, detail=str(e)) from None
    if not uid:
        raise HTTPException(status_code=401, detail="Hace falta iniciar sesión o la llave del dispositivo")
    return uid


@router.post("/trip")
def log_trip(
    rec: TripRecord,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    data = rec.model_dump()
    try:
        data["user_id"] = identity.resolve(authorization, x_device_key) or SIN_ATRIBUIR
    except identity.InvalidCredentials:
        data["user_id"] = SIN_ATRIBUIR  # una sesión caducada no rompe la simulación
    try:
        return history.log_trip(data)
    except Exception:  # noqa: BLE001 — nunca romper la simulación por la DB
        logger.exception("POST /history/trip")
        return {"ok": False, "error": "No se pudo guardar el viaje"}


@router.get("/summary")
def get_summary(
    city: str = "tumaco",
    scope: Literal["me", "global"] = "me",
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    """Agregados propios (`scope=me`, exige identidad) o de todos (`scope=global`, sin ella)."""
    uid = _require_identity(authorization, x_device_key) if scope == "me" else None
    try:
        return history.summary(city, uid)
    except Exception:  # noqa: BLE001
        logger.exception("GET /history/summary")
        return {"available": False, "error": "No se pudo leer el histórico"}


@router.get("/stats")
def get_stats(city: str = "tumaco") -> dict:
    try:
        return history.stats(city)
    except Exception:  # noqa: BLE001
        logger.exception("GET /history/stats")
        return {"available": False, "error": "No se pudieron leer las estadísticas"}


@router.delete("")
def reset(
    city: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    """Borra el histórico de QUIEN LO PIDE: en todas las ciudades o solo en `city`."""
    uid = _require_identity(authorization, x_device_key)
    try:
        return history.reset(uid, city)
    except Exception:  # noqa: BLE001
        logger.exception("DELETE /history")
        return {"ok": False, "error": "No se pudo borrar el histórico"}


@router.post("/claim")
def claim_legacy(body: ClaimRequest, x_device_key: Optional[str] = Header(None)) -> dict:
    """Pasa a la llave del dispositivo el histórico, los reportes y las opiniones de su uid anterior.

    Antes de la llave, cada dispositivo guardaba su histórico con un uid que viajaba en la URL y
    que el servidor almacenaba tal cual. Presentarlo junto a la llave re-asigna esas filas al
    identificador de la llave; desde ese momento el uid ya no alcanza nada. Solo se aceptan uids
    con forma de uid de dispositivo: nunca filas de cuenta ni `anon`. La sesión no cuenta aquí,
    porque el uid anterior era del dispositivo. Riesgo residual en docs/DEPLOY.md §6.
    """
    new_id = _require_identity(None, x_device_key)
    if not identity.is_legacy_device_id(body.legacy_id):
        raise HTTPException(status_code=422, detail="Identificador anterior no válido")
    try:
        r = history.claim(body.legacy_id, new_id)
        if r.get("ok"):
            # El mismo uid firmaba reportes y opiniones: pasan también a la llave, para que
            # «Borrar mis datos» (DELETE /me/data) los alcance.
            r["moved_reports"] = incidents.claim(body.legacy_id, new_id) if incidents.available() else 0
            r["moved_feedback"] = feedback.claim(body.legacy_id, new_id) if feedback.available() else 0
        return r
    except Exception:  # noqa: BLE001
        logger.exception("POST /history/claim")
        return {"ok": False, "error": "No se pudo reclamar el histórico"}
