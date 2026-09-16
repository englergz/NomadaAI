# Nómada.AI — Arquitectura del software

> **Estado a 2026-09-16.** Describe lo que está en `main`, verificado contra el código. Lo que aún no
> está desplegado en producción se señala.
> Tesis MGTIC · Universidad de Nariño · Engler González.
> Fundamentación de métodos en [METODOLOGIA.md](METODOLOGIA.md) y [MODELO_RIESGO.md](MODELO_RIESGO.md);
> cifras en [RECOMPUTO_2026-08.md](RECOMPUTO_2026-08.md).

## 1. Objetivos y dónde viven

| Obj. | Qué hace | Código |
|------|----------|--------|
| OE1 | Predice el destino de un recorrido parcial | `services/api/app/ml/destination.py` · `/predict/*` · `/trajectories/*` |
| OE2 | Índice de riesgo por zona, hora y día, configurable por ciudad | `services/api/scripts/rebuild_risk_*.py` (offline) · `RiskStore` · `/risk/*` |
| OE3 | Ruta segura vs directa y alerta anticipada | `RouteGraph` (networkx) · `/route/*` · hooks de viaje en la app |
| OE4 | Evaluación de efectividad | `/trajectories/evaluate` · `/evaluate/*` · `services/api/scripts/oe*.py` |

## 2. Decisiones de arquitectura

1. **Un solo servicio para API y escritorio.** Un contenedor Docker en Hugging Face Spaces sirve la
   API FastAPI y el `dist/` estático de la web. Sin servidores aparte.
2. **Artefactos embebidos en la imagen.** Trayectorias, corredores, mallas de riesgo, configuraciones
   por ciudad, red vial de Cali y POIs viven en `services/api/artifacts/` y se copian a `/research`. Los
   pesados se generan offline y se versionan con `sha256` (`scripts/GOLDEN.md`). El disco del Space es
   efímero: nada que importe se escribe en caliente.
3. **Predicción sin GPU.** Recuperación por vecinos (numpy + scikit-learn, KDTree + rumbo). Cabe en la
   CPU gratuita del Space.
4. **Ruteo en el backend, sin pgRouting.** Dijkstra de `networkx` con `peso = distancia · (1 + λ·riesgo)`.
   Tumaco usa el grafo derivado de su corpus de trayectorias; Cali, la red vial de OpenStreetMap
   (`fetch_road_graph.py` → `cali_red_vial.json.gz`). Los grafos se construyen al arrancar.
5. **Postgres solo para lo que escriben los usuarios.** Neon (Postgres gratuito, se reactiva solo al
   conectarse). Las tablas se crean en el primer uso. Sin `DATABASE_URL` la API funciona y esas
   funciones degradan: el histórico queda en el dispositivo y el catálogo de ciudades vacío.
6. **Identidad con Clerk, autorización en el servidor.** El backend verifica el JWT contra el JWKS de
   `CLERK_ISSUER` con PyJWT. El rol admin sale de `ADMIN_USER_IDS`; el cliente nunca decide.
7. **Monorepo con código compartido.** `packages/shared` tiene tipos, cliente de API, paletas de
   riesgo, protección, textos de ayuda y legales, base cartográfica y escape de HTML. Web y app lo
   consumen; lo común no se duplica.
8. **MapLibre en todas partes.** MapLibre GL JS 4.7.1 en escritorio y en la versión web de la app;
   MapLibre React Native 11.3.6 en Android e iOS. Base vectorial de OpenFreeMap (Positron y Dark, datos
   de OpenStreetMap, sin clave) y satélite de Esri, definidas en `packages/shared/src/basemap.ts`.
9. **«Tiempo real» honesto.** No existen feeds abiertos de delito en vivo para Tumaco. Se modela con
   riesgo por franja horaria, reportes ciudadanos y la posición del usuario.
10. **La app funciona con mala señal.** Lecturas con copia local (red primero, 3 MB, aviso de
    antigüedad) y escrituras en una cola cifrada que se vacía al volver la conexión.

## 3. Componentes

