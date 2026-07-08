# Modelo de Riesgo Urbano (OE2) — Índice de Riesgo Urbano (IRU)

> **NómadaAI** · Trabajo de Grado, MGTIC, Facultad de Ingeniería, Universidad de Nariño. Autor:
> Engler González Prado. Director: PhD. Manuel Ernesto Bolaños Gonzáles.
> La aplicación consume su salida (`tumaco_riesgo_horario.csv`) en `services/api`.

El **Índice de Riesgo Urbano (IRU)** es la contribución central de OE2: un índice **compuesto,
multivariable, espacio-temporal, configurable y auditable**, construido como una adaptación de
**Risk Terrain Modeling (RTM)** [R1], [R2] — combinar varias *capas* de factores de riesgo, cada una
con respaldo teórico, en una superficie de riesgo por **zona** y **hora**.

**Principio de diseño (clave de la replicabilidad).** El IRU es un **framework configurable**: define
un **registro completo de factores**, y cada factor se **habilita/deshabilita y pondera por
contexto** (ciudad/zona) desde la configuración. El riesgo no se produce por los mismos motivos en
todas partes; por eso el aporte no es un pesaje "universal", sino un **procedimiento que se ajusta al
contexto**. **Tumaco es una configuración** del framework; **Cali es otra**. Un factor sin dato o que
no discrimina en un contexto se **deja desactivado** y se **documenta el porqué** — eso no es un
vacío, es una **decisión trazable** (y, a menudo, un hallazgo).

![Mapa de riesgo RTM de Tumaco](img/tumaco_riesgo_rtm.png)
*Figura 1. Superficie de riesgo RTM por zona (modelo multivariable, factores activos de Tumaco).*

---

## 1. Por qué multivariable (y por qué no basta el delito reportado)

El riesgo basado **solo en delitos reportados** tiene tres sesgos conocidos: (i) **sub-reporte** (no
todo delito se denuncia), (ii) **sesgo de patrullaje** (se reporta más donde más se vigila) y (iii)
es **retrospectivo** (dónde *ocurrió*, no dónde las *condiciones* lo favorecen). RTM corrige esto
modelando el **entorno que produce el riesgo** [R1], [R2]; por eso el índice se compone de factores
del entorno, no del conteo de delitos.

El caso de Tumaco lo exige: **IPM = 53,7 %**, cobertura de **alcantarillado urbano = 6,7 %**,
**acueducto = 31,7 %**, tasa de **homicidios = 79,4/100k** (DNP TerriData, 2018–2021). Es un contexto
de **privación concentrada y homogénea** donde la teoría predice mayor riesgo más allá del punto
exacto del reporte — y donde, como se documenta abajo, algunos factores no discriminan *dentro* del
municipio precisamente por esa homogeneidad.

---

## 2. Definición formal del índice

Para una zona (celda) `z` y una hora `h`:

```
IRU(z,h) = 100 · TEMP(h) · Σ_{i ∈ activos}  w_i · pctl( F_i(z) )
```

- `F_i(z)`: valor crudo del factor *i* en la zona *z*.
- `pctl(·)`: normalización a **percentil espacial** [0,1] — cada factor se lleva a su percentil dentro
  de la distribución de todas las celdas, de modo que factores en unidades distintas sean comparables
  y **sean los pesos, no la varianza de cada variable, los que gobiernen su influencia**. (Evita,
  además, que "todo se vea rojo".)
- `w_i`: peso del factor *i*, con **Σ w_i = 1 sobre los factores ACTIVOS** (se re-normaliza al
  habilitar/deshabilitar factores).
- `TEMP(h)`: modulador horario (media diaria = 1, no infla el total) con piso nocturno
  `NIGHT_FLOOR = 0.5` (la violencia no se anula de madrugada) [R3].
- Resultado escalado a **0–100** para legibilidad.

