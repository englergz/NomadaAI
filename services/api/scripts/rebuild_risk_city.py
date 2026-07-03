#!/usr/bin/env python3
"""Construye el índice de riesgo para CUALQUIER ciudad (replicable) — sin depender de trayectorias.

A diferencia de `rebuild_risk_full.py` (que usaba la malla de Tumaco/SUMO), aquí la malla se construye
**directamente de las manzanas censales DANE**, de modo que el pipeline sirve para una ciudad nueva
solo con su nombre. Factores (percentil, pesos por CLI):
  densidad poblacional · periferia/aislamiento · lejanía de policía (OSM) · vulnerabilidad socioec. (estrato)
Curvas temporales citadas (CEJ 2019 + INMLCF). Salidas en artifacts/risk/<city>_*.

Uso:  python rebuild_risk_city.py --city cali --mpio CALI --bbox "3.35,-76.58,3.50,-76.46"
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ART = Path(__file__).resolve().parents[1] / "artifacts" / "risk"
SVC = ("https://ags.esri.co/arcgis/rest/services/LivingAtlas/"
       "Censo_personas_manzana_2018/MapServer/0/query")
R = 20037508.34
CELL = 150.0
HDRS = {"User-Agent": "NomadaAI-academic/1.0"}
HOUR_REL = {0: .55, 1: .50, 2: .45, 3: .42, 4: .45, 5: .50, 6: .55, 7: .60, 8: .62, 9: .63,
            10: .65, 11: .67, 12: .70, 13: .72, 14: .74, 15: .76, 16: .80, 17: .88, 18: .95,
            19: 1.0, 20: 1.0, 21: .98, 22: .90, 23: .75}
NIGHT_FLOOR = 0.5


def to3857(lon, lat):
    x = lon * R / 180.0
    y = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0) * R / 180.0
    return x, y


def to4326(x, y):
    return x / R * 180.0, math.atan(math.exp(y / R * math.pi)) * 360.0 / math.pi - 90.0


def pctile(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i]); n = len(xs) or 1; r = [0.0] * len(xs)
    for rank, i in enumerate(order):
        r[i] = (rank + 1) / n
    return r


def pearson(a, b):
    n = len(a); ma = sum(a) / n; mb = sum(b) / n
    num = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    da = sum((a[i] - ma) ** 2 for i in range(n)) ** .5; db = sum((b[i] - mb) ** 2 for i in range(n)) ** .5
    return num / (da * db) if da and db else 0.0


def centroid(geom):
    rings = geom.get("rings") if geom else None
    if not rings:
        return None
    pts = rings[0]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else None


def fetch_manzanas(mpio):
    feats, off = [], 0
    while True:
        p = {"where": f"MPIO='{mpio}'", "outFields": "SEXO_TOTAL,ESTRATO_PREDOMINANTE",
             "returnGeometry": "true", "outSR": "4326", "f": "json",
             "resultOffset": off, "resultRecordCount": 1000}
        d = json.load(urllib.request.urlopen(urllib.request.Request(SVC + "?" + urllib.parse.urlencode(p), headers=HDRS), timeout=180))
        f = d.get("features", []); feats += f
        print(f"  manzanas +{len(f)} (total {len(feats)})")
        if len(f) < 1000:
            break
        off += 1000
    return feats


def fetch_police(bbox):
    ql = f'[out:json][timeout:60];node["amenity"="police"]({bbox});out body;'
    for ep in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(ep + "?" + urllib.parse.urlencode({"data": ql}), headers=HDRS), timeout=90))
            return [to3857(e["lon"], e["lat"]) for e in d.get("elements", []) if "lat" in e]
        except Exception as e:  # noqa: BLE001
            print("  policía falló:", e)
    return []


def main(a):
    print(f"Ciudad: {a.city} (MPIO={a.mpio})")
    feats = fetch_manzanas(a.mpio)
    pob = defaultdict(float); estr = defaultdict(list)
    x0 = y0 = None
    cent = []
    for f in feats:
        at = f.get("attributes", {}); p = at.get("SEXO_TOTAL") or 0
        c = centroid(f.get("geometry"))
        if not c or p <= 0:
            continue
        x, y = to3857(c[0], c[1]); cent.append((x, y, p, at.get("ESTRATO_PREDOMINANTE")))
        x0 = x if x0 is None else min(x0, x); y0 = y if y0 is None else min(y0, y)
    est_dist = Counter(e for (_x, _y, _p, e) in cent)
    print("estrato (manzanas):", dict(sorted(est_dist.items(), key=lambda z: (z[0] is None, z[0]))))
    # agregar a celdas
    for (x, y, p, e) in cent:
        ix = int((x - x0) // CELL); iy = int((y - y0) // CELL)
        pob[(ix, iy)] += p
        if e:
            estr[(ix, iy)].append((e, p))
    cells = sorted(pob)
    print(f"Celdas urbanas: {len(cells)}  ·  población: {int(sum(pob.values()))}")

    cxy = [(x0 + (ix + 0.5) * CELL, y0 + (iy + 0.5) * CELL) for (ix, iy) in cells]
    P = [pob[c] for c in cells]
    # vulnerabilidad socioeconómica por celda = (6 - estrato_medio_ponderado)/5  (estrato 1 = 1.0)
    def vuln(c):
        es = estr.get(c)
        if not es:
            return 0.6
        w = sum(p for (_e, p) in es) or 1
        m = sum(e * p for (e, p) in es) / w
        return max(0.0, (6 - m) / 5)
    V = [vuln(c) for c in cells]
    tot = sum(P) or 1
    ccx = sum(cxy[i][0] * P[i] for i in range(len(cells))) / tot
    ccy = sum(cxy[i][1] * P[i] for i in range(len(cells))) / tot
    periph = [((cxy[i][0] - ccx) ** 2 + (cxy[i][1] - ccy) ** 2) ** .5 for i in range(len(cells))]
    police = fetch_police(a.bbox)
    print(f"Estaciones de policía (OSM): {len(police)}")
    nopol = [min(((cxy[i][0] - px) ** 2 + (cxy[i][1] - py) ** 2) ** .5 for (px, py) in police) if police else 0.0
             for i in range(len(cells))]

    nd, nv, npf, npo = pctile(P), pctile(V), pctile(periph), pctile(nopol)
    idx = [round(100 * (a.w_dens * nd[i] + a.w_socio * nv[i] + a.w_periph * npf[i] + a.w_police * npo[i]), 2)
           for i in range(len(cells))]
    print(f"corr(índice): densidad={pearson(idx, P):.3f} vulnerab={pearson(idx, V):.3f} "
          f"periferia={pearson(idx, periph):.3f} policía={pearson(idx, nopol):.3f}")
    order = sorted(range(len(idx)), key=lambda i: idx[i]); lvl = [""] * len(idx)
    for rank, i in enumerate(order):
        q = rank / len(order); lvl[i] = "alto" if q >= .85 else ("medio" if q >= .5 else "bajo")
    print("niveles:", dict(Counter(lvl)))

    tfac = {h: NIGHT_FLOOR + (1 - NIGHT_FLOOR) * HOUR_REL[h] for h in range(24)}
    hz = ART / f"{a.city}_riesgo_horario.csv"
    with open(hz, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["cell_id", "lon", "lat", "hora", "riesgo_dyn"])
        for i, (ix, iy) in enumerate(cells):
            lon, lat = to4326(*cxy[i])
            for h in range(24):
                w.writerow([ix * 100000 + iy, round(lon, 6), round(lat, 6), h, round(idx[i] * tfac[h], 2)])
    with open(ART / f"{a.city}_zonas_riesgo_v2.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["cell_id", "lon", "lat", "poblacion_dane", "vulnerabilidad", "indice", "nivel"])
        for i, (ix, iy) in enumerate(cells):
            lon, lat = to4326(*cxy[i]); w.writerow([ix * 100000 + iy, round(lon, 6), round(lat, 6), int(P[i]), round(V[i], 2), idx[i], lvl[i]])
    print(f"Escrito {hz.name} ({len(cells)} celdas × 24h) + {a.city}_zonas_riesgo_v2.csv")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--mpio", required=True, help="valor exacto del campo MPIO (DANE)")
    ap.add_argument("--bbox", required=True, help="S,W,N,E para OSM policía")
    ap.add_argument("--w-dens", type=float, default=0.30)
    ap.add_argument("--w-socio", type=float, default=0.30)
    ap.add_argument("--w-periph", type=float, default=0.25)
    ap.add_argument("--w-police", type=float, default=0.15)
    main(ap.parse_args())
