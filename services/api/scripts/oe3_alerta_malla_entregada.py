#!/usr/bin/env python3
"""OE3 — motor de alerta anticipada evaluado sobre la MALLA ENTREGADA (475 celdas, 150 m).

Por qué existe: `Research/analysis_v2/eval_anticipatory_alert.py` produce las cifras de
alerta publicadas (88,7 % · 94,0 % · 280,3 m) leyendo `analysis_v2/tumaco_riesgo_horario.csv`,
que es la malla **de 425 celdas a 250 m** de la etapa de desarrollo, con la curva horaria
×1,79. La tesis documenta la zonificación como **475 celdas a 150 m** y declara amplitud
efectiva ×1,17. Son superficies distintas.

Los dos artefactos ni siquiera comparten esquema de `cell_id`:
    425 → `ix*100000 + iy`  (p. ej. 1500063)
    475 → secuencial        (p. ej. 53)
por lo que `rz.get(cell_of(x,y))` devolvería 0,0 en TODA la malla entregada.

Este script no reimplementa la aritmética de celdas: la malla entregada trae `lon`/`lat`
por celda, así que **resuelve el riesgo por proximidad espacial** (celda más cercana dentro
de media diagonal). Eso lo hace independiente del esquema de ids.

Uso:  python oe3_alerta_malla_entregada.py [--hours 6,12,18,20,22] [--thr 60,80,100]
                                           [--lookahead 150,300,500]
Salida: artifacts/eval/oe3_alerta_malla475.csv
"""
from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[3]           # .../NomadaAI/app
REPO = ROOT.parent                                    # .../NomadaAI
RISK = ROOT / "services/api/artifacts/risk/tumaco_riesgo_horario.csv"
PTS = REPO / "Research/points_3857.parquet"
OUT = ROOT / "services/api/artifacts/eval/oe3_alerta_malla475.csv"

CELL_M = 150.0                                        # malla entregada
R_MAX = CELL_M * math.sqrt(2) / 2                     # media diagonal


def to3857(lon: float, lat: float) -> tuple[float, float]:
    x = lon * 20037508.34 / 180.0
    y = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    return x, y * 20037508.34 / 180.0


def main(a) -> None:
    hours = [int(h) for h in a.hours.split(",")]
    thrs = [float(t) for t in a.thr.split(",")]
    looks = [float(l) for l in a.lookahead.split(",")]

    rz = pd.read_csv(RISK)
    # centros de celda en 3857, una sola vez
    cells = rz.drop_duplicates("cell_id")[["cell_id", "lon", "lat"]]
    xy = [to3857(r.lon, r.lat) for r in cells.itertuples()]
    cid = list(cells["cell_id"])
    print(f"Malla entregada: {len(cid)} celdas · {RISK.name}")

    # índice de rejilla para búsqueda O(1) de la celda más cercana
    grid: dict[tuple[int, int], list[int]] = {}
    for i, (x, y) in enumerate(xy):
        grid.setdefault((int(x // CELL_M), int(y // CELL_M)), []).append(i)

    def nearest(x: float, y: float) -> int | None:
        gx, gy = int(x // CELL_M), int(y // CELL_M)
        best, bd = None, R_MAX
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in grid.get((gx + dx, gy + dy), ()):
                    d = math.hypot(xy[i][0] - x, xy[i][1] - y)
                    if d < bd:
                        best, bd = i, d
        return best

    P = pq.read_table(PTS, columns=["x", "y", "id", "t"]).to_pandas().sort_values(["id", "t"])
    print(f"Corpus: {P['id'].nunique()} desplazamientos · {len(P)} puntos")

    rows: list[dict] = []
    for h in hours:
        risk_h = rz[rz["hora"] == h].set_index("cell_id")["riesgo_dyn"].to_dict()
        for thr in thrs:
            for look in looks:
                n = con_riesgo = anticipadas = 0
                antic: list[float] = []
                for _tid, g in P.groupby("id", sort=False):
                    n += 1
                    xs = g["x"].to_numpy(); ys = g["y"].to_numpy()
                    # distancia acumulada a lo largo del camino
                    acc = [0.0]
                    for k in range(1, len(xs)):
                        acc.append(acc[-1] + math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1]))
                    # primer punto que entra en zona de riesgo alto
                    entra = None
                    for k in range(len(xs)):
                        i = nearest(xs[k], ys[k])
                        if i is not None and risk_h.get(cid[i], 0.0) >= thr:
                            entra = k
                            break
                    if entra is None:
                        continue
                    con_riesgo += 1
                    # ¿el look-ahead lo habría visto antes de llegar?
                    d_entrada = acc[entra]
                    aviso = None
                    for k in range(entra + 1):
                        if d_entrada - acc[k] <= look:
                            aviso = k
                            break
                    if aviso is not None and aviso < entra:
                        anticipadas += 1
                        antic.append(min(look, d_entrada - acc[aviso]))
                rows.append({
                    "hora": h, "umbral": thr, "lookahead_m": look, "n": n,
                    "con_riesgo": con_riesgo,
                    "pct_con_riesgo": round(100 * con_riesgo / n, 1) if n else 0,
                    "anticipadas": anticipadas,
                    "pct_anticipadas": round(100 * anticipadas / con_riesgo, 1) if con_riesgo else 0,
                    "antic_media_m": round(sum(antic) / len(antic), 1) if antic else 0,
                    "antic_mediana_m": round(sorted(antic)[len(antic) // 2], 1) if antic else 0,
                })
                r = rows[-1]
                print(f"  h={h:02d} thr={thr:.0f} look={look:.0f} → "
                      f"riesgo {r['pct_con_riesgo']:5.1f}% · antic {r['pct_anticipadas']:5.1f}% · "
                      f"media {r['antic_media_m']:6.1f} m")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(f"\nEscrito {OUT}")
    print("NOTA: sin partición train/test — la alerta es una REGLA evaluada sobre los "
          "recorridos observados, no un modelo aprendido. Por eso usa el corpus completo.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", default="6,12,18,20,22")
    ap.add_argument("--thr", default="60,80,100")
    ap.add_argument("--lookahead", default="150,300,500")
    main(ap.parse_args())
