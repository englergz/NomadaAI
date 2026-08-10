#!/usr/bin/env python3
"""T6b-B — ¿el factor socioeconómico REORDENA el mapa de riesgo? Tumaco vs Cali.

Ejecuta el diseño fijado en `docs/T6B_CRITERIO.md` ANTES de ver ningún número.
No reinterpretar el resultado: la tabla de veredictos está en ese documento.

DISEÑO
  · Misma configuración de factores en AMBAS ciudades (guarda nº 3 del criterio):
    densidad · periferia · socioeconómico. Se omite `policía` porque exige redescargar
    OSM y no está en los artefactos entregados; omitirlo en las dos mantiene la
    comparación válida, que es lo que importa.
  · Tumaco: las 301 celdas con dato socioeconómico (63,4 % de la malla de 475).
    NO se regenera la malla: redescargar DANE/OSM no reproduciría las 475 y el
    resultado no sería comparable con nada. La cobertura se declara.
  · Cali: las 4.268 celdas entregadas, que ya traen `vulnerabilidad`.
  · ρ de Spearman entre el ranking CON el factor y el ranking SIN él (pesos
    renormalizados). ρ BAJO = reordena = DISCRIMINA. ρ ALTO = desplazamiento
    cuasi-constante = INERTE.
  · EMPATES: rangos promediados, siempre. Desempatar por orden de lista ya invalidó
    una pasada anterior (36,6 % de celdas con poblacion=0 fabricaban varianza).
  · PISO DE RUIDO obligatorio: se repite sustituyendo el factor por una variable
    aleatoria con la MISMA distribución y estructura de empates, 200 repeticiones.
    Sin el piso, ρ no es interpretable.

Uso:  python t6b_socioeconomico.py
Salida: artifacts/eval/t6b_socioeconomico.csv
"""
from __future__ import annotations

import csv
import math
import random
from pathlib import Path
from statistics import fmean

ROOT = Path(__file__).resolve().parents[3]
REPO = ROOT.parent
RISK = ROOT / "services/api/artifacts/risk"
SOCIO_TUMACO = REPO / "Research/analysis_v2/data_sources/socio_por_zona.csv"
OUT = ROOT / "services/api/artifacts/eval/t6b_socioeconomico.csv"

PESOS = {"densidad": 0.35, "periferia": 0.30, "socioeconomico": 0.30}
N_RUIDO = 200
SEED = 7


def rank_promediado(v: list[float]) -> list[float]:
    """Rangos con EMPATES PROMEDIADOS. Valores iguales reciben el mismo rango."""
    o = sorted(range(len(v)), key=lambda i: v[i])
    r = [0.0] * len(v)
    i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
            j += 1
        medio = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[o[k]] = medio
        i = j + 1
    return r


def pct_empates(v: list[float]) -> list[float]:
    r = rank_promediado(v)
    return [x / len(v) for x in r]


def spearman(a: list[float], b: list[float]) -> float:
    x, y = rank_promediado(a), rank_promediado(b)
    n = len(x)
    mx, my = fmean(x), fmean(y)
    num = sum((x[i] - mx) * (y[i] - my) for i in range(n))
    den = math.sqrt(sum((v - mx) ** 2 for v in x) * sum((v - my) ** 2 for v in y))
    return num / den if den else float("nan")


def indice(factores: dict[str, list[float]], n: int) -> list[float]:
    """Índice con los factores dados, pesos renormalizados sobre los activos."""
    total = sum(PESOS[k] for k in factores)
    return [sum(PESOS[k] * factores[k][i] for k in factores) / total for i in range(n)]


def periferia(lon: list[float], lat: list[float], pob: list[float]) -> list[float]:
    tot = sum(pob) or 1.0
    cx = sum(lon[i] * pob[i] for i in range(len(lon))) / tot
    cy = sum(lat[i] * pob[i] for i in range(len(lat))) / tot
    return [math.hypot((lon[i] - cx) * math.cos(math.radians(cy)), lat[i] - cy)
            for i in range(len(lon))]


