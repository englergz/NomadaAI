#!/usr/bin/env python3
"""T8 / I5 — CONTRIBUCION frente a CORRELACION, sobre la malla entregada de 475.

El problema que resuelve: la tesis presenta «contribuciones» de densidad (0,32),
periferia (0,36) y policia (0,34) junto a una «correlacion con trafico» de 0,07, como si
las cuatro fueran la misma magnitud. **No lo son**, y ademas el artefacto que produce esas
tres cifras (`tumaco_zonas_riesgo_rtm.csv`) tiene **425 celdas y el modelo antiguo de 3
factores**, no las 475 entregadas con 4.

Son dos preguntas distintas:

  CORRELACION  — ¿la celda con mas de este factor tiende a tener mas riesgo?
                 Es una relacion bivariada. Ignora el peso y a los demas factores.

  CONTRIBUCION — ¿que fraccion de la VARIANZA del indice explica este factor?
                 Descomposicion exacta: Var(I) = suma_i w_i * Cov(f_i, I), de modo que
                 las cuotas suman 1. Depende del peso Y de cuanta variacion propia aporte
                 el factor una vez descontado lo que comparte con los demas.

Un factor puede tener peso alto y correlacion baja si su percentil esta poco alineado con
el indice final — que es exactamente el caso de `actividad`.

LIMITE DECLARADO: el factor `policia` no esta en los artefactos entregados (exige
redescargar OSM). Se despeja algebraicamente del indice como residuo, pero **ese residuo
absorbe tambien cualquier desajuste de reconstruccion**: 47 de 475 valores caen fuera de
[0,1], asi que se reporta como «resto» y NO se afirma que sea el factor policia.

Uso:  python t8_contribuciones.py
Salida: artifacts/eval/t8_contribuciones.csv
"""
from __future__ import annotations

import csv
import math
from pathlib import Path
from statistics import fmean

ROOT = Path(__file__).resolve().parents[3]
RISK = ROOT / "services/api/artifacts/risk/tumaco_zonas_riesgo_v2.csv"
OUT = ROOT / "services/api/artifacts/eval/t8_contribuciones.csv"

PESOS = {"densidad": 0.35, "periferia": 0.30, "actividad": 0.20, "resto": 0.15}


def pct_empates(v: list[float]) -> list[float]:
    o = sorted(range(len(v)), key=lambda i: v[i])
    r = [0.0] * len(v)
    i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        p = ((i + j) / 2 + 1) / len(v)
        for k in range(i, j + 1):
            r[o[k]] = p
        i = j + 1
    return r


def cov(a: list[float], b: list[float]) -> float:
    ma, mb = fmean(a), fmean(b)
    return sum((a[i] - ma) * (b[i] - mb) for i in range(len(a))) / len(a)


def pearson(a: list[float], b: list[float]) -> float:
    va, vb = cov(a, a), cov(b, b)
    return cov(a, b) / math.sqrt(va * vb) if va > 0 and vb > 0 else 0.0


def main() -> None:
    rs = list(csv.DictReader(open(RISK)))
    n = len(rs)
    P = [float(r["poblacion_dane"]) for r in rs]
    A = [float(r["n_points"]) for r in rs]
    I = [float(r["indice"]) for r in rs]
    lon = [float(r["lon"]) for r in rs]
    lat = [float(r["lat"]) for r in rs]

    tot = sum(P) or 1.0
    cx = sum(lon[i] * P[i] for i in range(n)) / tot
    cy = sum(lat[i] * P[i] for i in range(n)) / tot
    per = [math.hypot((lon[i] - cx) * math.cos(math.radians(cy)), lat[i] - cy)
           for i in range(n)]

    nd, npf, na = pct_empates(P), pct_empates(per), pct_empates(A)
    # residuo: lo que falta para reconstruir el indice (incluye policia + desajustes)
    resto = [(I[i] / 100 - 0.35 * nd[i] - 0.30 * npf[i] - 0.20 * na[i]) / 0.15
             for i in range(n)]
    fuera = sum(1 for x in resto if x < -0.02 or x > 1.02)

    F = {"densidad": nd, "periferia": npf, "actividad": na, "resto": resto}
    CRUDO = {"densidad": P, "periferia": per, "actividad": A, "resto": resto}

    varI = cov(I, I)
    filas = []
    for k, f in F.items():
        contrib = PESOS[k] * cov([100 * x for x in f], I) / varI
        filas.append({
            "factor": k,
            "peso": PESOS[k],
            "contribucion_varianza": round(contrib, 4),
            "correlacion_pct_con_indice": round(pearson(f, I), 4),
            "correlacion_crudo_con_indice": round(pearson(CRUDO[k], I), 4),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
        w.writeheader(); w.writerows(filas)

    print(f"T8 / I5 — malla ENTREGADA: {n} celdas · 4 factores\n")
    print(f"{'factor':<12}{'peso':>7}{'CONTRIB. varianza':>20}{'CORR. (percentil)':>20}{'CORR. (crudo)':>16}")
    for r in filas:
        print(f"{r['factor']:<12}{r['peso']:>7.2f}{r['contribucion_varianza']:>20.4f}"
              f"{r['correlacion_pct_con_indice']:>20.4f}{r['correlacion_crudo_con_indice']:>16.4f}")
    print(f"{'SUMA':<12}{sum(PESOS.values()):>7.2f}"
          f"{sum(r['contribucion_varianza'] for r in filas):>20.4f}")
    print(f"\nResiduo fuera de [0,1]: {fuera}/{n} — por eso se llama 'resto' y no 'policia'.")
    print(f"CSV: {OUT}")


if __name__ == "__main__":
    main()
