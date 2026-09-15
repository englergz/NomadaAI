"""Identidad de quien toca datos PERSONALES del histórico. Nunca la dicta el cliente.

Antes, leer y borrar histórico usaba el `user_id` de la query cuando no llegaba un token válido:
conocer el identificador de otra persona bastaba para ver o borrar lo suyo, y sin `user_id` el
borrado alcanzaba a la ciudad entera. Ahora la identidad sale de una prueba, en este orden:

1. **Sesión** (`Authorization: Bearer …`): el `sub` del token de Clerk verificado. Si la
   cabecera llega y el token no valida, se rechaza sin mirar la llave: un borrado pedido para
   la cuenta no puede acabar ejecutándose sobre otra identidad.
2. **Llave del dispositivo** (`X-Device-Key`, modo invitado): 32 bytes aleatorios que genera y
   guarda el propio dispositivo. El servidor no la almacena: guarda `dev_` + SHA-256 de la llave.
   Leer la base, el panel admin o un log de acceso no da con qué suplantar a nadie, y un
   identificador de dispositivo no puede coincidir con uno de cuenta (`user_…`).

El `user_id` que el cliente mande en la query o en el cuerpo se ignora siempre. Riesgo residual
del modo invitado: docs/DEPLOY.md §6.
"""
from __future__ import annotations

import hashlib
import re
from typing import Optional

from app.core.auth import verify_bearer

DEVICE_ID_PREFIX = "dev_"

# base64url sin relleno, de 32 bytes o más (43 caracteres). El uid anónimo (36) no cabe:
# la llave no puede ser un identificador que ya circuló en URLs y está guardado en la base.
_DEVICE_KEY = re.compile(r"[A-Za-z0-9_-]{43,128}")

# Formatos con que los clientes generaban el uid anónimo antes de la llave:
# crypto.randomUUID() o, sin él, `u_<Date.now()>_<Math.random() en base 36>`.
_LEGACY_DEVICE_ID = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|u_[0-9]{10,16}_[a-z0-9]{1,16}"
)


class InvalidCredentials(Exception):
    """Llegó una prueba de identidad y no vale: token caducado o ajeno, llave mal formada."""


def is_device_key(value: object) -> bool:
    return isinstance(value, str) and _DEVICE_KEY.fullmatch(value) is not None


def is_legacy_device_id(value: object) -> bool:
    """¿Tiene la forma del uid anónimo que los dispositivos usaban antes de la llave?

    Deja fuera ids de cuenta (`user_…`), ids derivados de llave (`dev_…`) y `anon`: el reclamo
    del histórico anterior no puede alcanzar filas que no fueran de un dispositivo.
    """
    return isinstance(value, str) and _LEGACY_DEVICE_ID.fullmatch(value) is not None


def device_user_id(device_key: str) -> str:
    """`user_id` que el servidor guarda para una llave: `dev_` + 160 bits de SHA-256."""
    if not is_device_key(device_key):
        raise InvalidCredentials("Llave del dispositivo no válida")
    digest = hashlib.sha256(b"nomadaai/device-key/v1:" + device_key.encode("ascii")).hexdigest()
    return DEVICE_ID_PREFIX + digest[:40]


def resolve(authorization: Optional[str], device_key: Optional[str]) -> Optional[str]:
    """`user_id` probado de quien pide, o None si no aportó ninguna prueba.

    Lanza `InvalidCredentials` si aportó una y no vale. Con token, la llave no se mira.
    """
    if authorization:
        sub = verify_bearer(authorization)
        if not sub:
            raise InvalidCredentials("No se pudo verificar la sesión")
        return sub
    if device_key:
        return device_user_id(device_key)
    return None


ANON = "anon"


def write_attribution(authorization: Optional[str], device_key: Optional[str], legacy_id: object) -> str:
    """A quién se atribuye una ESCRITURA (reporte, opinión). Nunca da acceso a leer ni a borrar.

    - Con prueba (token o llave): esa identidad. Así «Borrar mis datos» la alcanza.
    - Sin prueba: el uid anónimo que mandan las versiones de la app anteriores a la llave, solo si
      tiene esa forma. Mantiene su límite por hora por dispositivo y deja que ese dispositivo, al
      actualizarse, lo reclame y lo borre.
    - Cualquier otra cosa (un id de cuenta o de llave en el cuerpo, nada) o una prueba que no vale:
      `anon`, que no es de nadie.
    """
    try:
        uid = resolve(authorization, device_key)
    except InvalidCredentials:
        return ANON
    if uid:
        return uid
    return legacy_id if is_legacy_device_id(legacy_id) else ANON


def pseudonym(user_id: object) -> str:
    """Cómo ve el panel admin a quien escribió: tipo de autor y 10 hex de un SHA-256.

    Estable (los reportes de una misma persona comparten seudónimo, para detectar abuso) y sin el
    identificador: ni un uid anterior que circuló en URLs ni el id de una cuenta llegan al panel.
    """
    uid = str(user_id or "")
    if not uid or uid == ANON:
        return "sin atribuir"
    tipo = "cuenta" if uid.startswith("user_") else "dispositivo"
    digest = hashlib.sha256(b"nomadaai/seudonimo/v1:" + uid.encode("utf-8")).hexdigest()
    return f"{tipo}·{digest[:10]}"
