from __future__ import annotations

import csv
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Query

from app import state
from app.core.config import get_settings
from app.ml.destination import DestinationPredictor
from app.state import get_predictor

# Semilla del muestreo de evaluación: fija para que las cifras sean reproducibles.
_EVAL_SEED = 7


def _hav_m(a, b) -> float:
    """Distancia en metros entre [lon, lat]."""
    import math
    R = 6371000.0
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    h = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))


def _bearing_deg(a, b) -> float:
    import math
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0] - a[0])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _error_angular(d: dict) -> float | None:
    """Error de rumbo con el HORIZONTE EMPAREJADO (misma definición que
    Research/analysis_v2/eval_fair_horizon.py:69).

    Compara, desde el último punto observado, el rumbo hacia el extremo PREDICHO contra
    el rumbo hacia el punto REAL a la MISMA longitud de arco. Emparejar el arco es
    imprescindible: la predicción está truncada al horizonte (~195 m) mientras que la
    continuación real es mucho más larga (razón de arcos mediana 0,21), así que comparar
    los extremos mediría rumbos hacia puntos a distancias distintas — no el acierto de
    rumbo. Ese error hundía la cifra de 90 % a 65 %.
    """
    pre, tru, cand = d.get("prefix"), d.get("truth"), d.get("candidates")
    if not pre or not tru or not cand:
        return None
    coords = (cand[0] or {}).get("coordinates") or []
    if len(coords) < 2 or len(tru) < 2:
        return None
    aqui = pre[-1]
    arco_pred = sum(_hav_m(coords[i - 1], coords[i]) for i in range(1, len(coords)))
    acc = 0.0
    ref = tru[-1]
    for k in range(1, len(tru)):
        acc += _hav_m(tru[k - 1], tru[k])
        if acc >= arco_pred:
            ref = tru[k]
            break
    dif = abs(_bearing_deg(aqui, coords[-1]) - _bearing_deg(aqui, ref)) % 360
    return min(dif, 360 - dif)


router = APIRouter(prefix="/trajectories", tags=["trajectories"])


@router.get("/sample")
def sample(
    n: int = Query(24, ge=1, le=100),
    predictor: DestinationPredictor = Depends(get_predictor),
) -> dict:
    """Lista de viajes reales para elegir en la demostración."""
    return {"trips": predictor.list_ids(n=n)}


_eval_cache: dict[int, dict] = {}


@router.get("/evaluate")
def evaluate(
    n: int = Query(160, ge=5, le=2000),
    noise_m: float = Query(0.0, ge=0, le=100, description="Ruido GPS σ (m) para prueba de robustez"),
    predictor: DestinationPredictor = Depends(get_predictor),
) -> dict:
    """Efectividad de la predicción de destino sobre el conjunto TEST (no visto).

    Para cada viaje de prueba reproduce la división 75/25, predice excluyendo la propia
    trayectoria (analogía solo con TRAIN) y mide el error final (FDE) contra el recorrido
    real a igual horizonte. Reporta acierto a ≤50 m y ≤100 m, global y por tipo.
    `noise_m` perturba el prefijo (GPS realista) para medir la robustez.
    """
    import statistics

    ckey = (n, round(noise_m, 1))
    if ckey in _eval_cache:
        return _eval_cache[ckey]

    # MUESTREO ALEATORIO CON SEMILLA FIJA.
    # Antes: `sorted(test_ids)[:n]` — truncamiento ALFABÉTICO, no muestreo. Como los
    # ids son bus*/car*/mot*/tru*, los primeros N nunca alcanzaban las motocicletas:
    # con n=200 devolvía 45 buses y 155 carros, CERO motos, siendo que ~69 % del test
    # son motos (el vehículo característico de Tumaco). Sesgaba toda la evaluación.
    import random as _random
    _all = sorted(predictor.test_ids)          # orden estable para reproducibilidad
    if n >= len(_all):
        test_ids = _all
    else:
        test_ids = _random.Random(_EVAL_SEED).sample(_all, n)
    fdes: list[float] = []
    base_fdes: list[float] = []
    markov_fdes: list[float] = []
    by_type: dict[str, list[float]] = {}
    angs: list[float] = []
    angs_by_type: dict[str, list[float]] = {}
    for tid in test_ids:
        d = predictor.get_demo(tid, noise_m=noise_m)
        if not d or d.get("fde_m") is None:
            continue
        fde = float(d["fde_m"])
        fdes.append(fde)
        by_type.setdefault(d["type"], []).append(fde)
        if d.get("baseline_fde_m") is not None:
            base_fdes.append(float(d["baseline_fde_m"]))
        if d.get("markov_fde_m") is not None:
            markov_fdes.append(float(d["markov_fde_m"]))
        _a = _error_angular(d)
        if _a is not None:
            angs.append(_a)
            angs_by_type.setdefault(d["type"], []).append(_a)

    def summarize(vals: list[float]) -> dict:
        if not vals:
            return {"n": 0}
        vals_sorted = sorted(vals)
        p90 = vals_sorted[min(len(vals_sorted) - 1, int(0.9 * len(vals_sorted)))]
        return {
            "n": len(vals),
            "fde_median_m": round(statistics.median(vals), 2),
            "fde_mean_m": round(statistics.fmean(vals), 2),
            "fde_p90_m": round(p90, 2),
            "acc_50m_pct": round(100 * sum(v <= 50 for v in vals) / len(vals), 1),
            "acc_100m_pct": round(100 * sum(v <= 100 for v in vals) / len(vals), 1),
        }

    overall = summarize(fdes)
    baseline = summarize(base_fdes)
    markov = summarize(markov_fdes)

    # Intervalos de confianza al 95% por bootstrap (1000 remuestreos) — rigor estadístico.
    import random

    def _boot_ci(vals: list[float], stat, iters: int = 1000, seed: int = 42):
        if len(vals) < 5:
            return None
        rng = random.Random(seed)
        nn = len(vals)
        out = sorted(stat([vals[rng.randrange(nn)] for _ in range(nn)]) for _ in range(iters))
        return [round(out[int(0.025 * iters)], 1), round(out[int(0.975 * iters)], 1)]

    _acc50 = lambda v: 100 * sum(x <= 50 for x in v) / len(v)  # noqa: E731
    _acc30 = lambda v: 100 * sum(x <= 30 for x in v) / len(v)   # noqa: E731
    ci95 = {
        "acc_50m_pct": _boot_ci(fdes, _acc50),
        "fde_median_m": _boot_ci(fdes, statistics.median),
        "acc_ang30_pct": _boot_ci(angs, _acc30),
        "ang_med_deg": _boot_ci(angs, statistics.median),
    }

    def _ang_stats(v: list[float]) -> dict:
        if not v:
            return {"n": 0}
        return {"n": len(v),
                "ang_med_deg": round(statistics.median(v), 2),
                "acc_ang30_pct": round(_acc30(v), 1)}

    def _mejora(ref: dict) -> float | None:
        if overall.get("acc_50m_pct") is not None and ref.get("acc_50m_pct") is not None:
            return round(overall["acc_50m_pct"] - ref["acc_50m_pct"], 1)
        return None

    result = {
        "n_train": predictor.n_train,
        "n_test": predictor.n_test,
        "evaluated": len(fdes),
        "overall": overall,
        "ci95": ci95,                    # intervalos de confianza 95% (bootstrap)
        "baseline": baseline,            # extrapolación en línea recta (referencia ingenua)
        "markov": markov,                # cadena de Markov 1er orden (referencia que aprende)
        "mejora_vs_baseline_pp": _mejora(baseline),
        "mejora_vs_markov_pp": _mejora(markov),
        "by_type": {t: summarize(v) for t, v in sorted(by_type.items())},
        "angular": _ang_stats(angs),
        "angular_by_type": {t: _ang_stats(v) for t, v in sorted(angs_by_type.items())},
        "note": "FDE = error final vs recorrido real al horizonte de continuación (no visto). "
                "baseline = línea recta; markov = transición más probable aprendida (TRAIN).",
    }
    result["noise_m"] = noise_m
    result["seed"] = _EVAL_SEED
    result["n_solicitado"] = n
    result["n_test_total"] = len(predictor.test_ids)
    _eval_cache[ckey] = result
    return result


