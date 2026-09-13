# Nómada.AI — API (FastAPI)

Backend de los cuatro objetivos: predicción de destino (OE1), riesgo por zona y hora (OE2), ruta
segura y alerta (OE3) y evaluación (OE4), además del histórico, reportes, opiniones y panel admin.
Contrato completo en [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) §4.

## Correr en local

```bash
cd services/api
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export RESEARCH_DIR=$PWD/artifacts     # mismo layout que el contenedor
export PYTHONHASHSEED=0                # evaluación reproducible
export MAX_TRAJECTORIES=800            # opcional: menos RAM
uvicorn app.main:app --reload --port 8000
```

> Sin `RESEARCH_DIR` apuntando a `artifacts/` el arranque no encuentra la malla entregada ni la red
> de Cali, y las cifras de exposición salen distintas. No es una regresión: es el layout.

Variables opcionales: `DATABASE_URL` (Neon), `CLERK_ISSUER`, `ADMIN_USER_IDS`. Sin ellas la API
arranca y las funciones que dependen de cada una degradan (ver `docs/DEPLOY.md` §3).

Docs interactivas: http://localhost:8000/docs

## Scripts

`scripts/` regenera cada cifra publicada y cada artefacto: `rebuild_risk_*.py` (mallas),
`fetch_road_graph.py` (red vial OSM), `oe*.py` y `t*.py` (evaluaciones),
`c5_humo_route_build.py` (16 invariantes de `/route/build`). Hashes en `scripts/GOLDEN.md`.

## Ejemplo

```bash
curl -s -X POST http://localhost:8000/predict/destination \
  -H 'content-type: application/json' \
  -d '{"points":[{"lon":-78.7855,"lat":1.7840,"t":0},
                 {"lon":-78.7854,"lat":1.7840,"t":1},
                 {"lon":-78.7853,"lat":1.7839,"t":2}],"type":"bus","topk":3}'
```
