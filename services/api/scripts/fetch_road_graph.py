#!/usr/bin/env python3
"""Descarga la RED VIAL de una ciudad desde OpenStreetMap y la deja lista para rutear.

Por qué existe: `RouteGraph` construye el grafo a partir de las TRAYECTORIAS del corpus
(sus segmentos son tramos de calle reales). Eso funciona en Tumaco, que tiene 4.032
recorridos SUMO, pero deja sin ruteo a cualquier ciudad sin corpus — hoy, Cali: tiene la
capa de riesgo (4.268 celdas) pero `/route/build` responde «muy lejos de la red».

Este script cubre ese hueco: baja las vías de OSM vía Overpass y las guarda con la misma
estructura que consume el motor de rutas, de modo que abrir una ciudad nueva no exija
recoger trayectorias.

JERARQUÍA POR TIPO DE VÍA. El grafo de trayectorias infiere qué vehículo cabe en cada
tramo a partir de quién pasó por él (`mw` = ancho máximo observado). Desde OSM no hay
observaciones, así que se deriva del `highway=*`: una senda peatonal admite moto pero no
bus; una troncal admite todo. Es el mismo contrato, con otra fuente.

SENTIDOS. Se respeta `oneway`: una vía de sentido único genera una sola arista; las demás,
las dos. `junction=roundabout` implica sentido único aunque no lo declare.

Uso:
    python fetch_road_graph.py --city cali --bbox 3.3032,-76.5923,3.5023,-76.4616
    python fetch_road_graph.py --city cali            # bbox deducido del artefacto de riesgo

Salida: artifacts/risk/<city>_red_vial.json.gz  (nodos + aristas, WGS84)
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ART = Path(__file__).resolve().parents[1] / "artifacts" / "risk"

ESPEJOS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Ancho mínimo de vehículo que admite cada tipo de vía, con el mismo código que el motor
# de rutas: 0 = moto/bici · 1 = automóvil · 2 = bus/camión.
ANCHO = {
    "motorway": 2, "motorway_link": 2, "trunk": 2, "trunk_link": 2,
    "primary": 2, "primary_link": 2, "secondary": 2, "secondary_link": 2,
    "tertiary": 1, "tertiary_link": 1, "unclassified": 1, "residential": 1,
    "living_street": 1, "service": 1, "road": 1,
    "track": 0, "path": 0, "footway": 0, "cycleway": 0, "pedestrian": 0,
}
# Solo se piden las que sirven para circular; se excluyen escaleras y sendas peatonales
# puras, que ensucian el grafo sin aportar rutas reales.
PEDIDAS = ("motorway|trunk|primary|secondary|tertiary|unclassified|residential|"
           "living_street|service|road|track")


def consulta_overpass(bbox: str, intentos: int = 3) -> dict:
    s, w, n, e = bbox.split(",")
    q = f"""
    [out:json][timeout:180];
    way["highway"~"^({PEDIDAS})$"]({s},{w},{n},{e});
    (._;>;);
    out body;
    """
    ultimo = None
    for i in range(intentos):
        for url in ESPEJOS:
            try:
                print(f"  consultando {urllib.parse.urlparse(url).netloc} …")
                req = urllib.request.Request(
                    url, data=urllib.parse.urlencode({"data": q}).encode(),
                    headers={"User-Agent": "NomadaAI/1.0 (tesis MGTIC)"},
                )
                with urllib.request.urlopen(req, timeout=300) as r:
                    return json.load(r)
            except Exception as ex:  # noqa: BLE001
                ultimo = ex
                print(f"    falló: {type(ex).__name__}")
        espera = 10 * (i + 1)
        print(f"  reintentando en {espera}s …")
        time.sleep(espera)
    raise RuntimeError(f"Overpass no respondió tras {intentos} intentos: {ultimo}")


def bbox_desde_riesgo(city: str) -> str:
    f = ART / f"{city}_zonas_riesgo_v2.csv"
    if not f.exists():
        raise SystemExit(f"No existe {f.name}: pasa --bbox a mano.")
    rs = list(csv.DictReader(open(f)))
    lon = [float(r["lon"]) for r in rs]
    lat = [float(r["lat"]) for r in rs]
    # margen de ~1 km para que los bordes de la malla tengan calle a la que engancharse
    m = 0.01
    return f"{min(lat)-m:.4f},{min(lon)-m:.4f},{max(lat)+m:.4f},{max(lon)+m:.4f}"


def main(a) -> None:
    bbox = a.bbox or bbox_desde_riesgo(a.city)
    print(f"Ciudad: {a.city} · bbox {bbox}")
    datos = consulta_overpass(bbox)

    nodos: dict[int, tuple[float, float]] = {}
    for el in datos.get("elements", []):
        if el.get("type") == "node":
            nodos[el["id"]] = (round(el["lon"], 7), round(el["lat"], 7))
    print(f"Nodos OSM: {len(nodos)}")

    aristas: list[dict] = []
    usados: set[int] = set()
    vias = 0
    for el in datos.get("elements", []):
        if el.get("type") != "way":
            continue
        tags = el.get("tags", {})
        hw = tags.get("highway")
        if hw not in ANCHO:
            continue
        ref = [n for n in el.get("nodes", []) if n in nodos]
        if len(ref) < 2:
            continue
        vias += 1
        mw = ANCHO[hw]
        ow = tags.get("oneway", "no")
        unico = ow in ("yes", "true", "1") or tags.get("junction") == "roundabout"
        invertido = ow in ("-1", "reverse")
        for i in range(len(ref) - 1):
            a_, b_ = ref[i], ref[i + 1]
            if invertido:
                a_, b_ = b_, a_
            usados.add(a_); usados.add(b_)
            aristas.append({"a": a_, "b": b_, "mw": mw, "hw": hw})
            if not unico:
                aristas.append({"a": b_, "b": a_, "mw": mw, "hw": hw})

    nodos = {k: v for k, v in nodos.items() if k in usados}
    print(f"Vías: {vias} · nodos con arista: {len(nodos)} · aristas dirigidas: {len(aristas)}")

    # longitud total, para poder comparar contra el grafo de Tumaco
    def m(p, q):
        R = 6371000.0
        p1, p2 = math.radians(p[1]), math.radians(q[1])
        h = (math.sin((p2 - p1) / 2) ** 2
             + math.cos(p1) * math.cos(p2) * math.sin(math.radians(q[0] - p[0]) / 2) ** 2)
        return 2 * R * math.asin(math.sqrt(h))

    largo = sum(m(nodos[e["a"]], nodos[e["b"]]) for e in aristas) / 2
    print(f"Longitud de red: {largo/1000:.1f} km")

    out = ART / f"{a.city}_red_vial.json.gz"
    payload = {
        "city": a.city, "bbox": bbox, "fuente": "OpenStreetMap vía Overpass",
        "descargado": time.strftime("%Y-%m-%d"),
        "n_nodos": len(nodos), "n_aristas": len(aristas), "km": round(largo / 1000, 1),
        "nodos": {str(k): v for k, v in nodos.items()},
        "aristas": aristas,
    }
    with gzip.open(out, "wt", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), sort_keys=True)
    print(f"\nEscrito {out}  ({out.stat().st_size/1_048_576:.1f} MB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--bbox", help="S,W,N,E — si se omite, se deduce del artefacto de riesgo")
    main(ap.parse_args())
