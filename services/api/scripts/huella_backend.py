#!/usr/bin/env python3
"""Huella del backend — guarda de integridad para fusionar corridas hechas en momentos distintos.

Por qué existe: OE4 se mide en varias pasadas contra el mismo Space. La selección de pares
O-D es determinista (semilla 7), pero **la superficie de riesgo no lo es si el Space se
redesplegó entremedio**. Fusionar una pasada medida sobre otra superficie mete un salto
artificial justo en el punto que va a ser la cifra titular de la tesis.

Uso:
    python huella_backend.py                 # imprime y guarda la huella actual
    python huella_backend.py --check FICHERO # compara contra una huella previa

Si las huellas no coinciden, la pasada afectada hay que rehacerla con el resto.
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request

BASE = "https://englergz-nomadaai.hf.space"
CAMPOS = ("n_trajectories", "n_train", "n_test", "n_segments", "n_corridors")


def _get(path: str, timeout: int = 300):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
        return json.load(r)


def huella() -> dict:
    h = _get("/health", timeout=120)
    z = _get("/risk/zones?city=tumaco&hour=20")
    feats = [f for f in z["features"] if f["properties"].get("risk") is not None]
    niveles: dict[str, int] = {}
    for f in feats:
        lv = f["properties"].get("level", "?")
        niveles[lv] = niveles.get(lv, 0) + 1
    fp = {k: h.get(k) for k in CAMPOS}
    fp.update({
        "celdas": len(feats),
        "max_risk": round(max(f["properties"]["risk"] for f in feats), 2),
        "niveles": niveles,
    })
    return fp


def sha(fp: dict) -> str:
    return hashlib.sha256(json.dumps(fp, sort_keys=True).encode()).hexdigest()


def main() -> None:
    fp = huella()
    print(json.dumps(fp, ensure_ascii=False, indent=1))
    print(f"sha256 = {sha(fp)}")

    if "--check" in sys.argv:
        ref = json.load(open(sys.argv[sys.argv.index("--check") + 1]))
        if sha(ref) == sha(fp):
            print("\n✅ COINCIDE con la huella de referencia — la fusión es legítima.")
        else:
            print("\n❌ NO COINCIDE — el Space cambió entre pasadas.")
            for k in set(ref) | set(fp):
                if ref.get(k) != fp.get(k):
                    print(f"   {k}: {ref.get(k)}  →  {fp.get(k)}")
            print("   La pasada afectada debe rehacerse junto con el resto.")
            sys.exit(1)
    else:
        with open("huella_backend.json", "w") as f:
            json.dump(fp, f, sort_keys=True, indent=1)
        print("\nGuardada en huella_backend.json")


if __name__ == "__main__":
    main()