```
┌────────────────────────────┐   ┌──────────────────────────────────────┐
│ apps/web (escritorio/tesis) │   │ apps/mobile (Expo SDK 57, RN)         │
│ React + Vite + MapLibre GL  │   │ Android · iOS · web                   │
│ simulador, BI, panel admin  │   │ viaje, alertas, reporte, sin conexión │
└──────────────┬─────────────┘   └───────────────┬──────────────────────┘
               │     @nomadaai/shared (tipos, cliente, basemap)     │
               └────────────────────┬──────────────────────────────┘
                                    │ HTTPS · JSON / GeoJSON
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ services/api — FastAPI (Python 3.11) en Hugging Face Space (Docker)    │
│  lifespan: predictor · corredores · RiskStore por ciudad · grafos      │
│  routers: health predict trajectories corridors risk route pois        │
│           evaluation history feedback privacy admin circles            │
│  core: config · auth (Clerk JWT) · ratelimit (ventana por IP)          │
└───────────┬───────────────────────────────────┬──────────────────────┘
            │ lee al arrancar                    │ psycopg
            ▼                                    ▼
┌────────────────────────────┐   ┌──────────────────────────────────────┐
│ /research (artefactos)      │   │ Neon Postgres                          │
│ parquet, geojson, CSV de    │   │ sim_effectiveness · incidents ·        │
│ riesgo, risk_config.*.json, │   │ feedback · app_config · city_catalog · │
│ red vial, POIs              │   │ circles y sus tablas                   │
└────────────────────────────┘   └──────────────────────────────────────┘

Servicios externos: Clerk (identidad) · OpenFreeMap / Esri (teselas) ·
Nominatim (búsqueda de direcciones) · EAS Update (OTA de la app, canal production)
```

## 4. Contrato de API

Base de producción: `https://englergz-nomadaai.hf.space`. OpenAPI en `/docs`.
El contrato se mantiene en dos sitios sincronizados: `services/api/app/models/schemas.py` (Pydantic) y
`packages/shared/src/types.ts` (TypeScript).

| Método | Ruta | Uso | Auth |
|--------|------|-----|------|
| GET | `/health` | estado, conteos y qué está listo: `auth_ready`, `admin_ready`, `history_identity`, `data_deletion`, `circles_ready` | — |
| POST | `/predict/destination` | candidatos de destino (OE1) | — |
| POST | `/predict/online` | predicción en marcha con alerta anticipada | — |
| GET | `/trajectories/sample` · `/{tid}/track` · `/{tid}/demo` · `/similar` | trayectorias para el simulador | — |
| GET | `/trajectories/evaluate` | evaluación OE1/OE4 (`n`, `noise_m`) | — |
| GET | `/corridors` | corredores TRACLUS | — |
| GET | `/risk/cities` · `/risk/zones` | ciudades con capa de riesgo; malla por `city`, `hour`, `day`, `bbox`. Una ciudad sin malla responde 404 con la lista de las que sí tienen | — |
| POST | `/incidents/report` | reporte ciudadano (rate-limit); se atribuye a quien prueba su identidad. Coordenadas fuera de rango o textos vacíos o demasiado largos responden 422 antes de tocar la base | token o llave (`X-Device-Key`), opcionales |
| GET | `/incidents/aggregate` | reportes agregados | — |
| GET | `/route/cities` | ciudades que rutean | — |
| POST | `/route/build` | ruta segura vs directa con exposición comparada | — |
| POST | `/route/safe` | variante simple de ruta segura | — |
| GET | `/pois` | lugares de interés | — |
| GET | `/evaluate/alerts` · `/evaluate/scenarios` | barridos de alerta | — |
| POST · GET · GET · DELETE · POST | `/history/trip` · `/history/summary` · `/history/stats` · `/history` · `/history/claim` | histórico por usuario y BI; `summary?scope=global` da los agregados de todos | lo propio exige token o llave del dispositivo (`X-Device-Key`): sin prueba, 401 al leer y al borrar. Nunca se acepta `user_id` (`DEPLOY.md` §6) |
| POST | `/feedback` | opinión antes de borrar datos; se atribuye a quien prueba su identidad | token o llave, opcionales |
| DELETE | `/me/data` | «Borrar mis datos»: borra histórico y reportes propios, desvincula las opiniones y sale de los círculos | token o llave; sin prueba, 401 (`DEPLOY.md` §6) |
| POST · GET · DELETE · GET · PUT · POST | `/circles` · `/circles/join` · `/circles/{id}/me` · `/circles/{id}/members` · `/circles/{id}/prefs` · `/circles/{id}/events` (y `/close`, `/positions`, `/trail`) | Círculos de cuidado: grupos donde la posición se comparte solo mientras hay un evento abierto (`DISENO_FUTURO.md` §2). Backend en `main`; la pantalla de la app está en construcción | cuenta (token); la llave del dispositivo no basta: 403 |
| GET | `/config/app` | niveles de protección, `ads_enabled` | — |
| GET | `/cities/catalog` | ciudades que la app puede encontrar | — |
| GET | `/admin/me` | ¿el token es admin? | admin |
| PUT | `/admin/config/app` | editar configuración de la app | admin |
| GET · DELETE | `/admin/reports` · `/admin/reports/{id}` | moderar reportes; el autor llega como seudónimo | admin |
| GET | `/admin/summary` · `/admin/feedback` | KPIs y opiniones | admin |
| GET | `/admin/cities` | por ciudad: riesgo, red vial, predicción y factores con motivo | admin |
| POST · DELETE | `/admin/cities/catalog` · `/admin/cities/catalog/{key}` | alta y baja en el catálogo | admin |

