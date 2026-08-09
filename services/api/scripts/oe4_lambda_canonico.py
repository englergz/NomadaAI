#!/usr/bin/env python3
"""OE4 canónico — curva λ + bootstrap POR CLÚSTER.

Corrige dos defectos del barrido original (`oe4_od_sweep.py`):

1. **Bootstrap por clúster.** El original remuestrea las 200 FILAS como si fueran
   independientes, pero son 40 pares O-D × 5 horas: las 5 filas de un mismo par
   están correlacionadas (misma geometría, mismo corredor). El n efectivo es
   **40, no 200**, y tratarlo mal ESTRECHA el intervalo artificialmente. Aquí se
   remuestrean PARES completos, arrastrando sus 5 horas.

2. **λ declarado.** El original fija `RISK_WEIGHT = 5.0` (el máximo) sin decirlo,
   mientras el valor por defecto del producto es 0.0. Aquí se barre
   λ ∈ {0, 1, 2, 3, 5} y se reporta la curva completa.

Los pares O-D se fijan con semilla para que la corrida sea reproducible.

Uso:  python oe4_lambda_canonico.py [BASE_URL] [N_PARES]
Escribe `artifacts/eval/oe4_lambda_canonico.csv` — NO toca `oe4_od_sweep.csv`.
"""
from __future__ import annotations

import csv
import json
import random
import sys
import urllib.request
from pathlib import Path
from statistics import fmean, median

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://englergz-nomadaai.hf.space").rstrip("/")
N_PAIRS = int(sys.argv[2]) if len(sys.argv) > 2 else 40
HOURS = [6, 12, 18, 20, 22]
LAMBDAS = [0.0, 1.0, 2.0, 3.0, 5.0]
SEED = 7          # misma semilla que el muestreo de evaluate (T1)
N_BOOT = 2000


def _get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=90) as r:
        return json.load(r)


def _post(path: str, body: dict):
    req = urllib.request.Request(
        f"{BASE}{path}", data=json.dumps(body).encode(),
        headers={"content-type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def cluster_bootstrap(by_pair: dict[str, list[float]]) -> tuple[float, float]:
    """IC95 remuestreando PARES O-D completos (n_eff = nº de pares), no filas."""
    keys = list(by_pair)
    n = len(keys)
    rng = random.Random(SEED)
    means = []
    for _ in range(N_BOOT):
        vals: list[float] = []
        for _ in range(n):
            vals.extend(by_pair[keys[rng.randrange(n)]])
        means.append(fmean(vals))
    means.sort()
    return round(means[int(0.025 * N_BOOT)], 2), round(means[int(0.975 * N_BOOT)], 2)


def main() -> None:
    trips = _get(f"/trajectories/sample?n={min(100, N_PAIRS * 3)}").get("trips", [])  # el endpoint topa en 100
    ids = sorted(t["id"] for t in trips)
    ids = ids if len(ids) <= N_PAIRS else random.Random(SEED).sample(ids, N_PAIRS)

    pairs: list[tuple[str, list, list]] = []
    for tid in ids:
        try:
            c = _get(f"/trajectories/{tid}/track").get("coords", [])
            if len(c) >= 2:
                pairs.append((tid, c[0], c[-1]))
        except Exception:  # noqa: BLE001
            continue
    print(f"Base {BASE} · pares O-D válidos: {len(pairs)} · horas {HOURS} · semilla {SEED}")

    rows: list[dict] = []
    for lam in LAMBDAS:
        for tid, o, d in pairs:
            for h in HOURS:
                try:
                    j = _post("/route/build", {
                        "origin": o, "dest": d, "type": None, "hour": h, "risk_weight": lam,
                    })
                except Exception:  # noqa: BLE001 — O-D sin ruta factible
                    continue
                comp = j.get("comparison") or {}
                if comp.get("exposure_reduction_pct") is None:
                    continue
                rows.append({
                    "lambda": lam, "trip_id": tid, "hour": h,
                    "exposure_reduction_pct": comp["exposure_reduction_pct"],
                    "safe_dist_m": comp.get("safe_distance_m"),
                    "direct_dist_m": comp.get("direct_distance_m"),
                })
        print(f"  λ={lam}: {sum(1 for r in rows if r['lambda'] == lam)} rutas")

    if not rows:
        print("Sin resultados (¿API caída?)."); return

    out = Path(__file__).resolve().parents[1] / "artifacts" / "eval" / "oe4_lambda_canonico.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

    print("\n===== OE4 · CURVA λ (bootstrap POR CLÚSTER, n_eff = nº de pares) =====")
    print(f"{'λ':>5} {'rutas':>6} {'n_eff':>6} {'media %':>9} {'IC95 clúster':>18} "
          f"{'mediana':>8} {'mejoran':>8} {'+dist':>7}")
    for lam in LAMBDAS:
        rs = [r for r in rows if r["lambda"] == lam]
        if not rs:
            continue
        by_pair: dict[str, list[float]] = {}
        for r in rs:
            by_pair.setdefault(r["trip_id"], []).append(r["exposure_reduction_pct"])
        red = [r["exposure_reduction_pct"] for r in rs]
        lo, hi = cluster_bootstrap(by_pair)
        ex = [100 * (r["safe_dist_m"] - r["direct_dist_m"]) / r["direct_dist_m"]
              for r in rs if r.get("direct_dist_m")]
        print(f"{lam:>5.1f} {len(rs):>6} {len(by_pair):>6} {fmean(red):>9.2f} "
              f"{f'[{lo}, {hi}]':>18} {median(red):>8.2f} "
              f"{100*sum(1 for x in red if x > 0)/len(red):>7.1f}% "
              f"{(fmean(ex) if ex else 0):>6.1f}%")
    print(f"\nCSV: {out}")
    print("λ=5.0 es el MÁXIMO alcanzable (prioridad de seguridad total); "
          "el valor por defecto del producto es λ=0.0.")


if __name__ == "__main__":
    main()
