# Validación y reconstrucción del modelo de riesgo (OE2)

> Resultados reproducibles con `services/api/scripts/oe2_valida_riesgo.py` (validación) y
> `services/api/scripts/rebuild_risk.py` (reconstrucción con datos DANE).

## 1. Alcance honesto

Los datos abiertos de homicidios de Tumaco (Policía Nacional, **datos.gov.co**, dataset
`m8fd-ahd9`) tienen granularidad **municipio + zona URBANA/RURAL + fecha + arma + modalidad**;
**no traen coordenadas ni hora**. Por tanto **no es posible** una precisión/recall espacial punto a
punto del mapa intra-urbano sin **microdato georreferenciado** (DIJIN, derecho de petición radicado).

## 2. Caracterización real del fenómeno (datos.gov.co, 4 045 homicidios)

| Dimensión | Resultado | Lectura |
|-----------|-----------|---------|
| Arma | **85,8%** arma de fuego | Violencia armada, no delito de oportunidad. |
| Modalidad | **56,6%** sicariato | Violencia **dirigida/organizada** (economías ilegales). |
| Zona | URBANA 44,8% · RURAL 55,2% | El ruteo urbano incide sobre ~45% de la violencia letal. |
| Tendencia | 216 (2019) → 40 (2025) | Descenso sostenido. |

**Consecuencia teórica clave:** la violencia en Tumaco es de tipo **conflicto armado / sicariato**,
no delito urbano común. Este patrón **no** se explica por los gradientes socioeconómicos clásicos de
la criminología urbana.

## 3. Diagnóstico crítico del índice inicial y su reconstrucción

**Diagnóstico (evidencia).** El índice RTM inicial resultó **degenerado**:

- Estaba explicado en un **96%** por la densidad de tráfico (`n_points`) → era, de facto, un **mapa
  de actividad/tráfico**, no de peligro.
- Su factor socioeconómico era **casi constante**: el censo DANE 2018 muestra que **el 99% de la
  población de Tumaco es estrato 1** (893 de 1 136 manzanas). Sin gradiente socioeconómico, ese
  factor —aunque tuviera un peso alto— **no aportaba contraste espacial** (offset plano).
- Clasificación inservible: **1 sola zona "alto"** de 425.

**Reconstrucción con datos DANE reales.** Se descargó la **población por manzana** (censo DANE 2018,
servicio Esri Colombia; 65 568 hab.) y se reconstruyó el índice como combinación de **cuatro factores**
(fuente de verdad `rebuild_risk_full.py`), con el factor socioeconómico **deshabilitado por homogéneo**
(ver framework configurable en `MODELO_RIESGO.md` §3):

- **Densidad poblacional (0,35)** — exposición / actividades rutinarias (Cohen & Felson, 1979; Brender, 2012).
- **Actividad/tráfico (0,20)** — concurrencia.
- **Periferia / aislamiento (0,30)** — las zonas periféricas, aisladas y de baja vigilancia tienden a
  mayor violencia **dirigida** (Jacobs, 1961, "ojos en la calle"; Newman, 1972, espacio defendible;
  CEDRE, 2024: corredores y débil presencia estatal en la periferia). Contrapesa el sesgo de "solo el
  centro concurrido es riesgoso" — coherente con el perfil de sicariato de Tumaco.
- **Lejanía de policía (0,15)** — menor "guardián capaz" (Cohen & Felson, 1979); distancia a la
  estación más cercana (OSM, 2 estaciones en Tumaco; archivo por ciudad `tumaco_police.json`).

Cada factor se transforma a **percentil** antes de ponderar, de modo que los **pesos controlan la
influencia real** (no la varianza de cada factor). Correlaciones resultantes equilibradas: densidad
0,32 · periferia 0,36 · policía 0,34 · tráfico 0,07. *(Iluminación — Welsh & Farrington, 2008 — queda
pendiente: OSM no tiene luminarias para Tumaco; el dato real sería luces nocturnas satelitales VIIRS.)*

La **cobertura** se extendió a todas las manzanas pobladas (malla 425→**475 celdas**). La curva
temporal tiene un **piso nocturno** (la violencia dirigida no se anula de madrugada); su forma exacta
es un **supuesto no calibrado** (pendiente de dato/cita). Resultado antes/después del primer arreglo:

