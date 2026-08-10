#!/usr/bin/env python3
"""C5 — pruebas de humo sobre `/route/build`, el manejo de rutas seguras.

Por qué existe: el indicador aprobado dice «funcionalidad operativa **sin errores críticos
en el manejo de rutas seguras**». Las 21 pruebas de `apps/mobile` cubren alertas de zona,
recálculo por desvío y reanudación — todo cliente móvil. **El manejo de rutas seguras vive
en el backend y no tenía ni una prueba.** Esto convierte la evidencia de «adyacente» a
«sobre el objetivo».

Cada prueba comprueba una propiedad que DEBE cumplirse siempre, no un valor concreto:
son invariantes, así que no caducan cuando cambien las cifras.

Uso:  python c5_humo_route_build.py [BASE_URL]
Salida: informe por consola + artifacts/eval/c5_humo_route_build.csv
Código de salida 1 si alguna prueba falla.
"""
from __future__ import annotations

import csv
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://englergz-nomadaai.hf.space").rstrip("/")
OUT = Path(__file__).resolve().parents[1] / "artifacts" / "eval" / "c5_humo_route_build.csv"


def _get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=120) as r:
        return json.load(r)


def _build(origin, dest, hour=20, lam=2.5):
    req = urllib.request.Request(
        f"{BASE}/route/build",
        data=json.dumps({"origin": origin, "dest": dest, "type": None,
                         "hour": hour, "risk_weight": lam}).encode(),
        headers={"content-type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def main() -> None:
    resultados: list[dict] = []

    def check(nombre: str, descripcion: str, fn) -> None:
        try:
            ok, detalle = fn()
        except Exception as e:  # noqa: BLE001
            ok, detalle = False, f"excepción: {type(e).__name__}: {e}"
        resultados.append({"prueba": nombre, "propiedad": descripcion,
                           "resultado": "PASA" if ok else "FALLA", "detalle": detalle})
        print(f"  [{'PASA' if ok else 'FALLA'}] {nombre}: {detalle}")

    # O-D real, que por construcción cae en la red vial.
    tid = _get("/trajectories/sample?n=1")["trips"][0]["id"]
    c = _get(f"/trajectories/{tid}/track")["coords"]
    o, d = c[0], c[-1]
    print(f"O-D de referencia: {tid}\n")

    def t1():
        j = _build(o, d)
        n = len(j.get("coords") or [])
        nd = len(j.get("direct_coords") or [])
        return n >= 2 and nd >= 2, f"segura {n} vértices · directa {nd}"

    def t2():
        try:
            _build([0.0, 0.0], [0.1, 0.1])
            return False, "aceptó un O-D fuera de la red (debía fallar limpio)"
        except urllib.error.HTTPError as e:
            return e.code in (400, 404, 422), f"falla limpia con HTTP {e.code}"

    def t3():
        j = _build(o, d, lam=0.0)
        r = (j.get("comparison") or {}).get("exposure_reduction_pct")
        return r is not None and abs(r) < 1e-6, f"λ=0 → reducción {r}"

    def t4():
        malas = []
        for lam in (1.0, 2.5, 5.0):
            r = (_build(o, d, lam=lam).get("comparison") or {}).get("exposure_reduction_pct")
            if r is None or r < 0:
                malas.append((lam, r))
        return not malas, "ninguna reducción negativa" if not malas else f"negativas en {malas}"

    def t5():
        cm = _build(o, d, lam=5.0).get("comparison") or {}
        s, dd = cm.get("safe_distance_m"), cm.get("direct_distance_m")
        return s is not None and dd is not None and s >= dd * 0.999, \
            f"segura {s:.1f} m ≥ directa {dd:.1f} m"

    def t6():
        cm = _build(o, d, lam=5.0).get("comparison") or {}
        se, de = cm.get("safe_exposure"), cm.get("direct_exposure")
        return se is not None and de is not None and se <= de * 1.001, \
            f"exposición segura {se:.1f} ≤ directa {de:.1f}"

    def t7():
        a = (_build(o, d, hour=20).get("comparison") or {}).get("direct_exposure")
        b = (_build(o, d, hour=3).get("comparison") or {}).get("direct_exposure")
        return a is not None and b is not None and a != b, \
            f"exposición 20:00={a:.1f} vs 03:00={b:.1f} (la hora modula)"

    def t8():
        v = [(_build(o, d, lam=x).get("comparison") or {}).get("exposure_reduction_pct")
             for x in (0.0, 2.5, 5.0)]
        return all(x is not None for x in v) and v[0] <= v[1] <= v[2] + 1e-9, \
            f"reducción no decreciente con λ: {v}"

    print("C5 · PRUEBAS DE HUMO — manejo de rutas seguras (/route/build)\n")
    check("ruta_factible", "un O-D válido devuelve una ruta con ≥2 vértices", t1)
    check("od_invalido", "un O-D fuera de la red falla limpio (4xx), no 5xx", t2)
    check("lambda_cero", "λ=0 devuelve reducción exactamente 0", t3)
    check("no_negativa", "λ>0 nunca devuelve reducción negativa", t4)
    check("segura_no_mas_corta", "la ruta segura nunca es más corta que la directa", t5)
    check("exposicion_menor", "la exposición de la segura no supera la de la directa", t6)
    check("hora_modula", "cambiar la hora cambia la exposición", t7)
    check("monotonia_lambda", "más λ nunca reduce menos", t8)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(resultados[0].keys()))
        w.writeheader(); w.writerows(resultados)

    pasa = sum(1 for r in resultados if r["resultado"] == "PASA")
    print(f"\n===== {pasa}/{len(resultados)} pruebas aprobadas =====")
    print(f"CSV: {OUT}")
    if pasa != len(resultados):
        sys.exit(1)


if __name__ == "__main__":
    main()