@router.get("/{tid}/track")
def track(
    tid: str,
    predictor: DestinationPredictor = Depends(get_predictor),
) -> dict:
    """Recorrido completo (lon/lat) de un viaje real, para reproducir como GPS en vivo."""
    from app.ml.destination import infer_type

    coords = predictor.get_track(tid)
    if coords is None:
        raise HTTPException(status_code=404, detail=f"Viaje '{tid}' no encontrado")
    return {"id": tid, "type": infer_type(tid), "coords": coords, "n": len(coords)}


@router.get("/{tid}/demo")
def demo(
    tid: str,
    topk: int = Query(3, ge=1, le=10),
    hour: int = Query(19, ge=0, le=23, description="Hora del día para el riesgo"),
    day: int | None = Query(None, ge=0, le=6, description="Día de la semana (0=lun … 6=dom)"),
    predictor: DestinationPredictor = Depends(get_predictor),
) -> dict:
    """Prefijo observado (75%) + predicción + recorrido real + alerta anticipada de riesgo."""
    d = predictor.get_demo(tid, topk=topk)
    if d is None:
        raise HTTPException(status_code=404, detail=f"Viaje '{tid}' no encontrado")
    # Alerta anticipada (OE3): mira la ruta predicha y avisa de la primera zona
    # de riesgo alto ANTES de alcanzarla, evaluada a la hora y día indicados.
    d["hour"] = hour
    d["alert"] = None
    if state.risk is not None and d.get("candidates"):
        d["alert"] = state.risk.lookahead_alert(
            d["candidates"][0]["coordinates"], start_seconds=hour * 3600, day=day
        )
    return d


@lru_cache
def _load_neighbors() -> dict[str, list[dict]]:
    """Carga vecinos Fréchet precomputados (OE1). Cobertura parcial de ids."""
    s = get_settings()
    path = s.research_path / s.neighbors_csv
    out: dict[str, list[dict]] = {}
    if not path.exists():
        return out
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            q = row.get("query_id")
            if not q:
                continue
            out.setdefault(q, []).append(
                {
                    "neighbor_id": row.get("neighbor_id"),
                    "type": row.get("neighbor_type"),
                    "dfrechet": float(row["dfrechet"]) if row.get("dfrechet") else None,
                }
            )
    return out


@router.get("/similar")
def similar(id: str = Query(..., description="id de la trayectoria consulta")) -> dict:
    """Trayectorias más parecidas (Fréchet) a la consulta (OE1)."""
    neigh = _load_neighbors().get(id, [])
    return {"query_id": id, "neighbors": neigh}