El índice es **determinista** (mismos datos → mismo valor) y **trazable**: cada punto del mapa se
descompone en la contribución `w_i·pctl(F_i)` de cada variable → se puede explicar *por qué* una zona
es de riesgo alto (no es una caja negra).

> **Implementación actual:** `rebuild_risk_full.py` calcula el índice desde el **registro
> configurable** `risk_config.<city>.json` (factores `{enabled, weight, temporal_profile}`,
> Σ=1 renormalizada sobre los activos; un factor habilitado sin dato se omite y se reporta).
> Con la config equivalente reproduce exactamente los artefactos de la tesis (golden test,
> `scripts/GOLDEN.md`); cada corrida deja trazabilidad en `tumaco_riesgo_meta.json` (hash de la
> config + fecha + factores activos). La edición desde el panel de admin es el paso de producto (§4.3).

---

## 3. Registro de factores (el framework completo)

Cada factor es **ciudadano de primera clase**: existe en el modelo, tiene fundamento teórico y una
fuente de dato, y se **activa/pondera por contexto**. La tabla distingue lo **ACTIVO en Tumaco** (lo
que produce los resultados de la tesis) de lo **definido pero DESHABILITADO** aquí (con su motivo).

### 3.1 Factores ACTIVOS en Tumaco (Σ w = 1,00)

| Factor | Peso | Señal → efecto | Teoría | Fuente |
|---|---|---|---|---|
| **Densidad poblacional** | **0,35** | más población → más objetivos/exposición | Actividades rutinarias [R3] | DANE (censo por manzana) |
| **Periferia / aislamiento** | **0,30** | lejos del núcleo, menos vigilancia → ↑ riesgo | "Ojos en la calle" [R7]; espacio defendible [R8] | Geometría de la malla (distancia al centroide poblacional) |
| **Actividad / exposición** | **0,20** | convergencia de movilidad en espacio-tiempo | Actividades rutinarias [R3] | Trayectorias SUMO |
| **Lejanía de la fuerza pública** | **0,15** | mayor distancia a policía → menor guardián capaz | Guardián capaz [R3] | OSM `amenity=police` |

> Estos cuatro pesos (0,35 / 0,30 / 0,20 / 0,15) son la **fuente de verdad**: son los que fija
> `rebuild_risk_full.py` y los que produjeron todas las figuras y cifras de OE2/OE4.

### 3.2 Factores DEFINIDOS pero DESHABILITADOS en Tumaco (se activan por contexto)

| Factor | Estado (Tumaco) | Motivo — **hallazgo documentado** | Fuente cuando se active |
|---|---|---|---|
| **Vulnerabilidad socioeconómica** | **OFF** | **Homogeneidad socioeconómica:** ~**96 % de las zonas (290/301) quedan en vulnerabilidad máxima**; Tumaco es de **predominio de estrato 1** (IPM 53,7 %; alcantarillado urbano 6,7 %, TerriData). Un factor casi constante **no discrimina intra-urbano** → sumarlo sería un multiplicador plano. En **Cali** (heterogéneo en estratos) este factor se **habilita y sí discrimina** → evidencia de replicabilidad. | DANE manzana / TerriData / CEDRE 2024 |
| **Generadores / atractores (POIs de riesgo)** | **OFF** | **Sin dato del tipo correcto:** OSM en Tumaco no reporta bares/discotecas/licoreras (los generadores de la teoría [R6]); los POIs disponibles (colegios, bancos) **no** son atractores de delito. Activarlo con esos POIs inyectaría señal equivocada. | OSM/Overpass (`amenity=bar/pub/nightclub`, `shop=alcohol`, `marketplace`) |
| **Diseño ambiental / iluminación (CPTED)** | **OFF** | **Sin dato:** OSM en Tumaco no tiene alumbrado (`highway=street_lamp`, `lit=*`). La evidencia (mejor alumbrado ↓ delito ~21 %) [R9] la respalda para cuando exista el dato. | OSM / relevamiento de campo |
| **Delito reportado (capa espacial)** | **OFF (espacial)** | Los homicidios abiertos **carecen de coordenadas y de hora** → no son espacializables por celda. Sí se usan para el **patrón temporal** (día de la semana) y para caracterizar el fenómeno. | Microdato DIJIN o **reporte ciudadano** (§6) |

