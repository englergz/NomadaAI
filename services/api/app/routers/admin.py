"""Panel admin (U6) — TODO verificado en servidor, nada de confiar en el cliente.

Autorización: token de sesión Clerk (firma RS256 contra el JWKS del emisor) +
allowlist ADMIN_USER_IDS. Sin CLERK_ISSUER o sin ids configurados, el panel queda
deshabilitado (403 siempre): seguro por defecto.

Endpoints:
- GET  /config/app           (público)  config de producto para las apps.
- GET  /admin/me             (admin)    confirma rol — el frontend decide si muestra el panel.
- PUT  /admin/config/app     (admin)    edita config validada (niveles de protección, ads).
- GET  /admin/reports        (admin)    reportes ciudadanos recientes (moderación).
- DELETE /admin/reports/{id} (admin)    elimina un reporte.
- GET  /admin/summary        (admin)    BI: totales de reportes y uso (histórico global).
- GET  /admin/feedback       (admin)    opiniones: agregados + comentarios recientes.
- GET  /admin/cities         (admin)    qué tiene cada ciudad: riesgo, ruteo, predicción y factores.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException

from app import state
from app.core.auth import verify_bearer
from app.core.config import get_settings
from app.data import appconfig, feedback, history, incidents

router = APIRouter()


def _require_admin(authorization: Optional[str]) -> str:
    """Devuelve el user_id admin o lanza 401/403. El rol vive SOLO en servidor."""
    sub = verify_bearer(authorization)
    if not sub:
        raise HTTPException(status_code=401, detail="Sesión requerida")
    if sub not in get_settings().admin_id_list:
        raise HTTPException(status_code=403, detail="Sin rol de administrador")
    return sub


@router.get("/config/app")
def config_app() -> dict[str, Any]:
    """Config de producto (pública: la leen las apps al arrancar)."""
    return appconfig.get_config()


@router.get("/admin/me")
def admin_me(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    user = _require_admin(authorization)
    return {"admin": True, "user_id": user}


@router.put("/admin/config/app")
def admin_set_config(
    body: dict[str, Any],
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    user = _require_admin(authorization)
    err = appconfig.validate(body)
    if err:
        raise HTTPException(status_code=422, detail=err)
    if not appconfig.available():
        raise HTTPException(status_code=503, detail="Sin base de datos configurada (DATABASE_URL)")
    return appconfig.set_config(body, updated_by=user)


@router.get("/admin/reports")
def admin_reports(
    city: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _require_admin(authorization)
    return {"reports": incidents.list_recent(city, limit)}


@router.delete("/admin/reports/{incident_id}")
def admin_delete_report(
    incident_id: int,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _require_admin(authorization)
    if not incidents.delete(incident_id):
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return {"deleted": incident_id}


@router.get("/admin/summary")
def admin_summary(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    _require_admin(authorization)
    out: dict[str, Any] = {"history": None, "reports": None}
    try:
        out["history"] = history.stats()
    except Exception:  # noqa: BLE001 — BI parcial es mejor que 500
        out["history"] = {"available": False}
    try:
        rows = incidents.list_recent(None, 500)
        by_cat: dict[str, int] = {}
        by_city: dict[str, int] = {}
        for r in rows:
            by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
            by_city[r["city"]] = by_city.get(r["city"], 0) + 1
        out["reports"] = {"total": len(rows), "by_category": by_cat, "by_city": by_city}
    except Exception:  # noqa: BLE001
        out["reports"] = {"total": 0, "by_category": {}, "by_city": {}}
    return out


@router.get("/admin/feedback")
def admin_feedback(
    limit: int = 100,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    """Opiniones del formulario: promedios por pregunta y comentarios recientes.

    Antes llegaban como correos sueltos a una bandeja personal; ahora se agregan aquí.
    Los comentarios individuales solo se sirven tras verificar el rol en servidor.
    """
    _require_admin(authorization)
    return {"summary": feedback.summary(), "recent": feedback.list_recent(limit)}


@router.get("/admin/cities")
def admin_cities(authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
    """Estado REAL de cada ciudad: los tres ingredientes y la configuración de factores.

    Existía la pregunta «¿qué le falta a esta ciudad?» y había que responderla leyendo
    artefactos a mano. Aquí se responde con lo que el servidor tiene cargado:

      · riesgo     → malla publicada (celdas, horas, máximo)
      · ruteo      → red vial: del corpus de trayectorias o descargada de OSM
      · predicción → solo donde hay trayectorias para entrenar

    No se fuerza la carga del grafo (Cali son 127.699 nodos): si aún no está en
    memoria se informa del artefacto en disco, que es barato y no miente.
    Los factores salen de `risk_config.<city>.json`: pesos, cuáles están apagados y
    el MOTIVO. Es de solo lectura a propósito — cambiar un peso exige re-correr el
    pipeline offline y regenerar la malla, no se puede hacer en caliente.
    """
    _require_admin(authorization)
    art = state.risk_artifacts_dir()
    routing = set(state.route_cities())
    names = sorted(set(state.risk_cities) | routing | {state.DEFAULT_CITY})

    out: list[dict[str, Any]] = []
    for name in names:
        store = state.get_risk_for(name)
        risk: dict[str, Any] = {"available": store is not None}
        if store is not None:
            risk |= {
                "cells": store.n_zones,
                "hours": len(getattr(store, "_by_hour", {}) or {}),
                "max_risk": round(float(store.max_risk), 2),
            }

        red = art / f"{name}_red_vial.json.gz"
        graph = state.route_graphs.get(name)
        route: dict[str, Any] = {"available": name in routing}
        if route["available"]:
            route["source"] = "osm" if red.exists() else "trayectorias"
            route["loaded"] = graph is not None
            if graph is not None:
                route |= {"nodes": graph.n_nodes, "edges": graph.n_edges}
            elif red.exists():
                route["artifact_mb"] = round(red.stat().st_size / 1_048_576, 2)

        pred: dict[str, Any] = {"available": False}
        if name == state.DEFAULT_CITY and state.predictor is not None:
            pred = {
                "available": True,
                "train": len(state.predictor.train_ids),
                "test": len(state.predictor.test_ids),
            }

        cfg: dict[str, Any] | None = None
        try:
            raw = json.loads((art / f"risk_config.{name}.json").read_text(encoding="utf-8"))
            factors = [
                {"name": k, **{kk: vv for kk, vv in v.items() if kk != "comment"}}
                for k, v in (raw.get("factors") or {}).items()
            ]
            active = [f for f in factors if f.get("enabled")]
            cfg = {
                "night_floor": raw.get("night_floor"),
                "factors": factors,
                "active": len(active),
                "weight_sum": round(sum(float(f.get("weight") or 0) for f in active), 3),
            }
        except Exception:  # noqa: BLE001 — una ciudad sin config no rompe el panel
            cfg = None

        out.append({"city": name, "risk": risk, "routing": route, "prediction": pred, "config": cfg})
    return {"cities": out}
