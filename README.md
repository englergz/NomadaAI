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
enfoque aporta más. Su valor no es un modelo atado a Tumaco, sino un **marco configurable por
contexto**: cada factor del riesgo se habilita y pondera según la ciudad, y esa decisión queda
registrada —con su motivo medido— en un archivo versionado por ciudad.

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

Todas las cifras se miden sobre el **sistema desplegado** y se reproducen con el comando indicado.

| Objetivo | Resultado | Cómo reproducirlo |
|---|---|---|
| **OE1 · Predicción de destino** | **87,5 % de acierto a ≤50 m** (IC 95 % [85,2–89,8]) sobre las **805** trayectorias del conjunto de prueba; ≤100 m: 92,7 %; error mediano 7,70 m; dirección correcta (<30°) 92,4 % [90,7–94,3]. Bajo ruido GPS de 5–10 m —el rango típico de un teléfono— el acierto cae a **63,7–77,4 %**. | `GET /trajectories/evaluate?n=806`<br/>(robustez: `&noise_m=5`, `=10`, `=20`) |
| **OE2 · Riesgo por zona×hora×día** | Índice RTM **multivariable, configurable y auditable** sobre **475 celdas** de 150 m; ordenamiento espacial robusto a perturbaciones de los pesos (**ρ = 0,9898**, mínimo 0,9481). | `GET /risk/zones?hour=20` |
| **OE3 · Ruta segura + alerta** | Ruteo ponderado por riesgo + alerta evaluada **en el punto de operación real** (umbral = percentil 0,70): a la hora pico, **99,1 %** de los recorridos recibe aviso de precaución y **65,8 %** cruza zona de nivel alto; de los avisos, el **58,7 %** precede a la entrada, con mediana de **756 m (91 s)**. | `services/api/scripts/oe3_alerta_punto_operacion.py` |
| **OE4 · Efectividad** | En la **configuración de fábrica** (λ = 2,5): **−4,84 % de exposición** (IC 95 % [3,62–6,22], bootstrap por conglomerados sobre 40 pares O-D) con **1,7 %** de sobrecosto de distancia; mejora el **100 %** de los recorridos. En el ajuste máximo (λ = 5): −5,88 % con 3,7 % de sobrecosto. | `services/api/scripts/oe4_lambda_canonico.py` |
| **Portabilidad** | El marco se ejecuta también sobre **Cali** (4.268 celdas) con configuración propia de factores. Ver la nota de alcance más abajo. | `GET /risk/zones?city=cali` |

> **Nota de alcance y limitaciones.** Se declaran aquí con el mismo detalle que en el documento.
>
> - **Datos simulados.** El alcance aprobado opera sobre trayectorias generadas con **SUMO**; las
>   cifras se reportan en ese entorno. La validación con GPS real es trabajo pendiente.
> - **El IRU es un índice de exposición, no un predictor validado.** Los datos abiertos de homicidios
>   carecen de coordenada y hora, así que no existe verdad-terreno contra la cual validarlo. Por eso
>   **el indicador de precisión >85 % de OE2 y el de identificación del 69 % de OE3 quedan sin
>   alcanzar**, y se declaran como tales.
> - **La modulación horaria es un supuesto de diseño**, coherente con el patrón nocturno documentado
>   a escala nacional pero **no calibrado con dato horario local**. Su amplitud efectiva en el sistema
>   desplegado es de ×1,17 sobre la media diaria.
> - **El indicador de mejora ≥30 % de OE4 no se alcanza**: ninguna de las 1.200 rutas evaluadas reduce
>   la exposición en esa cuantía. No es una deficiencia del ruteo —que mejora todos los recorridos—
>   sino del margen que ofrece la red vial del municipio.
> - **Sobre Cali: es portabilidad técnica, no evidencia de validez del marco.** Lo que sí está medido
>   es que la variable socioeconómica es **cuasi-degenerada en Tumaco** (96,3 % de zonas comparten un
>   valor, σ = 0,046) y **dispersa en Cali** (93 valores distintos, σ = 0,282, seis veces mayor) — por
>   eso el factor se desactiva allá y se activa acá, y esa decisión queda registrada con su motivo en
>   `risk_config.<ciudad>.json`. La prueba de si el factor **reordena** el mapa resultó no concluyente
>   (ρ con/sin factor: Tumaco 0,9841, dentro del piso de ruido; Cali 0,8491, efecto débil).
> - **La dirección del efecto de OE4 está garantizada por construcción**: Dijkstra minimiza un coste
>   que ya incorpora el riesgo, así que la ruta recomendada nunca puede ser más expuesta que la
>   directa. Lo que se contrasta empíricamente es la **magnitud**.
>
> Detalle en [docs/RECOMPUTO_2026-08.md](docs/RECOMPUTO_2026-08.md) (cada cifra con su comando y el
> hash de su artefacto) y en [docs/CRITICA_Y_MEJORAS.md](docs/CRITICA_Y_MEJORAS.md).

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
4. **Evaluación (OE4)** — partición train/test 80/20 con semilla fija, intervalos de confianza al 95 %
   por bootstrap, y **bootstrap por conglomerados** en el barrido origen-destino (las 200 rutas son 40
   pares × 5 horas, así que el *n* efectivo es 40, no 200).

**Reproducibilidad.** Toda iteración de conjuntos está ordenada y el ruido GPS usa un hash estable
(`blake2b`), de modo que **una misma semilla produce el mismo resultado entre reinicios del servicio**.
Los artefactos de evaluación están versionados con su `sha256` en
[`services/api/scripts/GOLDEN.md`](services/api/scripts/GOLDEN.md), y cada cifra publicada arriba
lleva el comando que la regenera.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/METODOLOGIA.md](docs/METODOLOGIA.md) | Paradigma, 4 objetivos, fases, datos y variables, evaluación |
| [docs/MODELO_PREDICCION.md](docs/MODELO_PREDICCION.md) | OE1 — predicción de destino (k-vecinos+rumbo, FDE, IC 95 %, robustez GPS) |
| [docs/MODELO_RIESGO.md](docs/MODELO_RIESGO.md) | OE2 — IRU como **framework configurable**: factores, pesos, factores OFF en Tumaco y por qué |
| [docs/VALIDACION_RIESGO.md](docs/VALIDACION_RIESGO.md) | OE2 — validación posible sin microdato (sensibilidad ρ = 0,9898, patrón temporal citado) |
| [docs/RECOMPUTO_2026-08.md](docs/RECOMPUTO_2026-08.md) | **Cada cifra publicada con su comando, su artefacto y su hash** — incluidas las retiradas y por qué |
| [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md) | Tablero prometido→hecho→cumplido por objetivo/indicador |
| [docs/CRITICA_Y_MEJORAS.md](docs/CRITICA_Y_MEJORAS.md) | Autocrítica sin sesgo (grietas científicas y de producto) |
| [docs/HALLAZGOS_Y_DESAFIOS.md](docs/HALLAZGOS_Y_DESAFIOS.md) | Hallazgos, desafíos y alcance de la portabilidad (ejecución sobre Cali) |
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
