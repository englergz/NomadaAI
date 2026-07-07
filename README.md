---
title: NómadaAI
emoji: 🗺️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: other
---

<p align="center"><img src="apps/web/public/icon-192.png" alt="Nómada.AI" width="96" /></p>

# NómadaAI

> **Licencia:** [PolyForm Noncommercial 1.0.0](LICENSE) — código visible y de uso
> académico/no comercial; cualquier uso comercial requiere permiso del autor.
> © Engler González · Tesis MGTIC, Universidad de Nariño.

**Aplicación inteligente para la gestión segura de rutas urbanas mediante análisis de datos en
tiempo real en el Distrito de Tumaco, Nariño.** 

Trabajo de Grado, **Maestría en Gestión de Tecnologías de la Información y del Conocimiento (MGTIC)**, Facultad de Ingeniería, Universidad de Nariño. 

**Autor**: Engler González Prado — `englergonzalez@udenar.edu.co`

**Director**: PhD. Andrés Calderón · **Co-director**: PhD. Javier Jiménez

**Ejemplo de uso** / *ver [docs/METODOLOGIA.md](docs/METODOLOGIA.md) | Método, modelos y técnicas; inyección por terminal*
```bash
BASE="https://englergz-nomadaai.hf.space"
curl -s -X POST "$BASE/predict/online" -H 'content-type: application/json' -d '{
  "points":[{"lon":-78.7855,"lat":1.7840,"t":0},{"lon":-78.7854,"lat":1.7841,"t":1},
            {"lon":-78.7852,"lat":1.7843,"t":2},{"lon":-78.7850,"lat":1.7846,"t":3}],
  "type":"car","t_seconds":70200,"speed_mps":8.3,"threshold":0.7
}'
```
Este árbol `app/` es la **aplicación** (backend + frontend) construida sobre la investigación de
`../Research/`. Demo en vivo: **https://englergz-nomadaai.hf.space**

> **Atribución.** La base de simulación de movilidad (red vial de Tumaco y generación de
> trayectorias con SUMO) parte del trabajo del director, PhD. Andrés Oswaldo Calderón Romero:
> https://github.com/aocalderon/Research/tree/master/Scripts/SUMO

## Objetivos específicos

- **OE1** — Caracterizar el desplazamiento y **predecir el destino** (modelo de IA).
- **OE2** — **Modelo de riesgo delictivo por zonas** (espacio-temporal, multivariable).
- **OE3** — **Recomendación de rutas seguras** y **alerta anticipada** (integra OE1+OE2).
- **OE4** — **Evaluar la efectividad** mediante simulaciones (train/test, ajuste de parámetros).

## Documentación

Toda la documentación está en `app/docs/` (citación IEEE).

| Documento | Contenido |
|-----------|-----------|
| [docs/METODOLOGIA.md](docs/METODOLOGIA.md) | Paradigma, 4 objetivos específicos, fases, datos y variables, evaluación, uso por terminal |
| [docs/MODELO_PREDICCION.md](docs/MODELO_PREDICCION.md) | OE1 — predicción de destino: método k-vecinos+rumbo (desviación de RNN declarada), FDE, IC 95%, robustez GPS |
| [docs/MODELO_RIESGO.md](docs/MODELO_RIESGO.md) | OE2 — Índice de Riesgo Urbano (RTM): factores, fórmula, pesos, modulación hora×día, sensibilidad, ética |
| [docs/VALIDACION_RIESGO.md](docs/VALIDACION_RIESGO.md) | OE2 — validación posible sin microdato: análisis de sensibilidad (ρ≈0,99), temporal citado (CEJ/INMLCF) |
| [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md) | Tablero prometido→hecho→cumplido por objetivo/indicador del anteproyecto; vacíos y ruta a 100% |
| [docs/CRITICA_Y_MEJORAS.md](docs/CRITICA_Y_MEJORAS.md) | Autocrítica sin sesgo (grietas científicas y de producto) + política de citación 2–4 fuentes |
| [docs/HALLAZGOS_Y_DESAFIOS.md](docs/HALLAZGOS_Y_DESAFIOS.md) | Hallazgos, desafíos, generalización y evidencia de réplica (Cali) |
| [docs/REFERENCIAS.md](docs/REFERENCIAS.md) | Bibliografía IEEE consolidada (2–4 fuentes verificadas por afirmación) |
| [docs/PLAN_PRODUCTO.md](docs/PLAN_PRODUCTO.md) | Arquitectura de producto, panel admin, guion de sustentación |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, stack, contrato de API, modelo de datos |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Despliegue (Hugging Face Space + Supabase) |

## Estructura

```
app/
  packages/shared/   tipos + cliente API (web y futuro móvil)
  apps/web/          React + Vite + MapLibre GL
  services/api/      FastAPI — OE1 (predicción), OE2 (riesgo), OE3 (ruteo/alerta), OE4 (/evaluate)
  db/                migraciones PostGIS + ETL
  docs/              metodología, modelo de riesgo, arquitectura, despliegue
```

## Arranque rápido (dev)

**1. Backend** (reutiliza artefactos de `../Research`):
```bash
cd services/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # Python 3.11+ recomendado
export MAX_TRAJECTORIES=800             # opcional: menos RAM
uvicorn app.main:app --reload --port 8000
```

**2. Frontend:**
```bash
npm install                            # desde app/ (workspaces)
cp apps/web/.env.example apps/web/.env # VITE_API_URL=http://localhost:8000
npm run dev:web                        # http://localhost:5173
```

## Estado
- ✅ **OE1** predicción de destino — operativo; **90% a ≤50 m (IC 95% [85–94])** sobre conjunto no visto (train/test 80/20). Robustez con ruido GPS gaussiano: **72–82%** (desempeño realista de calle).
- ✅ **OE2** riesgo por lugar×hora×día (RTM) — operativo (`/risk/zones?hour=&day=`); ordenamiento robusto (ρ≈0,99). Es un **índice fundamentado, no un predictor validado** contra microdato (limitación declarada; petición DIJIN en trámite).
- ✅ **OE3** ruteo ponderado por riesgo + alerta anticipada — operativo (`/route/build`, `/predict/online`); panel con ≥3 capas.
- ✅ **OE4** evaluación sin sesgo — reducción de exposición **7,0% (IC 95% [6,4–7,6])**; la ruta segura mejora en 95% de los casos (`/trajectories/evaluate`).
- ✅ **Replicabilidad** — marco de riesgo replicado en **Cali** (adaptabilidad: allí el factor socioeconómico discrimina; en Tumaco es homogéneo).

> **Nota de honestidad.** El objetivo general aprobado es sobre **datos simulados** (SUMO). Los indicadores de precisión se reportan sobre ese entorno; la validación con GPS/delito real y el estudio de percepción con usuarios son trabajo futuro declarado. Ver [docs/CRITICA_Y_MEJORAS.md](docs/CRITICA_Y_MEJORAS.md).
