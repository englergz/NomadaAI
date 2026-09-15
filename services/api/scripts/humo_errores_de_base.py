#!/usr/bin/env python3
"""Pruebas de humo: si la base de datos falla, el cliente no recibe el texto del error.

Por qué existe: `POST /feedback`, `POST /incidents/report` y `GET /incidents/aggregate` devolvían
la excepción tal cual (`note=f"Error al guardar: {e}"`, `"error": str(e)`). Un fallo de conexión de
psycopg nombra en ese texto el servidor de la base, y la app móvil muestra `note` al usuario. Cada
prueba fija tres cosas: nada del error llega a la respuesta, el contrato de la respuesta no cambia
y la excepción queda registrada en el log del servidor.

Cómo corre, y por qué así:
- **En proceso**, llamando a la app ASGI directamente: sin servidor, sin red y sin httpx.
- **Conexión simulada**: `_connect` de cada módulo de datos lanza un error cuyo texto trae host, IP,
  usuario y clave ficticios. `psycopg` queda bloqueado en `sys.modules`, así que ni una simulación
  mal instalada podría abrir una conexión real.
- El resto es el código de verdad: rutas, validación, capa de datos y registro de errores.

Uso:  cd services/api && .venv/bin/python scripts/humo_errores_de_base.py
Código de salida 1 si alguna prueba falla.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

# Antes de importar la app: sin base real ni límite por IP. Las peticiones van sin
# `Authorization`, así que nada intenta verificar un token.
os.environ.pop("DATABASE_URL", None)
os.environ.pop("CLERK_ISSUER", None)
os.environ["RATE_LIMIT_ENABLED"] = "false"
sys.modules["psycopg"] = None  # `import psycopg` lanza ImportError: ninguna conexión real es posible
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from _asgi_en_proceso import pedir  # noqa: E402
from app.data import feedback as datos_opinion  # noqa: E402
from app.data import incidents as datos_incidentes  # noqa: E402
from app.main import create_app  # noqa: E402

# ---------------------------------------------------------------------- conexión simulada
HOST, IP, USUARIO, CLAVE = "ep-ficticio-7431.us-east-2.aws.neon.tech", "10.20.30.40", "rol_ficticio", "clave-ficticia-5b9e"
DSN = f"postgresql://{USUARIO}:{CLAVE}@{HOST}/neondb?sslmode=require"
SECRETOS = (HOST, "neon.tech", IP, USUARIO, CLAVE)   # nada de esto puede aparecer en una respuesta


class OperationalError(Exception):
    """Hace las veces de `psycopg.OperationalError`."""


# El texto de un fallo de conexión con el formato de libpq y, como peor caso, uno con el DSN entero.
FALLOS = {
    "fallo de conexión": lambda: OperationalError(
        f'connection failed: connection to server at "{HOST}" ({IP}), port 5432 failed: '
        f'FATAL:  password authentication failed for user "{USUARIO}"'
    ),
    "DSN completo en el error": lambda: OperationalError(f"no se pudo usar la cadena de conexión {DSN}"),
}


class BaseCaida:
    """Cada intento de conexión se cuenta y lanza el error elegido."""

    def __init__(self) -> None:
        self.fabricar = FALLOS["fallo de conexión"]
        self.intentos = 0
        self.ultimo: Exception | None = None

    def conectar(self):
        self.intentos += 1
        self.ultimo = self.fabricar()
        raise self.ultimo


BASE = BaseCaida()
MODULOS_DE_DATOS = (datos_opinion, datos_incidentes)
for _modulo in MODULOS_DE_DATOS:
    _modulo._dsn = lambda: DSN      # la base «está configurada»: las rutas llegan a conectar
    _modulo._connect = BASE.conectar
    _modulo._ready = False

APP = create_app()


# ------------------------------------------------------------------------------ utilidades
class _Captura(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.registros: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.registros.append(record)


def con_base_caida(fallo: str, logger: str, method: str, path: str, body=None):
    """Petición con la base caída. Devuelve (status, json, registros de `logger`)."""
    log, captura = logging.getLogger(logger), _Captura()
    BASE.fabricar, BASE.intentos, BASE.ultimo = FALLOS[fallo], 0, None
    log.addHandler(captura)
    log.propagate = False   # el traceback esperado no ensucia la salida de las pruebas
    try:
        status, cuerpo = pedir(APP, method, path, body=body)
    finally:
        log.removeHandler(captura)
        log.propagate = True
    return status, cuerpo, captura.registros


def igual(obtenido, esperado, que: str) -> None:
    if obtenido != esperado:
        raise AssertionError(f"{que}: se esperaba {esperado!r} y llegó {obtenido!r}")


def comprobar(logger: str, method: str, path: str, body, fijos: dict, campo_mensaje: str) -> None:
    """Con cada fallo: sin detalles en la respuesta, mismo contrato y el error en el log del servidor."""
    for fallo in FALLOS:
        st, cuerpo, registros = con_base_caida(fallo, logger, method, path, body)
        que = f"{method} {path} · {fallo}"
        igual(st, 200, f"{que} · status")
        texto = json.dumps(cuerpo, ensure_ascii=False)
        igual([s for s in SECRETOS if s in texto], [], f"{que} · fragmentos del error en la respuesta {texto}")
        igual(sorted(cuerpo), sorted([*fijos, campo_mensaje]), f"{que} · campos de la respuesta")
        igual({k: cuerpo[k] for k in fijos}, fijos, f"{que} · valores del contrato")
        mensaje = cuerpo[campo_mensaje]
        igual(isinstance(mensaje, str) and bool(mensaje.strip()), True, f"{que} · «{campo_mensaje}» trae un mensaje")
        igual(BASE.intentos > 0, True, f"{que} · la ruta intentó conectar (si no, no se probó el fallo)")
        igual(
            [(r.name, r.levelname, r.exc_info[1] if r.exc_info else None) for r in registros],
            [(logger, "ERROR", BASE.ultimo)],
            f"{que} · la excepción queda registrada en el servidor",
        )


# ---------------------------------------------------------------------------------- pruebas
DEVICE_ID = "3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b"
OPINION = {"useful": 4, "on_time": 5, "trust": 4, "recommend": 5, "comment": "Me sirvió",
           "platform": "android", "device_id": DEVICE_ID}
REPORTE = {"lon": -78.79, "lat": 1.80, "category": "robo", "hour": 21, "device_id": DEVICE_ID}


def t_opinion():
    comprobar("nomadaai.feedback", "POST", "/feedback", OPINION, {"accepted": False, "id": None}, "note")


def t_reporte():
    comprobar("nomadaai.risk", "POST", "/incidents/report", REPORTE, {"accepted": False, "id": None}, "note")


def t_agregado():
    comprobar("nomadaai.risk", "GET", "/incidents/aggregate?city=tumaco", None,
              {"available": False, "cells": []}, "error")


PRUEBAS = [
    ("Opinión · POST /feedback con la base caída: mensaje genérico y el error solo en el log", t_opinion),
    ("Reporte · POST /incidents/report con la base caída: mensaje genérico y el error solo en el log", t_reporte),
    ("Agregado · GET /incidents/aggregate con la base caída: mensaje genérico y el error solo en el log", t_agregado),
]


def main() -> None:
    instalada = sys.modules.get("psycopg", "") is None and all(
        m._connect == BASE.conectar for m in MODULOS_DE_DATOS
    )
    if not instalada:
        raise SystemExit("La conexión simulada no quedó instalada: no se corre nada.")
    print("PRUEBAS DE HUMO — errores de base de datos sin detalles al cliente (en proceso, sin red)\n")
    fallos = 0
    for nombre, fn in PRUEBAS:
        try:
            fn()
            ok, detalle = True, ""
        except AssertionError as e:
            ok, detalle = False, str(e)
        except Exception as e:  # noqa: BLE001
            ok, detalle = False, f"excepción: {type(e).__name__}: {e}"
        fallos += not ok
        print(f"  [{'PASA' if ok else 'FALLA'}] {nombre}" + (f"\n          {detalle}" if detalle else ""))
    print(f"\n{len(PRUEBAS) - fallos}/{len(PRUEBAS)} pasan")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