def carga_tumaco():
    soc = {r["cell_id"]: float(r["vuln"])
           for r in csv.DictReader(open(SOCIO_TUMACO))}
    rs = [r for r in csv.DictReader(open(RISK / "tumaco_zonas_riesgo_v2.csv"))
          if r["cell_id"] in soc]
    pob = [float(r["poblacion_dane"]) for r in rs]
    lon = [float(r["lon"]) for r in rs]
    lat = [float(r["lat"]) for r in rs]
    return {
        "densidad": pct_empates(pob),
        "periferia": pct_empates(periferia(lon, lat, pob)),
        "socioeconomico": pct_empates([soc[r["cell_id"]] for r in rs]),
    }, [soc[r["cell_id"]] for r in rs], len(rs)


def carga_cali():
    rs = list(csv.DictReader(open(RISK / "cali_zonas_riesgo_v2.csv")))
    pob = [float(r["poblacion_dane"]) for r in rs]
    lon = [float(r["lon"]) for r in rs]
    lat = [float(r["lat"]) for r in rs]
    vul = [float(r["vulnerabilidad"]) for r in rs]
    return {
        "densidad": pct_empates(pob),
        "periferia": pct_empates(periferia(lon, lat, pob)),
        "socioeconomico": pct_empates(vul),
    }, vul, len(rs)


def analiza(nombre: str, F: dict[str, list[float]], crudo: list[float], n: int) -> dict:
    con = indice(F, n)
    sin_f = {k: v for k, v in F.items() if k != "socioeconomico"}
    sin = indice(sin_f, n)
    rho = spearman(con, sin)

    # --- PISO DE RUIDO: mismo vector, orden aleatorio (misma distribución y empates) ---
    rng = random.Random(SEED)
    rhos = []
    for _ in range(N_RUIDO):
        falso = crudo[:]
        rng.shuffle(falso)
        Fr = dict(sin_f)
        Fr["socioeconomico"] = pct_empates(falso)
        rhos.append(spearman(indice(Fr, n), sin))
    rhos.sort()
    lo, hi = rhos[int(0.025 * N_RUIDO)], rhos[int(0.975 * N_RUIDO)]

    from collections import Counter
    c = Counter(crudo)
    moda, cm = c.most_common(1)[0]
    desv = (sum((x - fmean(crudo)) ** 2 for x in crudo) / len(crudo)) ** 0.5

    veredicto = ("INERTE (>=0,95)" if rho >= 0.95 else
                 "EFECTO DEBIL (0,80-0,95)" if rho >= 0.80 else
                 "DISCRIMINA (<0,80)")
    distingue = "SI" if rho < lo else ("NO — dentro del ruido" if rho <= hi else "SI (por encima)")

    print(f"\n===== {nombre.upper()} (n={n}) =====")
    print(f"  Varianza del factor: {len(c)} valores distintos · moda {moda} "
          f"({100*cm/len(crudo):.1f} %) · desviacion {desv:.4f}")
    print(f"  rho(CON socio, SIN socio) = {rho:.4f}   -> {veredicto}")
    print(f"  PISO DE RUIDO             = {fmean(rhos):.4f}   IC95 [{lo:.4f}, {hi:.4f}]")
    print(f"  ¿se distingue del azar?   = {distingue}")
    return {"ciudad": nombre, "n": n, "rho": round(rho, 4),
            "ruido_medio": round(fmean(rhos), 4), "ruido_lo": round(lo, 4),
            "ruido_hi": round(hi, 4), "veredicto": veredicto,
            "distingue_del_azar": distingue, "valores_distintos": len(c),
            "pct_moda": round(100 * cm / len(crudo), 1), "desviacion": round(desv, 4)}


def main() -> None:
    print("T6b-B · ¿el factor socioeconomico REORDENA el mapa?")
    print(f"Configuracion IDENTICA en ambas ciudades: {PESOS}")
    print("(se omite `policia` en las dos: exige redescargar OSM y no esta en los artefactos)")

    Ft, ct, nt = carga_tumaco()
    Fc, cc, nc = carga_cali()
    filas = [analiza("tumaco", Ft, ct, nt), analiza("cali", Fc, cc, nc)]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
        w.writeheader(); w.writerows(filas)
    print(f"\nCSV: {OUT}")
    print("\nCOBERTURA DECLARADA: Tumaco usa las 301 celdas con dato socioeconomico "
          "(63,4 % de la malla de 475). Cali usa las 4.268 entregadas.")
    print("LIMITE: el indice aqui calculado NO es el desplegado. T6b responde una pregunta "
          "metodologica sobre el territorio, no describe el producto.")
    print("\nEl veredicto se lee en docs/T6B_CRITERIO.md. NO reinterpretar.")


if __name__ == "__main__":
    main()
