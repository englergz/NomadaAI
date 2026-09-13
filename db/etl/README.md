# ETL — capas PostGIS (diseño inicial, sin uso en producción)

> **Estado a 2026-09-12.** El backend desplegado **no lee** estas tablas. Corredores, grafo vial y
> riesgo se sirven desde los artefactos embebidos en la imagen (`services/api/artifacts/`). Las tablas
> que sí existen en producción las crea el propio backend en Neon (`docs/ARCHITECTURE.md` §5).
> Esta carpeta se conserva por si hace falta consultar las capas con SQL espacial.

## Cargar corredores en un PostGIS propio

```bash
psql "$DATABASE_URL" -f db/migrations/001_init_postgis.sql
pip install "psycopg[binary]"
DATABASE_URL="postgresql://user:pass@host:5432/db" python db/etl/load_corridors.py
```

Los scripts de muestra de trayectorias, grafo e ingesta de incidentes que planeaba el diseño inicial no
se escribieron: el grafo se construye en memoria (`RouteGraph`) y la malla de riesgo con
`services/api/scripts/rebuild_risk_*.py`.