Las escrituras y el cómputo pesado tienen rate-limit por IP (429 con `Retry-After`).

## 5. Modelo de datos

**Artefactos (solo lectura, en la imagen):**
`data/trajectories_xy.parquet` · `traclus_segments_wgs84.geojson.gz` · `neighbors_frechet_mot.csv` ·
`risk/<ciudad>_riesgo_horario.csv` (Tumaco 475 celdas, Cali 4.268) · `risk/risk_config.<ciudad>.json` ·
`risk/cali_red_vial.json.gz` · `pois/tumaco_pois.geojson` · `eval/*.csv` (evidencia de cada cifra).

**Postgres (Neon), creadas por el backend en el primer uso:**

| Tabla | Módulo | Contenido |
|---|---|---|
| `sim_effectiveness` | `data/history.py` | un registro por viaje: predicción y protección comparadas, `mode`, `source`, `city` |
| `incidents` | `data/incidents.py` | reportes ciudadanos |
| `feedback` | `data/feedback.py` | cuatro respuestas y comentario |
| `app_config` | `data/appconfig.py` | configuración editable desde el panel |
| `city_catalog` | `data/citycatalog.py` | ciudades visibles en el selector (no dan cobertura) |
| `circles`, `circle_members`, `circle_prefs`, `circle_events`, `circle_positions` | `data/circles.py` | círculos de cuidado; las posiciones solo viven mientras dura un evento y se borran al cerrarlo |

`db/migrations/001_init_postgis.sql` es el esquema PostGIS del primer diseño (corredores, grafo y
riesgo en base de datos). **El backend actual no lo usa**: esas capas se sirven desde artefactos.
`002_sim_effectiveness.sql` documenta la tabla del histórico.

**En el dispositivo:** histórico, recorrido en curso y cola de escrituras cifrados con AES-256-GCM y la
clave en Keystore/Keychain; copia local de lecturas en AsyncStorage.

## 6. Abrir una ciudad

Tres ingredientes independientes (detalle en [DISENO_FUTURO.md](DISENO_FUTURO.md) §1):

1. **Capa de riesgo**: `rebuild_risk_city.py` (DANE + OSM) → CSV horario + `risk_config`.
2. **Red vial**: `fetch_road_graph.py` (OSM).
3. **Predicción**: exige trayectorias reales de la ciudad.

Se commitean los artefactos y se hace `git push space main`. El panel admin solo añade la ciudad al
catálogo; ingesta y entrenamiento no caben en el Space.

## 7. Despliegue

| Componente | Servicio | Notas |
|---|---|---|
| API + escritorio | Hugging Face Space `englergz/nomadaai` (Docker, CPU gratuita) | `git push space main:main` |
| Base de datos | Neon Postgres (gratuito) | secret `DATABASE_URL` |
| Identidad | Clerk | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER`, `ADMIN_USER_IDS` |
| App móvil | APK local (gradle) · EAS Update canal `production` | `runtimeVersion` por huella; ver `COMANDOS.md` §5–§7 |
| Código | GitHub `englergz/nomadaai` | `git push origin main` |

Pasos y variables en [DEPLOY.md](DEPLOY.md).

## 8. Potencial de producto

La navegación consciente del riesgo tiene mercado en seguros, logística de última milla, turismo y
seguridad ciudadana. El diferencial frente a Google o Waze es la capa de riesgo local combinada con la
predicción de destino. El margen de reducción medido en Tumaco (−4,84 %) es modesto y lo limita la red
vial; el valor de producto hoy está más en la alerta y el reporte que en el desvío.