| Métrica | Antes | Después (primer arreglo) |
|---------|-------|---------|
| corr(índice, tráfico `n_points`) | 0,96 | **0,68** |
| corr(índice, población DANE) | 0,28 | **0,80** |
| Niveles bajo / medio / **alto** | 342 / 82 / **1** | 213 / 149 / **63** |

> ⚠️ **ESTA TABLA ES DE LA ETAPA DE 425 CELDAS, NO DEL MODELO ACTUAL.**
> Los conteos 342/82/1 y 213/149/63 suman 425. Después vinieron DOS cambios que
> alteran estas cifras: la ponderación por **percentil** (que equilibra a
> propósito la influencia de cada factor) y la ampliación de la malla a **475**.
>
> **Cifras del modelo ACTUAL (475 celdas), recalculadas contra el endpoint en
> producción el 2026-08-04:**
>
> | Métrica | Etapa 425 | **Modelo actual (475)** |
> |---|---|---|
> | corr(índice, población) | 0,80 | **0,32** |
> | corr(índice, tráfico/actividad) | 0,68 | **0,07** |
> | Niveles bajo / medio / alto | 213 / 149 / 63 | **332 / 95 / 48** |
>
> La bajada de las correlaciones **no es un empeoramiento, es el objetivo**: la
> transformación a percentil hace que los **pesos** gobiernen la influencia de
> cada factor en vez de su varianza, y por eso ningún factor domina el índice
> (densidad 0,32 · periferia 0,36 · policía 0,34 · tráfico 0,07). Un índice con
> correlación 0,80 con población sería, en la práctica, un mapa de población.
>
> **Para la tesis:** si se citan 0,68/0,80 hay que decir que son de la etapa
> intermedia; si se quiere describir el modelo entregado, las cifras son las de
> la columna «modelo actual». Verificable con:
> `curl -s https://englergz-nomadaai.hf.space/risk/zones?city=tumaco`

El mapa dejó de ser un mapa de tráfico, ahora lo gobierna la **densidad poblacional real** y los
niveles son utilizables. La curva temporal (pico 20:00 ×1,79) se preservó.

## 4. Qué es y qué no es (honestidad metodológica)

- **Es:** un **índice de exposición/vulnerabilidad** fundamentado (teoría de actividades rutinarias:
  más población = más objetivos potenciales), calibrado con **datos censales reales** y modulado por
  una curva temporal. Útil para priorizar zonas y ponderar rutas.
- **No es:** un **predictor de crimen validado** con precisión ≥85%. Dos razones estructurales, ambas
  **hallazgos de la investigación**, no defectos de implementación:
  1. Tumaco es **socioeconómicamente homogéneo** (estrato 1) → el gradiente socioeconómico clásico
     no discrimina.
  2. Su violencia es de **conflicto armado/sicariato**, cuyo patrón espacial requiere **microdato
     georreferenciado de incidentes** (DIJIN, en trámite), inexistente en datos abiertos.

Declarar esto es lo correcto: convierte una limitación de datos en una **contribución analítica**
(los modelos de riesgo urbano estándar tienen alcance limitado en contextos de conflicto armado y
homogeneidad socioeconómica como Tumaco).

## 5. Estrategia de validación factible (sin depender solo de la DIJIN)

"No hay microdato punto a punto" **no** equivale a "no se puede validar nada". Hay varios niveles de
validación, ordenados de menos a más exigentes; los dos primeros **ya son posibles con el dato en
mano** y los siguientes **no requieren a la DIJIN** como único camino.

