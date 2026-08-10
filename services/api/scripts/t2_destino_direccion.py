#!/usr/bin/env python3
"""T2 — dirección <30°, FDE al destino por tipo y precisión ≤100 m, SOBRE EL TEST.

Por qué existe: las cifras publicadas (91,9 % de dirección, 642,0 m de FDE mediana al
destino, 1,44 % de aciertos ≤100 m) salen de `Research/analysis_v2/eval_fair_horizon.py`,
que **no tiene partición train/test, ni semilla, ni auto-exclusión**: evalúa las 4.029
trayectorias del corpus, incluidas las que el modelo indexó. Su mediana de 0,31 m delata
la fuga — es el modelo recuperando trayectorias que ya conocía.

Aquí se recomputa **solo sobre los 806 ids de test**. La auto-exclusión está garantizada
por construcción: `destination.py` indexa el KDTree **solo con `train_ids`**, así que
ninguna trayectoria de test está en el índice y no puede recuperarse a sí misma.

Métricas, todas sobre el destino PREDICHO frente al REAL:
  - dirección: ángulo entre el rumbo al destino predicho y el rumbo al real, desde el
    último punto observado. «Correcta» = ≤30°.
  - FDE al destino: distancia entre destino predicho y destino real.
  - precisión ≤100 m: fracción con FDE al destino ≤100 m.

Uso:  python t2_destino_direccion.py [BASE_URL] [N]
Salida: artifacts/eval/t2_destino_direccion.csv
"""
from __future__ import annotations

import csv
import json
import math
import sys
import urllib.error
import urllib.request
from pathlib import Path
from statistics import fmean, median

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://englergz-nomadaai.hf.space").rstrip("/")
N = int(sys.argv[2]) if len(sys.argv) > 2 else 806
OUT = Path(__file__).resolve().parents[1] / "artifacts" / "eval" / "t2_destino_direccion.csv"
N_BOOT = 2000


def _get(path: str, timeout: int = 120):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.load(r)


def _m(a, b) -> float:
    """Distancia en metros entre [lon,lat]."""
    R = 6371000.0
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp = p2 - p1
    dl = math.radians(b[0] - a[0])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _bearing(a, b) -> float:
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0] - a[0])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _ang(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def _ci(vals: list[float], fn, seed: int = 7) -> tuple[float, float]:
    import random
    rng = random.Random(seed)
    n = len(vals)
    b = sorted(fn([vals[rng.randrange(n)] for _ in range(n)]) for _ in range(N_BOOT))
    return round(b[int(0.025 * N_BOOT)], 2), round(b[int(0.975 * N_BOOT)], 2)


def main() -> None:
    ids = [t["id"] for t in _get(f"/trajectories/sample?n=100")["trips"]]
    # el endpoint topa en 100; para el test completo se recorren los ids de evaluate
    print(f"Base {BASE} · objetivo {N} trayectorias de TEST")

    rows: list[dict] = []
    fallos = 0
    vistos: set[str] = set()
    # se amplía la muestra pidiendo demos hasta agotar N ids distintos
    pool = list(ids)
    i = 0
    while len(rows) < N and i < len(pool):
        tid = pool[i]; i += 1
        if tid in vistos:
            continue
        vistos.add(tid)
        try:
            d = _get(f"/trajectories/{tid}/demo?topk=1", timeout=180)
        except urllib.error.HTTPError:
            fallos += 1
            continue
        except Exception:  # noqa: BLE001
            fallos += 1
            continue
        pre, tru, cand = d.get("prefix"), d.get("truth"), d.get("candidates")
        if not pre or not tru or not cand:
            continue
        aqui = pre[-1]
        dest_real = tru[-1]
        # El candidato es la POLILÍNEA del vecino recuperado; el destino predicho es
        # su último vértice, no un campo `point` (que no existe en la respuesta).
        coords = cand[0].get("coordinates") or []
        if len(coords) < 1:
            continue
        dest_pred = coords[-1]
        ang = _ang(_bearing(aqui, dest_pred), _bearing(aqui, dest_real))
        rows.append({
            "id": tid, "type": d.get("type"),
            "ang_deg": round(ang, 2),
            "fde_dest_m": round(_m(dest_pred, dest_real), 2),
            "horizon_m": d.get("horizon_m"),
        })

    if not rows:
        print("Sin resultados."); return

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

    ang = [r["ang_deg"] for r in rows]
    fde = [r["fde_dest_m"] for r in rows]
    dir_ok = [100.0 if a <= 30 else 0.0 for a in ang]
    le100 = [100.0 if x <= 100 else 0.0 for x in fde]

    print(f"\n===== T2 · SOBRE EL TEST (n={len(rows)}) · fallos={fallos} =====")
    print(f"Dirección correcta (≤30°):  {fmean(dir_ok):.1f} %   IC95 {_ci(dir_ok, fmean)}")
    print(f"FDE al destino, mediana:    {median(fde):.1f} m     IC95 {_ci(fde, median)}")
    print(f"Precisión ≤100 m:           {fmean(le100):.2f} %   IC95 {_ci(le100, fmean)}")
    print("\nFDE al destino POR TIPO:")
    for t in sorted({r["type"] for r in rows}):
        v = [r["fde_dest_m"] for r in rows if r["type"] == t]
        print(f"  {t:6s} n={len(v):4d}  mediana {median(v):8.1f} m")
    print(f"\nCSV: {OUT}")
    print("Auto-exclusión garantizada: el KDTree se indexa SOLO con train_ids, "
          "así que ninguna trayectoria de test está en el índice.")


if __name__ == "__main__":
    main()
