"""CÍRCULOS — grupos de cuidado donde la ubicación se comparte por EXCEPCIÓN.

Reglas que este router hace cumplir, y que son la razón de que exista:

- **Identidad probada siempre** (token de sesión; la llave de dispositivo no basta): un círculo
  es una relación entre personas y tiene que sobrevivir al cambio de teléfono. Sin cuenta se
  responde 403 explicando por qué, no un error críptico.
- **Nada fuera de tu círculo**: cada ruta comprueba que quien pregunta sea miembro. Conocer el
  número de un círculo no da acceso a nada.
- **Los disparadores son de cada persona**: solo tú cambias los tuyos, ni el dueño del círculo.
- **La posición solo entra con un evento abierto y tuyo**, y al cerrarlo se borra el rastro
  (`app/data/circles.py`). El servidor no guarda por dónde anduvo nadie.

Lo que todavía NO hay, dicho claro: aviso al miembro con la app cerrada. Eso exige push desde el
servidor (Firebase), que está pendiente de decisión. Mientras tanto, un círculo se entera cuando
alguien tiene la app abierta o al volver a ella.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app.data import circles
from app.models.schemas import (
    CircleEventIn, CircleIn, CircleJoinIn, CirclePositionIn, CirclePrefsIn,
)
from app.routers.history import _require_identity

router = APIRouter(prefix="/circles", tags=["circles"])
logger = logging.getLogger("nomadaai.circles")


def _cuenta(authorization: Optional[str], device_key: Optional[str]) -> str:
    """Identidad de CUENTA o 403. El modo invitado no puede tener círculos (ver cabecera)."""
    uid = _require_identity(authorization, device_key)
    if not circles.es_cuenta(uid):
        raise HTTPException(
            status_code=403,
            detail="Los círculos necesitan una cuenta: es lo que permite que te acompañen aunque cambies de teléfono.",
        )
    return uid


def _con_base() -> None:
    if not circles.available():
        raise HTTPException(status_code=503, detail="El servidor no tiene base de datos: los círculos no están disponibles")


def _miembro(circle_id: int, uid: str) -> None:
    if not circles.es_miembro(circle_id, uid):
        # 404 y no 403: quien no es miembro no debería ni poder distinguir si el círculo existe.
        raise HTTPException(status_code=404, detail="Ese círculo no existe o ya no estás en él")


@router.post("")
def crear_circulo(
    body: CircleIn,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    try:
        return circles.crear(uid, body.name, body.kind, body.alias)
    except Exception:  # noqa: BLE001
        logger.exception("POST /circles")
        raise HTTPException(status_code=500, detail="No se pudo crear el círculo") from None


@router.post("/join")
def unirse_a_circulo(
    body: CircleJoinIn,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    if not circles.codigo_valido(body.code):
        raise HTTPException(status_code=400, detail="Ese código no tiene la forma de un código de círculo")
    try:
        circulo = circles.unirse(uid, body.code, body.alias)
    except Exception:  # noqa: BLE001
        logger.exception("POST /circles/join")
        raise HTTPException(status_code=500, detail="No se pudo entrar al círculo") from None
    if not circulo:
        raise HTTPException(status_code=404, detail="No hay ningún círculo con ese código")
    return circulo


@router.get("")
def mis_circulos(
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    return {"circles": circles.mios(uid)}


@router.delete("/{circle_id}/me")
def salir_del_circulo(
    circle_id: int,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    return {"left": circles.salir(uid, circle_id)}


@router.get("/{circle_id}/members")
def miembros_del_circulo(
    circle_id: int,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return {"members": circles.miembros(circle_id)}


@router.get("/{circle_id}/prefs")
def mis_disparadores(
    circle_id: int,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return circles.preferencias(circle_id, uid)


@router.put("/{circle_id}/prefs")
def guardar_mis_disparadores(
    circle_id: int,
    body: CirclePrefsIn,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return circles.guardar_preferencias(circle_id, uid, body.triggers, body.share_mode)


@router.post("/{circle_id}/events")
def abrir_evento(
    circle_id: int,
    body: CircleEventIn,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    """Empieza a compartir ubicación con el círculo por un motivo concreto."""
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return circles.abrir_evento(circle_id, uid, body.kind)


@router.post("/{circle_id}/events/{event_id}/close")
def cerrar_evento(
    circle_id: int,
    event_id: int,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    """Deja de compartir. El rastro de ese evento se borra en el mismo acto."""
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return {"closed": circles.cerrar_evento(event_id, uid)}


@router.post("/{circle_id}/events/{event_id}/positions")
def anotar_posicion(
    circle_id: int,
    event_id: int,
    body: CirclePositionIn,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    if not circles.anotar_posicion(event_id, uid, body.lon, body.lat, body.acc):
        # El evento se cerró (o nunca fue tuyo): el cliente debe dejar de mandar.
        raise HTTPException(status_code=409, detail="Ese evento ya no está abierto")
    return {"ok": True}


@router.get("/{circle_id}/events")
def eventos_del_circulo(
    circle_id: int,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    """Quién está compartiendo ahora y dónde estaba en su última señal."""
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return {"events": circles.eventos_abiertos(circle_id)}


@router.get("/{circle_id}/events/{event_id}/trail")
def rastro_del_evento(
    circle_id: int,
    event_id: int,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> dict:
    _con_base()
    uid = _cuenta(authorization, x_device_key)
    _miembro(circle_id, uid)
    return {"trail": circles.rastro(event_id)}
