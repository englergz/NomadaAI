---
title: Nómada.AI
emoji: 🗺️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: other
license_name: PolyForm Noncommercial 1.0.0
license_link: LICENSE
---

<p align="center">
  <img src="apps/web/public/icon-192.png" alt="Nómada.AI" width="140" /><br/><br/>
  <strong>Nómada.AI</strong><br/>
  <em>Rutas urbanas más seguras a partir de datos, donde el dato escasea.</em>
</p>

<p align="center">
  <a href="https://englergz-nomadaai.hf.space"><strong>▶ Demo en vivo</strong></a> ·
  <a href="docs/METODOLOGIA.md">Metodología</a> ·
  <a href="docs/MODELO_PREDICCION.md">Modelo de predicción</a> ·
  <a href="docs/MODELO_RIESGO.md">Modelo de riesgo</a> ·
  <a href="docs/ARCHITECTURE.md">Arquitectura</a>
</p>

---

## Qué es

**Nómada.AI** ayuda a las personas a desplazarse por la ciudad con **menor exposición al riesgo**:
predice a dónde se dirige un trayecto, estima el **riesgo por zona, hora y día**, y recomienda una
**ruta más segura** con **alerta anticipada** antes de entrar a una zona de mayor riesgo.

Nace como **Trabajo de Grado** de la **Maestría en Gestión de Tecnologías de la Información y del
Conocimiento (MGTIC)**, Facultad de Ingeniería, **Universidad de Nariño**, con **Tumaco** como caso de
estudio: una ciudad con alta necesidad de seguridad y **escasez de datos** — el contexto donde este
enfoque aporta más. Su valor no es un modelo atado a Tumaco, sino un **marco replicable y configurable**
para cualquier ciudad.

> **Autor:** Engler González Prado · `englergonzalez@udenar.edu.co`
>
> **Director:** PhD. Manuel Ernesto Bolaños Gonzáles

<p align="center">
  <img src="docs/img/tumaco_riesgo_rtm.png" alt="Superficie de riesgo de Tumaco (RTM)" width="360" />
</p>

<p align="center">
  <img src="docs/img/riesgo_config_comparativa.png" alt="Comparativa: configuración anterior (2 factores) vs. actual (4 factores RTM)" width="640" /><br/>
  <em>El framework configurable en acción: dos configuraciones de factores, dos superficies de riesgo (rótulos con los factores activos de cada una).</em>
</p>

## Resultados clave

| Objetivo | Resultado |
|---|---|
| **OE1 · Predicción de destino** | **90 % de acierto a ≤50 m** (IC 95 % [85–94]) sobre conjunto no visto; **72–82 %** bajo ruido GPS realista. |
| **OE2 · Riesgo por zona×hora×día** | Índice RTM **multivariable, configurable y auditable**; ordenamiento espacial **robusto (ρ≈0,99)**. |
| **OE3 · Ruta segura + alerta** | Ruteo ponderado por riesgo + **alerta anticipada** (≈88,7 % de avisos antes de entrar a la zona). |
| **OE4 · Efectividad** | **−7,0 % de exposición** (IC 95 % [6,4–7,6]); la ruta segura mejora en el **95 %** de los casos. |
| **Replicabilidad** | Marco de riesgo replicado en **Cali** (allí el factor socioeconómico discrimina; en Tumaco es homogéneo). |

> **Nota de honestidad.** El alcance aprobado es sobre **datos simulados** (SUMO); las cifras se
> reportan en ese entorno. El IRU es un **índice fundamentado, no un predictor validado** contra
> microdato georreferenciado. La validación con GPS/delito real y el estudio de percepción con usuarios
> son el paso siguiente — y se resuelven con el **bucle de reporte ciudadano** de la app, no solo con la
> DIJIN. Detalle en [docs/CRITICA_Y_MEJORAS.md](docs/CRITICA_Y_MEJORAS.md).

## Cómo funciona

1. **Predicción de destino (OE1)** — recuperación de trayectorias por vecinos más cercanos + rumbo
   (KDTree), sin GPU. Ver [docs/MODELO_PREDICCION.md](docs/MODELO_PREDICCION.md).
