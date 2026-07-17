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
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException

from app.core.auth import verify_bearer
from app.core.config import get_settings
from app.data import appconfig, history, incidents

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
