#!/usr/bin/env python3
"""OE3 — alerta anticipada en el PUNTO DE OPERACIÓN REAL del sistema desplegado.

Reproduce fielmente `app/data/risk.py::lookahead_alert`, cuyos parámetros son:

    threshold_norm = 0.7      sobre `risk_norm` (percentil 0-1), NO sobre `risk` crudo
    speed_mps      = 8.3      (~30 km/h)
    sin horizonte             recorre la continuación entera hasta la primera zona alta
    hora de llegada           el riesgo se evalúa a la HORA ESTIMADA DE LLEGADA de cada
                              punto (`arrival_hour`), no a una hora fija

Corrige tres errores de `oe3_alerta_malla_entregada.py`, que medía otra cosa:
  1. usaba umbrales en escala CRUDA (40/50/60/70) cuando el sistema umbraliza `risk_norm`;
  2. imponía un `lookahead` de 150/300/500 m que en producción NO existe;
  3. evaluaba a hora fija en vez de a hora de llegada.

Y sobre todo: **no se busca reproducir ninguna cifra heredada.** El punto de operación no
es un parámetro libre que se calibra contra un número viejo. Se corre lo que hace la app y
se reporta lo que salga.

`risk_norm` se reconstruye igual que `risk.py`:
    sp[c] = percentil espacial de la celda (rango de su riesgo máximo entre horas)
    tf[h] = media de riesgo a la hora h / pico
    rn    = sp * (0.5 + 0.5 * tf[h])

Uso:  python oe3_alerta_punto_operacion.py [--start-hours 6,12,18,20,22]
Salida: artifacts/eval/oe3_alerta_punto_operacion.csv
"""
from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[3]
REPO = ROOT.parent
RISK = ROOT / "services/api/artifacts/risk/tumaco_riesgo_horario.csv"
PTS = REPO / "Research/points_3857.parquet"
OUT = ROOT / "services/api/artifacts/eval/oe3_alerta_punto_operacion.csv"
OUT_ALTO = ROOT / "services/api/artifacts/eval/oe3_alerta_nivel_alto.csv"

THRESHOLD_NORM = 0.7      # risk.py:167 — frontera del nivel "medio"/precaución
SPEED_MPS = 8.3           # risk.py:168
CELL_M = 150.0
R_MAX = CELL_M * math.sqrt(2) / 2


def to3857(lon: float, lat: float) -> tuple[float, float]:
    x = lon * 20037508.34 / 180.0
    y = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    return x, y * 20037508.34 / 180.0


def main(a) -> None:
    rz = pd.read_csv(RISK)

    # --- risk_norm, reconstruido como en risk.py -------------------------------
    pico_por_celda = rz.groupby("cell_id")["riesgo_dyn"].max()
    orden = pico_por_celda.sort_values().index.tolist()
    n = len(orden)
    sp = {cid: (i + 1) / n for i, cid in enumerate(orden)}          # percentil espacial
    hmean = rz.groupby("hora")["riesgo_dyn"].mean()
    peak = hmean.max()
    tf = {int(h): float(v / peak) for h, v in hmean.items()}        # factor temporal
    print(f"Malla: {n} celdas · tf pico {max(tf.values()):.4f} valle {min(tf.values()):.4f}")

    cells = rz.drop_duplicates("cell_id")[["cell_id", "lon", "lat"]]
    xy = [to3857(r.lon, r.lat) for r in cells.itertuples()]
    cid = list(cells["cell_id"])
    grid: dict[tuple[int, int], list[int]] = {}
    for i, (x, y) in enumerate(xy):
        grid.setdefault((int(x // CELL_M), int(y // CELL_M)), []).append(i)

    def rn_at(x: float, y: float, hour: int) -> float:
        gx, gy = int(x // CELL_M), int(y // CELL_M)
        best, bd = None, R_MAX
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in grid.get((gx + dx, gy + dy), ()):
                    d = math.hypot(xy[i][0] - x, xy[i][1] - y)
                    if d < bd:
                        best, bd = i, d
        return 0.0 if best is None else sp[cid[best]] * (0.5 + 0.5 * tf[hour % 24])

    P = pq.read_table(PTS, columns=["x", "y", "id", "t"]).to_pandas().sort_values(["id", "t"])
    print(f"Corpus: {P['id'].nunique()} desplazamientos · {len(P)} puntos")

    rows: list[dict] = []
    THR = float(a.threshold)
    for h0 in [int(h) for h in a.start_hours.split(",")]:
        start_s = h0 * 3600.0
        total = con_alerta = 0
        antic: list[float] = []
        for _tid, g in P.groupby("id", sort=False):
            total += 1
            xs = g["x"].to_numpy(); ys = g["y"].to_numpy()
            acc = 0.0
            for k in range(len(xs)):
                if k > 0:
                    acc += math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1])
                arrival_hour = int((start_s + acc / SPEED_MPS) // 3600) % 24
                if rn_at(xs[k], ys[k], arrival_hour) >= THR:
                    con_alerta += 1
                    antic.append(acc)      # distancia a la que se avisa del peligro
                    break
        antic_s = sorted(antic)
        rows.append({
            "threshold_norm": THR,
            "hora_inicio": h0, "n": total, "con_alerta": con_alerta,
            "pct_con_alerta": round(100 * con_alerta / total, 1) if total else 0,
            "antic_media_m": round(sum(antic) / len(antic), 1) if antic else 0,
            "antic_mediana_m": round(antic_s[len(antic_s) // 2], 1) if antic else 0,
            "antic_media_s": round((sum(antic) / len(antic)) / SPEED_MPS, 1) if antic else 0,
            "antic_mediana_s": round(antic_s[len(antic_s) // 2] / SPEED_MPS, 1) if antic else 0,
        })
        r = rows[-1]
        print(f"  inicio {h0:02d}:00 → con alerta {r['pct_con_alerta']:5.1f}% · "
              f"media {r['antic_media_m']:7.1f} m ({r['antic_media_s']:5.1f} s) · "
              f"mediana {r['antic_mediana_m']:7.1f} m ({r['antic_mediana_s']:5.1f} s)")

    dest = OUT if abs(THR - 0.7) < 1e-9 else OUT_ALTO
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(f"\nEscrito {dest}")
    print(f"Punto de operación: threshold_norm={THR} · speed={SPEED_MPS} m/s · sin horizonte")
    print("Sin partición train/test: la alerta es una REGLA sobre recorridos observados, "
          "no un modelo aprendido.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-hours", default="6,12,18,20,22")
    ap.add_argument("--threshold", default="0.7", help="0.7 = precaucion (defecto del sistema) · 0.9 = nivel alto")
    main(ap.parse_args())
