#!/usr/bin/env python3
"""Pruebas de humo: `POST /incidents/report` rechaza lo que no es un reporte.

Por qué existe: el esquema aceptaba coordenadas fuera del globo y textos sin tope en
`category` y `city` (columnas `text`). Un cliente roto o alguien con `curl` podía dejar
en la base filas imposibles de agregar, y el agregado por celda alimenta el factor de
delito reportado del mapa. Ahora Pydantic corta antes de tocar la base: 422 con el
campo que falla.

Cómo corre: en proceso, sin servidor, sin red y sin base de datos (no hace falta: la
validación ocurre antes).

Uso:  cd services/api && .venv/bin/python scripts/humo_reporte_validacion.py
Código de salida 1 si alguna prueba falla.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.pop("DATABASE_URL", None)
os.environ.pop("CLERK_ISSUER", None)
os.environ["RATE_LIMIT_ENABLED"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from _asgi_en_proceso import pedir  # noqa: E402
from app.main import create_app  # noqa: E402

APP = create_app()
VALIDO = {"lon": -78.785, "lat": 1.806, "category": "atraco", "city": "tumaco", "hour": 20}
fallos = 0


def caso(nombre: str, cambios: dict, esperado: int, campo: str | None = None) -> None:
    global fallos
    body = {**VALIDO, **cambios}
    status, resp = pedir(APP, "POST", "/incidents/report", body=body)
    ok = status == esperado
    if ok and esperado == 422 and campo:
        ok = any(campo in (e.get("loc") or []) for e in resp.get("detail", []))
    fallos += not ok
    print(f"  [{'PASA' if ok else 'FALLA'}] {nombre}: HTTP {status}" + ("" if ok else f" (esperado {esperado}, respuesta {resp})"))


print("HUMO · /incidents/report valida coordenadas y textos antes de tocar la base")
caso("reporte válido pasa la validación (sin base: se informa que no se guardó)", {}, 200)
caso("longitud fuera del globo", {"lon": 200.0}, 422, "lon")
caso("latitud fuera del globo", {"lat": -95.0}, 422, "lat")
caso("categoría vacía", {"category": ""}, 422, "category")
caso("categoría de 300 caracteres", {"category": "x" * 300}, 422, "category")
caso("ciudad de 300 caracteres", {"city": "y" * 300}, 422, "city")
caso("descripción de 501 caracteres", {"description": "z" * 501}, 422, "description")
caso("hora 24", {"hour": 24}, 422, "hour")
caso("descripción de 500 caracteres sí cabe", {"description": "z" * 500}, 200)

print("\nRESULTADO:", "OK" if not fallos else f"{fallos} FALLO(S)")
sys.exit(1 if fallos else 0)
