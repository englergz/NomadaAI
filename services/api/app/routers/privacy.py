"""Derecho de supresión (Ley 1581 de 2012): «Borrar mis datos» en el servidor.

Una sola petición alcanza todo lo que el servidor guarda atribuido a quien lo pide:

- **Histórico de viajes**: se borra.
- **Reportes ciudadanos** (ubicación, hora, categoría y descripción): se borran.
- **Círculos de cuidado**: se sale de todos, con sus eventos, rastros y disparadores; los
  círculos que quedan sin nadie se borran.
- **Opiniones**: se DESVINCULAN. Pasan a `anon` y se conservan sin nada que las ate a la persona,
  porque la app pide la opinión justo antes de borrar para aprender de quien se va; borrarla en el
  mismo acto anularía ese propósito.

La identidad sale de una prueba —token de sesión o llave del dispositivo— como en el histórico
(`app/core/identity.py`). Ningún `user_id` que mande el cliente cuenta, y lo que quedó `anon` no es
de nadie y no se toca. Cuenta y dispositivo son identidades distintas: la app pide el borrado con
cada una.

Efecto en el modelo: los reportes borrados dejan de contar en `GET /incidents/aggregate`, la entrada
del factor de delito reportado. Es deliberado: un dato que su autor retiró no puede seguir pesando en
el mapa.

Nunca se confirma un borrado que no ocurrió: sin base de datos, o si falla una tabla, la respuesta es
`ok: false` y la app conserva la identidad para reintentar. Cada paso es idempotente, así que
reintentar tras un fallo a medias termina el trabajo.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header

from app.data import circles, feedback, history, incidents
from app.routers.history import _require_identity

router = APIRouter(prefix="/me", tags=["privacy"])
# El error se registra aquí; al cliente llega un mensaje genérico, sin detalles de la base.
logger = logging.getLogger("nomadaai.privacy")


@router.delete("/data")
def delete_my_data(
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    """Borra el histórico y los reportes de QUIEN LO PIDE y desvincula sus opiniones."""
    uid = _require_identity(authorization, x_device_key)
    if not (history.available() and incidents.available() and feedback.available()):
        return {"ok": False, "error": "El servidor no tiene base de datos: no se puede confirmar el borrado"}
    try:
        borrados = {
            "history": history.reset(uid)["deleted"],
            "reports": incidents.delete_for_user(uid),
            "circles": circles.borrar_de(uid),
        }
        desvinculados = {"feedback": feedback.unlink_user(uid)}
    except Exception:  # noqa: BLE001 — se informa sin confirmar; reintentar es seguro
        logger.exception("DELETE /me/data")
        return {"ok": False, "error": "No se pudieron borrar todos tus datos. Intenta de nuevo."}
    return {"ok": True, "deleted": borrados, "unlinked": desvinculados}