### 3.3 Moduladores y capa dinámica

| Componente | Estado | Nota |
|---|---|---|
| **Modulación temporal (hora × día)** | **ACTIVO** | `TEMP(h)` con piso nocturno; el día se estima con homicidios locales [R3]. |
| **Reporte ciudadano (capa viva)** | **Producto / v-próxima** | Genera dato local **georreferenciado y con hora** → habilita calibración y validación **sin depender solo de la DIJIN** (§6). |

![Zonificación de Tumaco](img/tumaco_zonas.png)
*Figura 3. Zonificación en malla (~150 m, 425 zonas) sobre el área urbana simulada.*

---

## 4. Asignación y configuración de pesos

### 4.1 Vía A — Pesos informados por teoría (por defecto, *cold start*)
Sin delito georreferenciado para calibrar, los pesos de los **factores activos** se fijan por experto
según la fuerza de la evidencia teórica y la confiabilidad del dato disponible (§3.1). **No son
verdades universales:** son **supuestos declarados y parametrizados**, cuya robustez se prueba por
sensibilidad (§5) y cuya calibración guiada por datos es la evolución (§4.2).

### 4.2 Vía B — Pesos calibrados con datos (al llegar dato de resultado georreferenciado)
Método propio de RTM [R2]: el **valor de riesgo relativo** de cada factor = razón entre la densidad de
delito donde el factor está presente vs. ausente; el peso es proporcional (normalizado). Alternativas:
regresión de conteo (Poisson/binomial negativa) o *gradient boosting* → importancias normalizadas a
Σ=1. **Pesos que varían en el espacio** (por celda/zona) = **Geographically Weighted Regression (GWR)**
[R10] — la vía para que "cada zona tenga su propio pesaje según su contexto". Todas requieren una
**variable de resultado georreferenciada**, que proviene de (i) microdato DIJIN o (ii) el **reporte
ciudadano** de la app (§6). Validación: validación cruzada espacial, *Predictive Accuracy Index* (PAI),
precision/recall/F1.

### 4.3 Vía C — Configuración por contexto (operativo, el aporte de replicabilidad)
Cada factor se declara con `{ enabled, weight }`. Los pesos se **re-normalizan a Σ=1 sobre los factores
activos**; habilitar/deshabilitar o repesar **no requiere tocar código** (panel de administración /
config por ciudad). Onboarding de una ciudad = elegir sus factores y pesos + correr el pipeline
(`rebuild_risk_city.py`). **Tumaco y Cali son dos configuraciones del mismo framework.**

> **Estado de implementación:** los factores viven en `risk_config.<city>.json` y el pipeline los
> consume (golden test en `scripts/GOLDEN.md`); falta exponer su edición en el **panel de admin**
> (habilitar/deshabilitar + peso + vista previa) — ver `PLAN_PRODUCTO.md` B.9.

![Comparativa de configuraciones del framework](img/riesgo_config_comparativa.png)
*Figura 4.1 — El framework en acción: la **configuración anterior** (2 factores: densidad 0,65 ·
actividad 0,35) deja el corredor periférico del sur en riesgo bajo; la **configuración actual**
(4 factores RTM: densidad 0,35 · periferia 0,30 · actividad 0,20 · policía 0,15) lo captura vía
periferia/aislamiento. Cambiar la configuración cambia el ranking espacial (ρ entre ambas ≈ 0,47).
No confundir con la Fig. 5 (índice degenerado inicial vs. multifactor): aquí se comparan **dos
configuraciones válidas del mismo framework**.*

---

## 5. Análisis de sensibilidad (robustez del ranking)

