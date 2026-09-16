#!/usr/bin/env python3
"""Pruebas de humo: `GET /risk/zones` solo responde con la malla de la ciudad pedida.

Por qué existe: la ruta hacía `risk_cities.get(city, risk)`, así que una ciudad sin malla
caía a la de Tumaco y la devolvía etiquetada con la ciudad pedida. Un cliente que pidiera
una ciudad recién dada de alta en el catálogo recibía 475 celdas de otra ciudad como si
fueran suyas, sin ninguna señal. Ahora una ciudad sin malla responde 404 y el nombre se
normaliza (mayúsculas, espacios) igual que en el ruteo.

Cómo corre: en proceso, contra la app ASGI, con SOLO las capas de riesgo cargadas desde los
artefactos versionados (sin predictor, sin corredores, sin base de datos).

Uso:  cd services/api && .venv/bin/python scripts/humo_riesgo_ciudades.py
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
from app import state  # noqa: E402
from app.data.risk import RiskStore  # noqa: E402
from app.main import create_app  # noqa: E402

ARTEFACTOS = Path(__file__).resolve().parents[1] / "artifacts" / "risk"

# Las mismas capas que carga el arranque real, sin lo demás.
state.risk = RiskStore(ARTEFACTOS / "tumaco_riesgo_horario.csv")
state.risk_cities["tumaco"] = state.risk
state.risk_cities["cali"] = RiskStore(ARTEFACTOS / "cali_riesgo_horario.csv")
APP = create_app()

fallos = 0


def igual(obtenido, esperado, que: str) -> None:
    global fallos
    ok = obtenido == esperado
    fallos += not ok
    print(f"  [{'PASA' if ok else 'FALLA'}] {que}: {obtenido!r}" + ("" if ok else f" (esperado {esperado!r})"))


def zonas(city: str):
    return pedir(APP, "GET", f"/risk/zones?hour=10&city={city}")


print("HUMO · /risk/zones responde SOLO con la malla de la ciudad pedida")
s, tum = zonas("tumaco")
igual(s, 200, "tumaco responde")
igual(tum["city"], "tumaco", "tumaco viene etiquetada como tumaco")
n_tum = len(tum["features"])
igual(n_tum > 0, True, f"tumaco trae celdas ({n_tum})")

s, cal = zonas("cali")
igual(s, 200, "cali responde")
igual(cal["city"], "cali", "cali viene etiquetada como cali")
igual(len(cal["features"]) != n_tum, True, f"cali NO es la malla de tumaco ({len(cal['features'])} celdas)")

s, bog = zonas("bogota")
igual(s, 404, "una ciudad sin malla responde 404 (antes: la malla de Tumaco etiquetada bogota)")
igual("features" in bog, False, "y no trae celdas de ninguna otra ciudad")
igual("tumaco" in bog.get("detail", "") and "cali" in bog.get("detail", ""), True, "el detalle dice qué ciudades sí tienen mapa")

s, mayus = zonas("TUMACO")
igual(s, 200, "el nombre se normaliza (TUMACO → tumaco)")
igual(mayus["city"], "tumaco", "y la etiqueta sale normalizada")

s, defecto = pedir(APP, "GET", "/risk/zones?hour=10")
igual(s, 200, "sin ciudad, la de defecto (tumaco)")
igual(defecto["city"], "tumaco", "etiquetada tumaco")

print("\nRESULTADO:", "OK" if not fallos else f"{fallos} FALLO(S)")
sys.exit(1 if fallos else 0)