**(a) Validez temporal — HECHA (dato independiente).** El patrón que modula el índice está respaldado
por evidencia externa: a nivel nacional los homicidios se concentran de noche (**pico 20:00, +83 %
sobre el promedio**) y en **fin de semana (+54 %)**, con **76,8 % por arma de fuego** [CEJ, Reloj de
la Criminalidad]. Esto es **coherente con la modalidad de Tumaco** (85,8 % arma de fuego, 56,6 %
sicariato) y con el patrón por día ya medido localmente (domingo 19,7 %, sábado 14,8 %). La curva
horaria deja de ser "transferida a ciegas": es un **prior informado y consistente** con el mecanismo
de violencia local. *(Resuelve la crítica #6.)*

**(b) Arbitraje de la hipótesis periferia/aislamiento — HECHA (dato independiente).** El temor a que
"periferia = más riesgo" pudiera estar **invertida** se arbitra con los propios homicidios de la
Policía: **el 55,2 % ocurre en zona RURAL/periférica** frente a 44,8 % urbana, pese a que la población
se concentra en el núcleo urbano. La violencia dirigida se asocia a los **corredores periféricos y de
baja presencia estatal** (economías ilegales), no al centro concurrido → la dirección del factor es la
correcta, **no invertida**. Es corroboración independiente (no SUMO). *(Resuelve la crítica #3 en su
dirección; la magnitud intra-urbana exacta sigue pendiente de microdato.)*

**(c) Validez convergente — PROPUESTA (dato independiente, rompe circularidad).** Correlacionar el IRU
por zona con la **percepción de inseguridad de la Encuesta CEDRE 2024** (fuente distinta e
independiente del modelo). Si las zonas de mayor índice coinciden con las de mayor inseguridad
percibida, es **validez de constructo** sin usar el propio dato del modelo.

**(d) Patrón de puntos con eventos georreferenciados — PROPUESTA (sin DIJIN).** **ACLED** (*Armed
Conflict Location & Event Data*) publica eventos de violencia **georreferenciados** para Colombia,
incluido Nariño/Tumaco. Con ellos se calcula el **hit-rate / Predictive Accuracy Index (PAI)** del
mapa de riesgo (¿las celdas de alto índice concentran los eventos observados?) — la validación
espacial que hoy falta, **sin depender del microdato de la DIJIN**.

**(e) Calibración/validación plena — FUTURA.** Con dato de resultado georreferenciado (DIJIN **o**
**reporte ciudadano** de la app) → precision/recall/F1, validación cruzada espacial, y pesos ajustados
por datos (RTM/GWR). El **reporte ciudadano** es la vía autosuficiente: genera el dato que hoy falta.

> **Síntesis (crítica #1 y #7).** El modelo **sí admite validación** en los niveles temporal (hecho),
> de dirección de factores (hecho) y convergente/espacial (ACLED/CEDRE, sin DIJIN); la validación de
> **precisión punto a punto** queda para ACLED/DIJIN/reporte. Como OE4 (#7) mide exposición sobre esta
> superficie, su grado de validez externa **crece con (c) y (d)** — no depende de un solo trámite.

## Soporte teórico y técnica ante la escasez de datos

La imposibilidad de contar con incidentes georreferenciados **no invalida** el enfoque: la literatura
ofrece técnicas diseñadas justamente para eso.

- **Risk Terrain Modeling (Caplan & Kennedy, 2011):** modela el riesgo a partir de **factores
  ambientales/estructurales del territorio**, no de puntos de delito — es el método indicado cuando
  el microdato de incidentes es escaso o inexistente. Es el marco que usamos.
- **Densidad poblacional como factor de riesgo (Brender, 2012, citado en Bámaca López, 2014):**
  *"el aumento de la población —y por ende la densidad poblacional— hace aumentar el estrés y la
  frustración que conduce a la conducta violenta"*. Respalda que el factor dominante del índice
  reconstruido (densidad poblacional real DANE) es teóricamente pertinente.
- **Desigualdad > pobreza como generadora de violencia (Kruijt, 2008; Banco Mundial, 2001):** en un
  municipio homogéneo (estrato 1) el gradiente socioeconómico no discrimina — coherente con nuestro
  hallazgo.
- **Datos de la propia ciudad (CEDRE / U. de Nariño, 2024):** violencia (24,8%) e inseguridad (23,5%)
  son el **problema #1** de Tumaco; NBI con paredes exteriores inadecuadas 29,4%, hacinamiento 17,2%.
- **Reporte ciudadano participativo** como fuente para superar el vacío oficial: la app móvil
  (Android/iOS) incorporará **reporte de incidentes**, alimentando el modelo con datos comunitarios
  (enfoque participativo de seguridad; Arteaga Botello, 2005).

## Referencias

- Caplan, J. M., & Kennedy, L. W. (2011). *Risk Terrain Modeling.* Justice Quarterly.
- Jacobs, J. (1961). *The Death and Life of Great American Cities* ("eyes on the street").
- Newman, O. (1972). *Defensible Space.*
- Cohen, L., & Felson, M. (1979). *Social Change and Crime Rate Trends: A Routine Activity Approach.*
- Shaw, C., & McKay, H. (1942). *Juvenile Delinquency and Urban Areas.*
- DANE (2018). *Censo Nacional de Población y Vivienda* — población por manzana (servicio Esri Colombia).
- Policía Nacional de Colombia — datos.gov.co, dataset `m8fd-ahd9` (homicidios).
- Bámaca López, E. E. (2014). *Violencia y Pobreza: pan y tortilla del cada día.* RELACSO, FLACSO México, No. 5.
- Brender (2012), en Bámaca López (2014) — densidad poblacional y conducta violenta.
- Kruijt, D. (2008) / Banco Mundial (2001) — desigualdad y violencia en América Latina.
- Centro de Estudios de Desarrollo Regional (CEDRE), Universidad de Nariño (2024). *Encuesta Socioeconómica de Tumaco 2024.*
- Arteaga Botello, N. (2005) — enfoque comunitario/participativo de la seguridad.


---

## 5. Verificación de OE4 contra la malla actual (2026-08-04)

Motivo: si la superficie de riesgo cambió (425 → 475 + ponderación por percentil),
la **reducción de exposición** medida sobre esa superficie pudo cambiar también.

**Reproducción del dato de la tesis.** El archivo `artifacts/eval/oe4_od_sweep.csv`
(200 pares O-D) reproduce **exactamente** lo publicado: media **7,00 %**,
IC 95 % **[6,44 · 7,56]**, **95,0 %** de rutas que mejoran. El número no está inventado
ni mal transcrito.

**Recálculo contra producción, con LOS MISMOS 70 viajes** (se reconstruyen origen y
destino desde `/trajectories/{id}/track` y se piden rutas a `/route/build`):

| | Reducción media | IC 95 % | Rutas que mejoran |
|---|---|---|---|
| Archivo de la tesis (mismos 70) | 4,95 % | [4,15 · 5,74] | 92,9 % |
| **Malla actual (475), mismos 70** | **3,45 %** | [2,69 · 4,22] | **92,9 %** |

**Lectura honesta:**

1. El **95 % de rutas que mejoran se sostiene** (92,9 % en este subconjunto, en ambas
   versiones): la afirmación cualitativa de OE4 es robusta al cambio de superficie.
2. La **magnitud sí bajó**: ~3,5 % frente al 7,0 % publicado. Es coherente con la
   reconstrucción del índice: al equilibrar los factores por percentil, el contraste
   entre celdas se suaviza y **hay menos exposición que evitar por desvío**.
3. **Advertencia de método:** los 70 viajes del subconjunto ya daban 4,95 % en el
   archivo original (no 7,00 %), así que **parte de la diferencia es de muestreo**,
   no del cambio de malla. El efecto atribuible a la nueva superficie es la caída de
   **4,95 % → 3,45 %**, no de 7,00 % → 3,45 %.

### Barrido COMPLETO recalculado (200 pares, malla 475) — 2026-08-04

Se corrieron **los mismos 200 pares O-D** del archivo original (reconstruidos desde
`/trajectories/{id}/track`), contra la superficie actual. IC por **bootstrap**
(5.000 remuestreos, semilla 42). Los 200 se resolvieron: n=200 en ambas columnas.

| | Reducción media | IC 95 % (bootstrap) | Rutas que mejoran |
|---|---|---|---|
| Archivo original (etapa previa) | 7,00 % | [6,45 · 7,55] | 95,0 % |
| **Modelo entregado (malla 475)** | **5,24 %** | **[4,68 · 5,79]** | **95,0 %** |

**Cifras para la tesis:** media **5,24 %**, IC 95 % **[4,68 · 5,79]**, **95,0 %** de
rutas que mejoran.

**Lecturas:**

1. El **95,0 % de rutas que mejoran es idéntico** en ambas superficies. La afirmación
   central de OE4 no depende de la reconstrucción del índice.
2. La magnitud baja de 7,00 % a **5,24 %**, y el intervalo sigue siendo **estrecho**
   (±0,55), o sea efecto preciso, no ruido. La caída es coherente con equilibrar los
   factores por percentil: menos contraste entre celdas ⇒ menos exposición evitable
   por desvío.
3. La estimación previa de 3,45 % venía de un subconjunto de 70 viajes y **quedó
   descartada**: con la muestra completa el valor es 5,24 %. Confirma que comparar
   subconjuntos distintos induce error, no el cambio de malla.


---

## 6. Verificación exhaustiva de cifras de la tesis (2026-08-04)

Todas contra el sistema entregado. **Fuente = endpoint en producción o artefacto del
repo**, nunca memoria.

### 🔴 Dependen de la superficie de riesgo

| Cifra en la tesis | Valor verificado | Veredicto |
|---|---|---|
| OE4 · reducción media **7,0 %** [6,4–7,6] | **5,24 %** [4,68 · 5,79] (200 pares, bootstrap, malla 475) | ⚠️ **actualizar** |
| OE4 · **95 %** de rutas mejoran | **95,0 %** (idéntico) | ✅ se mantiene |
| OE3 · alerta anticipada **88,7 %** | **88,7 %** en el escenario hora 20 / umbral 80 / look-ahead 150 m. El global del artefacto es **94,0 %** (n=4.032) y el barrido va de 0 a 97,2 % | ✅ correcto, pero **es un escenario concreto**: hay que decir cuál |
| OE3 · anticipación **~280 m y 25 s** | media **248 m / 21,8 s**; mediana **300 m / 24,6 s** | ⚠️ **precisar si es media o mediana** (los 280 m no salen de ninguna de las dos) |
| Cali · **4.268 celdas** | **4.268** | ✅ exacto |
| Cali · correlación socioeconómica **≈ 0,59** | El endpoint expone `poblacion` (**0,056**) y `actividad` (**0,016**); no publica el factor socioeconómico | ❓ **no verificable desde producción** — hay que mirar el script de construcción de Cali |

### 🟡 Confirmadas

| Cifra | Valor verificado |
|---|---|
| Malla Tumaco **475 celdas** | ✅ 475 |
| Niveles **332 / 95 / 48** | ✅ exacto |
| Correlaciones **0,07 tráfico · 0,32 población** | ✅ exacto |
| Trayectorias **4.032** | ✅ 4.032 filas en el artefacto |
| **45 escenarios** (hora × umbral × look-ahead) | ✅ 45 filas |
| Niveles Cali | bajo 2.987 · medio 854 · alto 427 |

### 🔴 Cerradas en esta pasada

| Cifra | Valor verificado | Fuente | Veredicto |
|---|---|---|---|
| Cali · correlación socioeconómica **≈ 0,59** | **0,593** | `cali_zonas_riesgo_v2.csv` (n=4.268), corr(índice, vulnerabilidad) | ✅ **exacto** |
| Sensibilidad **ρ ≈ 0,99** | **ρ media 0,998 · mínimo 0,9915** (200 perturbaciones ±20 % de los pesos) | `tumaco_zonas_riesgo_rtm.csv` | ✅ **se sostiene** |

> ⚠️ **Matiz honesto sobre ρ:** el artefacto con las contribuciones por factor
> (`tumaco_zonas_riesgo_rtm.csv`) tiene **425 celdas**, la etapa previa. El cálculo
> confirma que el ordenamiento es robusto a perturbaciones de peso, pero **sobre la
> malla de 425**. Para afirmarlo de la malla entregada habría que regenerar ese
> artefacto con las 475 celdas y sus contribuciones por factor. Dado que ρ mide
> estabilidad del *ranking* frente a los pesos —una propiedad del método, no del
> tamaño de la malla— es razonable esperar el mismo resultado, pero **no está
> verificado sobre 475**.
>
> Nota adicional: ese CSV guarda 3 contribuciones (`exp`, `socio`, `pop`) mientras la
> configuración actual declara **4 factores activos** (densidad 0,35 · periferia 0,30
> · actividad 0,20 · policía 0,15). Es otra señal de que el artefacto es de la etapa
> anterior al rediseño.

### OE1 — verificado contra `/trajectories/evaluate` (2026-08-04, n=200)

| Cifra en la tesis | Valor verificado | Veredicto |
|---|---|---|
| Acierto ≤50 m **90 %**, IC **[85–94]** | **90,5 %**, IC **[86,0 · 94,5]** | ✅ |
| Acierto ≤100 m **~96 %** | **96,5 %** | ✅ |
| Error mediano **~8 m** | **7,35 m** (media 18,26 · p90 48,4) | ✅ |
| Partición **80/20** | **3.226 train / 806 test** | ✅ |
| Mejora sobre línea recta | **+17,0 pp** (90,5 % vs 73,5 %) | ✅ |
| Comparación con Markov | **+54,0 pp** (90,5 % vs 36,5 %) | ✅ |

### OE2 — caracterización de homicidios verificada contra `oe2_homicidios_tumaco.csv`

| Cifra | Valor verificado | Veredicto |
|---|---|---|
| **4.045** homicidios | **4.045** (total consistente en las tres dimensiones) | ✅ |
| Arma de fuego **85,8 %** | **85,8 %** (3.472) | ✅ |
| Sicariato **56,6 %** | **56,6 %** (2.291) | ✅ |
| Rural **55,2 %** / urbana **44,8 %** | **55,2 % (2.231) / 44,8 % (1.814)** | ✅ |

### Robustez GPS — verificada (`?noise_m=`, n=200)

| σ ruido | Tesis | **Verificado** | Δ |
|---|---|---|---|
| 0 m | 90 % | **90,5 %** | ✅ |
| 5 m | 82 % | **85,5 %** | ⚠️ +3,5 pp (mejor de lo citado) |
| 10 m | 72 % | **72,5 %** | ✅ |
| 20 m | 60,6 % | **55,0 %** | ⚠️ **−5,6 pp (peor de lo citado)** |

La forma de la curva se sostiene (degradación progresiva), pero **dos puntos no
coinciden**. El de 20 m es el que importa: la tesis afirma 60,6 % y el sistema da
55,0 %. Se recomienda **republicar la curva completa** con estos valores en vez de
ajustar solo uno. Reproducible con:
`curl "https://englergz-nomadaai.hf.space/trajectories/evaluate?n=200&noise_m=20"`

> Nota de método: la evaluación muestrea `n` viajes, así que hay variación entre
> corridas. Para publicar conviene fijar `n` alto (p. ej. 500) y reportar el `n` usado.

### Verificadas contra `Research/analysis_v2/` (2026-08-04)

Los artefactos originales SÍ están en el repo. Confirmado:

| Cifra en la tesis | Valor verificado | Fuente | Veredicto |
|---|---|---|---|
| Destino final · **mot 578 m** | **548,1 m** (n=2.699) | `eval_fair_horizon.csv` | ⚠️ −30 m |
| Destino final · **car 789 m** | **770,5 m** (n=1.101) | ídem | ⚠️ −19 m |
| Destino final · **bus 1.385 m** | **1.361,5 m** (n=200) | ídem | ⚠️ −24 m |
| Destino final · **camión 1.372 m** | **1.368,3 m** (n=29) | ídem | ✅ |
| Destino final · **mediana global 642 m** | **642,0 m** | ídem | ✅ **exacto** |
| Acierto ≤100 m al destino · **1,4 %** | **1,44 %** | ídem | ✅ **exacto** |
| Dirección **<30° · 92 %** | **91,9 %** | ídem | ✅ |
| Serie **216 (2019) → 40 (2025)** | **216 (2019) · 40 (2025)** | `tumaco_homicidios_por_anio.csv` | ✅ **exacto** |

> Las medianas por vehículo están **20–30 m por encima** en la tesis. Diferencia
> pequeña y en la dirección conservadora (el sistema es algo mejor), pero conviene
> usar los valores reales: **548 / 770 / 1.361 / 1.368**.
>
> ⚠️ **Sobre el «~8 m»**: en este artefacto la mediana al horizonte emparejado es
> **0,3 m**, y el acierto ≤50 m es **86,5 %** (no 90 %). El 90 % / ~8 m que reporta
> la tesis coincide con el **endpoint de evaluación** (`/trajectories/evaluate`:
> 90,5 % · 7,35 m), que usa muestreo y horizonte distintos. **Son dos mediciones
> distintas del mismo concepto**: hay que declarar cuál se cita.

### Cifras que NO se pueden verificar con lo que hay desplegado

| Cifra | Por qué |
|---|---|
| ~~Ablación 79,1 → 79,2~~ | ✅ **VERIFICADA** — reproducida ejecutando `Research/analysis_v2/ablation_trajcl.py --sample 800 --lambda_emb 1.0`: **geom 79,1 % · geom+emb 79,2 %** (hit@50 m, n=800, semilla 7). Exacto, incluido el Δ nulo. |
| ~~Error al destino final y 1,4 %~~ | ✅ **verificados** en `Research/analysis_v2/eval_fair_horizon.csv` (ver tabla arriba) |
| Sensibilidad **ρ** sobre la malla de **475** | El artefacto de contribuciones por factor es de 425 y declara 3 factores frente a los 4 activos. |
| ~~Serie 216 → 40~~ | ✅ **verificada** en `Research/analysis_v2/tumaco_homicidios_por_anio.csv` |

### Estado final de la validación

**VALIDACIÓN COMPLETA. No queda ninguna cifra sin verificar.**

### ρ sobre la malla ENTREGADA de 475 — cerrado (2026-08-04)

El obstáculo era que el índice de 475 se sirve precalculado y no persiste las
contribuciones por factor. Se resolvió **reconstruyendo los cuatro factores** desde
sus fuentes primarias, que sí están en el repo:

| Factor | Peso | Reconstruido desde |
|---|---|---|
| densidad | 0,35 | `poblacion_dane` de `tumaco_zonas_riesgo_v2.csv` (DANE manzana) |
| periferia | 0,30 | distancia de cada celda al centroide de la malla |
| actividad | 0,20 | `n_points` (trayectorias SUMO) |
| policía | 0,15 | distancia a la estación más cercana de `tumaco_police.json` (OSM) |

Cada factor a **percentil** y combinación por pesos, tal como declara
`risk_config.tumaco.json`.

**Validación de la reconstrucción (paso obligatorio antes de usarla):**
correlación con el índice real = **0,9935**. Reproduce el índice, así que el ρ
calculado sobre ella mide sensibilidad y no error de modelado. *(El intento previo
con solo dos factores daba 0,476 y por eso se descartó.)*

**Resultado:**

| | ρ media | ρ mínimo |
|---|---|---|
| Malla 425 (artefacto original) | 0,9980 | 0,9915 |
| **Malla 475 (entregada)** | **0,9898** | **0,9481** |

✅ **La tesis afirma ρ ≈ 0,99 y sobre la malla entregada da 0,9898.** Se confirma:
el ordenamiento del índice es robusto a perturbaciones de ±20 % en los pesos. El
mínimo baja a 0,948 (contra 0,9915 en 425), coherente con una malla más grande y
más celdas empatadas, pero sigue siendo una correlación de rangos muy alta.

**Correcciones que la tesis debe aplicar** (todas medidas, ninguna supuesta):

| Dónde | Dice | Debe decir |
|---|---|---|
| OE4 (Resumen, Resultados, Análisis, Conclusiones) | −7,0 % [6,4–7,6] | **5,24 % [4,68 · 5,79]** |
| OE1 robustez GPS | 90/82/72/**60,6** | **90,5 / 85,5 / 72,5 / 55,0** |
| OE3 alerta anticipada | 88,7 % (como global) | 88,7 % **en el escenario hora 20 / umbral 80 / look-ahead 150 m**; global 94,0 % |
| OE3 anticipación | ~280 m y 25 s | **248 m media / 300 m mediana**; 21,8 s media / 24,6 s mediana |
| OE1 destino final | 578 / 789 / 1.385 / 1.372 m | **548 / 770 / 1.361 / 1.368 m** |
| OE1 acierto ≤50 m | 90 % (sin declarar fuente) | Declarar la medición: **90,5 %** (endpoint) o **86,5 %** (`eval_fair_horizon.csv`) |

**Se mantienen sin cambio** (verificadas exactas): 95,0 % de rutas que mejoran ·
642 m mediana al destino · 1,44 % ≤100 m · 91,9 % dirección · ablación 79,1→79,2 ·
4.045 homicidios con 85,8 / 56,6 / 55,2-44,8 · serie 216→40 · Cali 4.268 y 0,593 ·
malla 475 con niveles 332/95/48 y correlaciones 0,07/0,32 · 4.032 trayectorias ·
45 escenarios · partición 3.226/806.
