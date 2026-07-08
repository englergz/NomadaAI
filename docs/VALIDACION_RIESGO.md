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

| Métrica | Antes | Después |
|---------|-------|---------|
| corr(índice, tráfico `n_points`) | 0,96 | **0,68** |
| corr(índice, población DANE) | 0,28 | **0,80** |
| Niveles bajo / medio / **alto** | 342 / 82 / **1** | 213 / 149 / **63** |

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
