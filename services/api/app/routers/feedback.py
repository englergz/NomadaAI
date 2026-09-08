"""POST /feedback — el formulario de opinión llega al servidor, no al correo.

La identidad sale del token cuando existe; si no, del identificador anónimo del
dispositivo que la app ya usa para el borrado de datos. Así el rate-limit es por
persona y no un cubo único «anon» compartido por todos los invitados.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header

from app.core.auth import verify_bearer
from app.data import feedback
from app.models.schemas import FeedbackIn, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse)
def submit_feedback(
    body: FeedbackIn, authorization: Optional[str] = Header(None)
) -> FeedbackResponse:
    try:
        data = body.model_dump()
        data["user_id"] = verify_bearer(authorization) or data.pop("device_id", None) or "anon"
        data.pop("device_id", None)
        r = feedback.submit(data)
        return FeedbackResponse(accepted=r["accepted"], id=r.get("id"), note=r.get("note"))
    except Exception as e:  # noqa: BLE001 — una opinión nunca debe tumbar la app
        return FeedbackResponse(accepted=False, note=f"Error al guardar: {e}")
