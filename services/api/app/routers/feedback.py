"""POST /feedback — el formulario de opinión llega al servidor, no al correo.

Se atribuye a quien prueba su identidad (token o llave del dispositivo): así el límite por
hora es por persona y «Borrar mis datos» la desvincula. Reglas en `identity.write_attribution`.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header

from app.core import identity
from app.data import feedback
from app.models.schemas import FeedbackIn, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])
# Los errores se registran aquí y al cliente llega un mensaje genérico: el texto de una
# excepción puede traer detalles internos, como el servidor de la base de datos.
logger = logging.getLogger("nomadaai.feedback")


@router.post("", response_model=FeedbackResponse)
def submit_feedback(
    body: FeedbackIn,
    authorization: Optional[str] = Header(None),
    x_device_key: Optional[str] = Header(None),
) -> FeedbackResponse:
    try:
        data = body.model_dump()
        # `device_id` no es columna: solo lo mandan las versiones de la app anteriores a la llave.
        data["user_id"] = identity.write_attribution(authorization, x_device_key, data.pop("device_id", None))
        r = feedback.submit(data)
        return FeedbackResponse(accepted=r["accepted"], id=r.get("id"), note=r.get("note"))
    except Exception:  # noqa: BLE001 — una opinión nunca debe tumbar la app
        logger.exception("POST /feedback")
        return FeedbackResponse(accepted=False, note="No se pudo guardar tu opinión. Puedes enviarla por correo.")
