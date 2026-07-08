#!/usr/bin/env python3
"""Reconstruye el índice de riesgo (OE2) como FRAMEWORK CONFIGURABLE de factores.

El registro de factores y sus pesos viven en `risk_config.<city>.json` (MODELO_RIESGO.md §3–§4):
cada factor se declara { enabled, weight, temporal_profile }; los pesos se RE-NORMALIZAN a Σ=1
sobre los factores ACTIVOS y con dato; un factor disabled (o sin dato, que se reporta) aporta 0.

Modulación temporal POR FACTOR (§7 — resuelve "tiempo = intensidad, no lugar"): cada factor
puede llevar su propio perfil horario (flat = curva CEJ global; night_up = sube de noche, para
periferia/iluminación; nightlife = franja nocturna de los POIs). Con perfiles distintos el
RANKING ESPACIAL cambia con la hora sin necesidad de microdato.

Compatibilidad (golden test, scripts/GOLDEN.md): con la configuración equivalente (4 factores
activos 0.35/0.30/0.20/0.15, todos 'flat', night_floor 0.5) la salida reproduce EXACTAMENTE los
artefactos que respaldan las cifras de la tesis. La trazabilidad (hash de config + fecha) va en
un sidecar `*_meta.json`, no en el CSV, para no alterar el formato.

Salidas (con respaldo .bak): tumaco_riesgo_horario.csv, tumaco_zonas_riesgo_v2.csv, *_meta.json
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import shutil
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ART = Path(__file__).resolve().parents[1] / "artifacts" / "risk"
RTM = ART / "tumaco_zonas_riesgo_rtm.csv"
HOURLY = ART / "tumaco_riesgo_horario.csv"
CONFIG_DEFAULT = ART / "risk_config.tumaco.json"
SVC = ("https://ags.esri.co/arcgis/rest/services/LivingAtlas/"
       "Censo_personas_manzana_2018/MapServer/0/query")
R = 20037508.34
CELL = 150.0
MARGIN = 6  # celdas de margen alrededor del área con trayectorias (evita traer zona rural lejana)

# Curva horaria con respaldo citable: CEJ "Reloj de la Criminalidad" (2019) + INMLCF —
# homicidios concentrados 18:00–23:59 (pico ~20:00–22:00). Curva relativa 0–1.
HOUR_REL = {0: .55, 1: .50, 2: .45, 3: .42, 4: .45, 5: .50, 6: .55, 7: .60, 8: .62, 9: .63,
            10: .65, 11: .67, 12: .70, 13: .72, 14: .74, 15: .76, 16: .80, 17: .88, 18: .95,
            19: 1.0, 20: 1.0, 21: .98, 22: .90, 23: .75}


def temporal_profiles(night_floor: float) -> dict:
    """Perfiles horarios por factor (§7). 'flat' es la curva global legacy (CEJ + piso)."""
    flat = {h: night_floor + (1 - night_floor) * HOUR_REL[h] for h in range(24)}
    # night_up: espejo de la curva de actividad diurna — de noche/madrugada el factor pesa MÁS
    # (menos vigilancia natural: periferia/aislamiento, iluminación). Normalizado a máx=1.
    inv = {h: 1.0 - 0.5 * HOUR_REL[h] for h in range(24)}
    mx = max(inv.values())
    night_up = {h: night_floor + (1 - night_floor) * (inv[h] / mx) for h in range(24)}
    # nightlife: franja de generadores nocturnos (bares/licor): 19:00–02:00 alta, día baja.
    nl_rel = {h: (1.0 if h >= 20 or h <= 1 else 0.85 if h in (18, 19, 2) else 0.25) for h in range(24)}
    nightlife = {h: night_floor + (1 - night_floor) * nl_rel[h] for h in range(24)}
    return {"flat": flat, "night_up": night_up, "nightlife": nightlife}


def to3857(lon, lat):
    x = lon * R / 180.0
    y = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0) * R / 180.0
    return x, y


def to4326(x, y):
    lon = x / R * 180.0
    lat = math.atan(math.exp(y / R * 180.0 * (math.pi / 180.0))) * 360.0 / math.pi - 90.0
    return lon, lat


def pctile(xs):
    """Cada valor → su percentil [0,1]: los PESOS (no la varianza) gobiernan la influencia."""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    n = len(xs) or 1
    for rank, i in enumerate(order):
        r[i] = (rank + 1) / n
    return r


def pearson(a, b):
    n = len(a); ma = sum(a) / n; mb = sum(b) / n
    num = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    da = sum((a[i] - ma) ** 2 for i in range(n)) ** 0.5
    db = sum((b[i] - mb) ** 2 for i in range(n)) ** 0.5
    return num / (da * db) if da and db else 0.0


def centroid(geom):
    rings = geom.get("rings") if geom else None
    if not rings:
        return None
    pts = rings[0]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if not pts:
        return None
    n = len(pts)
    return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n)


def fetch_police():
    pf = ART / "tumaco_police.json"
    if pf.exists():
        pts = json.loads(pf.read_text(encoding="utf-8"))
        return [to3857(p["lon"], p["lat"]) for p in pts]
    ql = '[out:json][timeout:60];node["amenity"="police"](1.75,-78.83,1.86,-78.70);out body;'
    for ep in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        try:
            req = urllib.request.Request(ep + "?" + urllib.parse.urlencode({"data": ql}),
                                         headers={"User-Agent": "NomadaAI-academic/1.0"})
            els = json.load(urllib.request.urlopen(req, timeout=90)).get("elements", [])
            return [to3857(e["lon"], e["lat"]) for e in els if "lat" in e]
        except Exception as e:  # noqa: BLE001
            print("  policía falló:", e)
    return []


def fetch_manzanas():
    feats, off = [], 0
    while True:
        params = {"where": "MPIO LIKE '%TUMACO%'", "outFields": "SEXO_TOTAL",
                  "returnGeometry": "true", "outSR": "4326", "f": "json",
                  "resultOffset": off, "resultRecordCount": 1000}
        req = urllib.request.Request(SVC + "?" + urllib.parse.urlencode(params),
                                     headers={"User-Agent": "NomadaAI/1.0"})
        d = json.load(urllib.request.urlopen(req, timeout=180))
        f = d.get("features", []); feats += f
        if len(f) < 1000:
            break
        off += 1000
    return feats


def main(cfg_path: Path):
    cfg_text = cfg_path.read_text(encoding="utf-8")
    cfg = json.loads(cfg_text)
    night_floor = float(cfg.get("night_floor", 0.5))
    profiles = temporal_profiles(night_floor)

    zonas = list(csv.DictReader(open(RTM)))
    z0 = zonas[0]
    x0 = float(z0["x_center"]) - (int(z0["ix"]) + 0.5) * CELL
    y0 = float(z0["y_center"]) - (int(z0["iy"]) + 0.5) * CELL

    act = {}
    ixs, iys = [], []
    for z in zonas:
        ix, iy = int(z["ix"]), int(z["iy"])
        act[(ix, iy)] = float(z["n_points"])
        ixs.append(ix); iys.append(iy)
    ix_min, ix_max = min(ixs) - MARGIN, max(ixs) + MARGIN
    iy_min, iy_max = min(iys) - MARGIN, max(iys) + MARGIN

    print("Descargando manzanas DANE…")
    feats = fetch_manzanas()
    pob = defaultdict(float)
    for f in feats:
        p = f.get("attributes", {}).get("SEXO_TOTAL") or 0
        c = centroid(f.get("geometry"))
        if not c or p <= 0:
            continue
        x, y = to3857(c[0], c[1])
        ix = int((x - x0) // CELL); iy = int((y - y0) // CELL)
        if ix_min <= ix <= ix_max and iy_min <= iy <= iy_max:
            pob[(ix, iy)] += p

    cells = sorted(set(act) | set(pob))
    print(f"Celdas: {len(zonas)} (solo tráfico) → {len(cells)} (tráfico ∪ población)")

    P = [pob.get(c, 0.0) for c in cells]
    A = [act.get(c, 0.0) for c in cells]
    cxy = [(x0 + (ix + 0.5) * CELL, y0 + (iy + 0.5) * CELL) for (ix, iy) in cells]
    tot_p = sum(P) or 1.0
    cx = sum(cxy[i][0] * P[i] for i in range(len(cells))) / tot_p
    cy = sum(cxy[i][1] * P[i] for i in range(len(cells))) / tot_p
    periph = [((cxy[i][0] - cx) ** 2 + (cxy[i][1] - cy) ** 2) ** 0.5 for i in range(len(cells))]
    police = fetch_police()
    print(f"Estaciones de policía (OSM): {len(police)}")
    nopol = ([min(((cxy[i][0] - px) ** 2 + (cxy[i][1] - py) ** 2) ** 0.5 for (px, py) in police)
              for i in range(len(cells))] if police else None)

    # ── REGISTRO DE FACTORES: nombre → valores crudos (None = sin dato → se omite y reporta) ──
    raw = {
        "densidad": P,
        "periferia": periph,
        "actividad": A,
        "policia": nopol,
        "socioeconomico": None,     # se activa con DANE manzana/estratos (§3.2)
        "pois_riesgo": None,        # se activa con Overpass del tipo correcto (§3.2 / R2)
        "iluminacion": None,        # se activa con OSM lit=* o VIIRS (§3.2 / R2)
        # F_report(z,t) (§6 / R3): exportar GET /incidents/aggregate a tumaco_reportes.json
        # para activar este factor; sin archivo (o sin volumen) queda None → OFF reportado.
        "delito_reportado": None,
    }
    rep_file = ART / "tumaco_reportes.json"
    if rep_file.exists():
        rep = json.loads(rep_file.read_text(encoding="utf-8")).get("cells", [])
        if len(rep) >= 10:  # volumen mínimo para una superficie con sentido
            acc = [0.0] * len(cells)
            for r in rep:
                x, y = to3857(r["lon"], r["lat"])
                ix = int((x - x0) // CELL); iy = int((y - y0) // CELL)
                try:
                    acc[cells.index((ix, iy))] += float(r["peso"])
                except ValueError:
                    pass  # reporte fuera de la malla urbana
            raw["delito_reportado"] = acc
            print(f"F_report: {len(rep)} celdas con reportes agregadas al factor delito_reportado")
        else:
            print(f"F_report: solo {len(rep)} celdas con reportes (<10): factor sigue sin dato")

    active, skipped = [], []
    for name, fc in cfg["factors"].items():
        if not fc.get("enabled"):
            continue
        if raw.get(name) is None:
            skipped.append(name)
            continue
        active.append((name, float(fc["weight"]), fc.get("temporal_profile", "flat")))
    if skipped:
        print(f"AVISO: factores habilitados SIN dato (omitidos, aporte 0): {skipped}")
    if not active:
        raise SystemExit("Ningún factor activo con dato: revisa la configuración.")

    s = sum(w for _, w, _ in active) or 1.0
    active = [(n, w / s, pr) for n, w, pr in active]  # Σ=1 sobre los ACTIVOS con dato
    npct = {n: pctile(raw[n]) for n, _, _ in active}
    idx = [round(100 * sum(w * npct[n][i] for n, w, _ in active), 2) for i in range(len(cells))]

    order = sorted(range(len(idx)), key=lambda i: idx[i])
    lvl = [""] * len(idx)
    for rank, i in enumerate(order):
        q = rank / len(order)
        lvl[i] = "alto" if q >= 0.85 else ("medio" if q >= 0.50 else "bajo")

    print("pesos activos:", {n: round(w, 4) for n, w, _ in active})
    print("corr(índice):", {n: round(pearson(idx, raw[n]), 3) for n, _, _ in active})
    print(f"niveles: {dict(Counter(lvl))}")

    def cell_lonlat(ix, iy):
        return to4326(x0 + (ix + 0.5) * CELL, y0 + (iy + 0.5) * CELL)

    uniform = len({pr for _, _, pr in active}) == 1 and active[0][2] == "flat"
    shutil.copyfile(HOURLY, HOURLY.with_suffix(".csv.bak"))
    with open(HOURLY, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["cell_id", "lon", "lat", "hora", "riesgo_dyn"])
        flat = profiles["flat"]
        for i, (ix, iy) in enumerate(cells):
            lon, lat = cell_lonlat(ix, iy)
            cid = ix * 100000 + iy
            for h in range(24):
                if uniform:
                    # Camino legacy EXACTO (golden test): índice redondeado × curva global.
                    v = round(idx[i] * flat[h], 2)
                else:
                    # Modulación POR FACTOR (§7): el ranking espacial cambia con la hora.
                    v = round(100 * sum(w2 * profiles[pr][h] * npct[n][i] for n, w2, pr in active), 2)
                w.writerow([cid, round(lon, 6), round(lat, 6), h, v])

    with open(ART / "tumaco_zonas_riesgo_v2.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["cell_id", "lon", "lat", "poblacion_dane", "n_points", "indice", "nivel"])
        for i, (ix, iy) in enumerate(cells):
            lon, lat = cell_lonlat(ix, iy)
            w.writerow([ix * 100000 + iy, round(lon, 6), round(lat, 6), int(P[i]), int(A[i]), idx[i], lvl[i]])

    # Trazabilidad (sidecar, no altera el formato de los CSV): config exacta + hash + fecha.
    meta = {
        "config_file": cfg_path.name,
        "config_sha256": hashlib.sha256(cfg_text.encode()).hexdigest(),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "factores_activos": {n: round(w, 4) for n, w, _ in active},
        "perfiles": {n: pr for n, _, pr in active},
        "omitidos_sin_dato": skipped,
        "celdas": len(cells),
    }
    (ART / "tumaco_riesgo_meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nEscrito {HOURLY.name} ({len(cells)} celdas × 24h) + tumaco_zonas_riesgo_v2.csv + meta")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Reconstruye el índice de riesgo desde risk_config.<city>.json")
    ap.add_argument("--config", type=Path, default=CONFIG_DEFAULT, help="ruta del risk_config.*.json")
    main(ap.parse_args().config)