2. **Índice de Riesgo Urbano (OE2)** — adaptación de **Risk Terrain Modeling**: un **framework
   configurable** de factores del entorno (cada uno habilitable y ponderable **por contexto**). En
   Tumaco están activos **densidad (0,35) · periferia (0,30) · actividad (0,20) · lejanía de policía
   (0,15)**; socioeconómico, POIs e iluminación están **definidos pero deshabilitados** (homogeneidad /
   sin dato) — decisión documentada. Ver [docs/MODELO_RIESGO.md](docs/MODELO_RIESGO.md).
3. **Ruta segura + alerta (OE3)** — grafo vial ponderado `peso = distancia·(1 + λ·riesgo)` (Dijkstra
   sobre `networkx`); política **evitar cuando hay alternativa, avisar cuando el tramo es inevitable**;
   alertas graduadas por conducta.
4. **Evaluación (OE4)** — train/test 80/20 reproducible, IC 95 % por bootstrap, barrido de escenarios.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/METODOLOGIA.md](docs/METODOLOGIA.md) | Paradigma, 4 objetivos, fases, datos y variables, evaluación |
| [docs/MODELO_PREDICCION.md](docs/MODELO_PREDICCION.md) | OE1 — predicción de destino (k-vecinos+rumbo, FDE, IC 95 %, robustez GPS) |
| [docs/MODELO_RIESGO.md](docs/MODELO_RIESGO.md) | OE2 — IRU como **framework configurable**: factores, pesos, factores OFF en Tumaco y por qué |
| [docs/VALIDACION_RIESGO.md](docs/VALIDACION_RIESGO.md) | OE2 — validación posible sin microdato (sensibilidad ρ≈0,99, patrón temporal citado) |
| [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md) | Tablero prometido→hecho→cumplido por objetivo/indicador |
| [docs/CRITICA_Y_MEJORAS.md](docs/CRITICA_Y_MEJORAS.md) | Autocrítica sin sesgo (grietas científicas y de producto) |
| [docs/HALLAZGOS_Y_DESAFIOS.md](docs/HALLAZGOS_Y_DESAFIOS.md) | Hallazgos, desafíos, generalización (réplica Cali) |
| [docs/REFERENCIAS.md](docs/REFERENCIAS.md) | Bibliografía IEEE consolidada |
| [docs/PLAN_PRODUCTO.md](docs/PLAN_PRODUCTO.md) | Producto/app (Android·iOS), panel de admin, guion de sustentación |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, stack, contrato de API, modelo de datos |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Despliegue (Hugging Face Space + Supabase) |

## Estructura

```
app/
  packages/shared/   tipos + cliente API (web y app móvil)
  apps/web/          React + Vite + MapLibre GL (cliente de escritorio / demo)
  apps/android,ios/  app nativa Android/iOS (Expo/RN) — en construcción
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

## Uso de la API (ejemplo)

Predicción de destino en línea a partir de un recorrido parcial:
```bash
BASE="https://englergz-nomadaai.hf.space"
curl -s -X POST "$BASE/predict/online" -H 'content-type: application/json' -d '{
  "points":[{"lon":-78.7855,"lat":1.7840,"t":0},{"lon":-78.7854,"lat":1.7841,"t":1},
            {"lon":-78.7852,"lat":1.7843,"t":2},{"lon":-78.7850,"lat":1.7846,"t":3}],
  "type":"car","t_seconds":70200,"speed_mps":8.3,"threshold":0.7
}'
```
Otros servicios: `/risk/zones?hour=&day=` (riesgo), `/route/build` (ruta segura),
`/trajectories/evaluate` (efectividad). Contrato completo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licencia y atribución

> **Licencia:** [PolyForm Noncommercial 1.0.0](LICENSE) — código visible y de uso académico/no
> comercial; cualquier uso comercial requiere permiso del autor. © Engler González · Tesis MGTIC,
> Universidad de Nariño.

> **Atribución.** La base de simulación de movilidad (red vial de Tumaco y generación de trayectorias
> con SUMO) parte del trabajo del **PhD. Andrés Oswaldo Calderón Romero**:
> https://github.com/aocalderon/Research/tree/master/Scripts/SUMO
