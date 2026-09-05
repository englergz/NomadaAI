"""Estado compartido del backend: artefactos cargados una sola vez al iniciar.

Los routers acceden a estos objetos vía dependencias (get_predictor, get_corridors).
Se rellenan en el lifespan de app/main.py.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from app.data.corridors import CorridorStore
from app.data.risk import RiskStore
from app.ml.destination import DestinationPredictor
from app.ml.router import RouteGraph

predictor: DestinationPredictor | None = None
corridors: CorridorStore | None = None
risk: RiskStore | None = None
risk_cities: dict[str, RiskStore] = {}  # mapa de riesgo por ciudad (tumaco, cali, …)


def get_predictor() -> DestinationPredictor:
    if predictor is None:
        raise HTTPException(status_code=503, detail="Predictor no disponible")
    return predictor


def get_corridors() -> CorridorStore:
    if corridors is None:
        raise HTTPException(status_code=503, detail="Corredores no disponibles")
    return corridors


def get_risk() -> RiskStore:
    if risk is None:
        raise HTTPException(status_code=503, detail="Capa de riesgo no disponible")
    return risk


# Grafo de rutas por ciudad. Tumaco lo deriva de su corpus de trayectorias; las demás,
# de la red vial de OSM descargada con scripts/fetch_road_graph.py.
route_graphs: dict[str, RouteGraph] = {}

DEFAULT_CITY = "tumaco"


def _red_vial_dir() -> Path:
    """Carpeta donde viven los artefactos de riesgo, incluida la red vial.

    NO se deriva de `__file__`: en el contenedor `services/api/artifacts` se copia a
    `/research`, no junto al código, así que una ruta relativa al fuente existe en local
    y no en producción — que es exactamente lo que hizo que Cali no ruteara tras el
    primer despliegue. Se usa `research_path`, que respeta `RESEARCH_DIR`, igual que el
    resto de la carga de artefactos.
    """
    from app.core.config import get_settings
    base = get_settings().research_path
    # Ruta relativa al fuente: es la buena en desarrollo, donde `artifacts/` está junto
    # al código y `research_path` apunta a la carpeta de ANÁLISIS, que es otra cosa.
    local = Path(__file__).resolve().parents[1] / "artifacts" / "risk"
    for cand in (base / "risk", local, base / "analysis_v2", base):
        if cand.is_dir() and any(cand.glob("*_red_vial.json.gz")):
            return cand
    return local if local.is_dir() else base


def get_route_graph() -> RouteGraph:
    """Grafo de la ciudad por defecto. Se mantiene para los llamadores antiguos."""
    return get_route_graph_for(DEFAULT_CITY)


def get_route_graph_for(city: str | None) -> RouteGraph:
    """Grafo de rutas de `city`, construido la primera vez que se pide (perezoso).

    Dos orígenes posibles, por orden de preferencia:
      1. el corpus de TRAYECTORIAS, si la ciudad lo tiene — sus segmentos son tramos de
         calle realmente recorridos, e infieren qué vehículo cabe en cada uno;
      2. la RED VIAL de OSM (`<city>_red_vial.json.gz`), para ciudades sin corpus.
    """
    global route_graphs
    c = (city or DEFAULT_CITY).lower()
    if c in route_graphs:
        return route_graphs[c]

    if c == DEFAULT_CITY:
        if predictor is None:
            raise HTTPException(status_code=503, detail="Predictor no disponible")
        route_graphs[c] = RouteGraph(predictor.true_dict)
        return route_graphs[c]

    red = _red_vial_dir() / f"{c}_red_vial.json.gz"
    if not red.exists():
        raise HTTPException(
            status_code=422,
            detail=(f"«{c}» todavía no tiene red vial cargada: se puede ver el mapa de "
                    f"riesgo y hacer recorrido libre, pero no trazar rutas seguras."),
        )
    route_graphs[c] = RouteGraph.from_osm(red)
    return route_graphs[c]


def route_cities() -> list[str]:
    """Ciudades que pueden trazar ruta hoy (corpus propio o red vial descargada)."""
    out = {DEFAULT_CITY} if predictor is not None else set()
    out |= {f.name.replace("_red_vial.json.gz", "") for f in _red_vial_dir().glob("*_red_vial.json.gz")}
    return sorted(out)