Como los pesos por defecto son supuestos, se reporta **cuánto cambia el mapa al variarlos**. El barrido
de `w_i` muestra que el **ordenamiento espacial** de las zonas es **robusto** (correlación de Spearman
**ρ ≈ 0,99**): aunque se ajusten los pesos dentro de un rango razonable, **las mismas zonas siguen
apareciendo como las de mayor riesgo**. Es decir, las conclusiones sobre *qué* zonas concentran la
exposición **no dependen** de una elección puntual de parámetros. (Robustez del ranking ≠ validación
contra verdad-terreno; ver §8–§9.)

![Barrido de parámetros de alerta](img/sweep_alerta.png)
*Figura 4. Barrido de sensibilidad (hora × umbral × horizonte) del motor de alerta.*

---

## 6. Reporte ciudadano de incidentes (capa dinámica — cierra la dependencia del dato)

En investigación el dato es simulado; en el **producto**, los usuarios **reportan incidentes** desde la
app (tipo, ubicación, hora, foto), alimentando una capa viva:

```
F_report(z,t) = Σ_r  c_r · decay(t − t_r) · verif_r
```
- `c_r`: severidad; `decay(Δt)`: los recientes pesan más; `verif_r`: auto-reporte < confirmado <
  validado por autoridad.
- **Cold start:** el índice arranca con los factores oficiales (§3.1); el reporte aporta señal local
  casi en tiempo real a medida que llegan datos.
- **Aporte estratégico:** genera **dato georreferenciado propio** → habilita la calibración por datos
  y la GWR (§4.2) **sin depender exclusivamente de la DIJIN**. Es la vía para *resolver*, no solo
  *declarar*, la limitación de validación.
- **Sesgos a declarar:** zonas con más usuarios reportan más → mitigado con normalización por
  población/uso y con `verif_r`; moderación, rate-limit y anonimización (Ley 1581/2012).

---

## 7. Dimensión temporal

El riesgo es **dinámico**: `TEMP(h)` modula el índice según la hora [R3]. Hoy la **curva por hora es un
supuesto informado por la literatura nacional** (las bases públicas no traen la hora del hecho); el
**día** sí es local (homicidios de Tumaco). Está aislado y **calibrable** con microdato o reporte
ciudadano. La limitación de que la modulación fuera **uniforme en el espacio** (no desplazaba los
*hotspots* por hora) está **resuelta a nivel de framework**: cada factor declara su
`temporal_profile` en la configuración — `flat` (curva CEJ global), `night_up` (sube de noche:
periferia/iluminación, por menor vigilancia natural) o `nightlife` (franja 19:00–02:00 de los POIs
generadores). Con perfiles distintos el índice es `Σ w_i·TEMP_i(h)·pctl(F_i)` y el **ranking
espacial cambia con la hora sin microdato**. En la configuración de Tumaco que respalda las cifras
de la tesis todos los factores usan `flat` (equivalente exacto al modelo original, golden test);
activar perfiles distintos es un **escenario declarado** que exige re-correr pipeline y regenerar
figuras/tablas.

![Curva horaria del riesgo](img/risk_hour_curve.png)
*Figura 6. Modulador horario `TEMP(h)`: el riesgo de cada zona varía con la hora de llegada.*

---

## 8. Estado actual vs. meta (honesto, para la discusión)

- **Hoy (Tumaco):** la discriminación intra-urbana viene de los 4 factores activos (§3.1) × `TEMP(h)`.
  Los factores socioeconómico, POIs e iluminación están **definidos pero desactivados** por
  homogeneidad o falta de dato (§3.2) — **decisión documentada, no omisión**.
- **Para robustez plena:** (a) censo DANE a nivel **manzana** (socioeconómico intra-urbano);
  (b) **POIs correctos** (bares/licor) de OSM/Overpass; (c) **iluminación**; (d) **dato de resultado
  georreferenciado** (DIJIN **o** reporte ciudadano) para calibrar pesos con RTM/GWR y romper la
  circularidad delito≈actividad.
- Declararlo **aumenta** la validez: es un marco RTM **correctamente especificado y configurable**,
  cuya precisión crece con la granularidad del dato y cuya adaptabilidad ya se demostró en Cali.

---

## 9. Limitaciones de validez y ética

- El índice es **fundamentado y robusto (ρ ≈ 0,99), no un predictor validado** contra verdad-terreno:
  no hay precisión/recall contra incidentes reales porque no hay microdato georreferenciado. Es la
  limitación #1, **declarada**; su cierre depende de dato de resultado (DIJIN o reporte ciudadano).
- Datos de movilidad **simulados** (SUMO): exposición realista, no GPS real.
- Curva horaria = **supuesto** [R3], no microdato local.
- **Correlación ≠ causalidad:** el índice señala *condiciones de riesgo del entorno*, no culpa a
  territorios ni personas; uso **preventivo**, hablando de **exposición relativa** (nunca "seguro"),
  evitando estigmatización [R5]. Tratamiento de datos conforme a la **Ley 1581 de 2012**; reportes
  ciudadanos anonimizados.

---

## 10. Aporte a la tesis

El IRU es un **índice compuesto, multivariable, espacio-temporal, configurable y auditable**,
fundamentado en criminología ambiental (RTM, actividades rutinarias, espacio defendible, patrón
delictivo, CPTED). Su valor no está en un pesaje fijo, sino en el **framework replicable**: un registro
de factores que se **habilita, pondera y calibra por contexto**, con cada decisión **trazable y
documentada** (incluido *por qué* un factor se desactiva en Tumaco). Tumaco y Cali son dos
configuraciones del mismo modelo — esa **adaptabilidad** es la contribución.

---

## Referencias

- [R1] J. M. Caplan y L. W. Kennedy, *Risk Terrain Modeling Compendium*. Newark, NJ: Rutgers Center on Public Security, 2011.
- [R2] J. M. Caplan, L. W. Kennedy y J. Miller, "Risk terrain modeling: Brokering criminological theory and GIS methods for crime forecasting," *Justice Quarterly*, vol. 28, no. 2, pp. 360–381, 2011.
- [R3] L. E. Cohen y M. Felson, "Social change and crime rate trends: A routine activity approach," *American Sociological Review*, vol. 44, no. 4, pp. 588–608, 1979.
- [R4] C. R. Shaw y H. D. McKay, *Juvenile Delinquency and Urban Areas*. Chicago, IL: Univ. of Chicago Press, 1942.
- [R5] R. J. Sampson, S. W. Raudenbush y F. Earls, "Neighborhoods and violent crime: A multilevel study of collective efficacy," *Science*, vol. 277, no. 5328, pp. 918–924, 1997.
- [R6] P. L. Brantingham y P. J. Brantingham, "Criminality of place: Crime generators and crime attractors," *European J. on Criminal Policy and Research*, vol. 3, no. 3, pp. 5–26, 1995.
- [R7] J. Jacobs, *The Death and Life of Great American Cities*. New York, NY: Random House, 1961.
- [R8] O. Newman, *Defensible Space: Crime Prevention Through Urban Design*. New York, NY: Macmillan, 1972.
- [R9] B. C. Welsh y D. P. Farrington, "Effects of improved street lighting on crime: A systematic review," *Campbell Systematic Reviews*, vol. 4, no. 1, pp. 1–51, 2008.
- [R10] A. S. Fotheringham, C. Brunsdon y M. Charlton, *Geographically Weighted Regression*. Chichester, UK: Wiley, 2002.
- [T0] A. O. Calderón Romero, *Base de simulación de movilidad (red vial de Tumaco + generación de trayectorias SUMO)*, Universidad de Nariño. https://github.com/aocalderon/Research/tree/master/Scripts/SUMO

> Indicadores de Tumaco: DNP, TerriData, entidad 52835 (`Research/.../TerriData52835f.xlsx`).
