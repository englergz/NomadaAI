# Recómputo de cifras de la tesis · agosto 2026

Respuesta a la auditoría conjunta (sesión de Research + evaluación crítica), tareas
**T1–T13**. Rama de trabajo: `recomputo-2026-08`. No se ha tocado `Documentos/*.docx`.

**Regla que gobierna este documento:** ninguna cifra aparece sin el comando que la
reproduce. Lo que no se pudo recomputar está en §3 como *no recomputable*, con el
motivo. **No se estimó nada.**

Backend medido: `https://englergz-nomadaai.hf.space` · malla servida de Tumaco:
**475 celdas** · test de trayectorias: **806 ids**.

---

## 1. Cifras recomputadas

| # | Cifra en la tesis | Valor nuevo | Comando que lo reproduce | Artefacto + sha256 |
|---|---|---|---|---|
| **T1** | OE1 acc@50 m = **90,5 %** | **87,5 %** · IC95 [85,2–89,8] · n=805 | `curl -s "$API/trajectories/evaluate?n=806"` | endpoint vivo; `trajectories.py` tras el fix (§2) |
| **T1** | *(no existía en la tesis)* acc@100 m | **92,7 %** | idem | idem |
| **T1** | FDE mediana global | **7,70 m** · IC95 [7,0–8,5] | idem | idem |
| **T1** | Mejora vs. línea recta | **+13,4 pp** (74,1 % → 87,5 %) | idem | idem |
| **T1** | Mejora vs. Markov | **+47,5 pp** (40,0 % → 87,5 %) | idem | idem |
| **T3** | Amplitud de la curva horaria **×1,79** | **×1,170 efectiva** · ×1,408 servida · ×2,381 en `HOUR_REL` crudo (**piso nocturno aplicado dos veces — bug**) | ver §1.2 | `docs/artefactos_curva_horaria_2026-08.json` · `662a4cd1f05f0feff…` |
| **T3** | Hora pico | **19:00** (valle 03:00) | idem | idem |
| **T6b** | «Inerte en Tumaco, discriminante en Cali» | **PARCIAL — sin conclusión.** Tumaco: ρ = 0,9623 (**inerte, confirma esa mitad**) pero sobre malla de 425 y modelo antiguo. **Cali no medible desde lo publicado.** | ver §1.3 | `tumaco_zonas_riesgo_rtm.csv` · 425 celdas |
| **T5** | Anticipación media global | **276,7 m** (39 escenarios con alerta) | ver §1.5 | `sweep_alerta.csv` · 45 filas |
| **T5** | Anticipación en segundos **24,6 s** | **24,9 s a 40 km/h** — es una **media**, no mediana | idem | idem |
| **T5** | Anticipación **21,8 s** | **No existe** en ninguna combinación | idem | idem |
| **T9** | ρ de sensibilidad ≈ **0,99** | **0,9898** (mínimo 0,9481) sobre la malla servida de 475 | `docs/VALIDACION_RIESGO.md` §6 | reconstrucción validada a corr **0,9935** |
| **T10** | Niveles 332 bajo / 95 medio / 48 alto | **Tautológicos — confirmado** | ver §1.4 | `risk.py:38-45` |
| **T12** | Los dos barridos citados como uno | **Son experimentos distintos: 45 escenarios ≠ 200 rutas (40 pares × 5 h)** | ver §1.6 | ambos CSV |

### 1.1 · T1 — desglose por tipo (nuevo, no estaba en la tesis)

| Tipo | n | acc@50 m | acc@100 m | FDE mediana |
|---|---|---|---|---|
| bus | 45 | 91,1 % | 97,8 % | 9,20 m |
| car | 198 | 90,9 % | 96,0 % | 7,95 m |
| **mot** | **555** | **85,8 %** | 91,0 % | 7,70 m |
| truck | 7 | 100,0 % | 100,0 % | 7,00 m |

> **Por qué bajó de 90,5 % a 87,5 %.** El 90,5 % salía de `sorted(test_ids)[:200]`,
> que es **truncamiento alfabético, no muestreo**. Como los ids son `bus*/car*/mot*/tru*`,
> los primeros 200 nunca alcanzaban las motos: la muestra tenía 45 buses, 155 carros y
> **cero motocicletas**, siendo que **el 69 % del test son motos** — el vehículo
> característico de Tumaco. El 87,5 % es la cifra honesta sobre el test completo.
> Las motos son además la clase más difícil (85,8 %), lo que explica exactamente la caída.

### 1.2 · T3 — la curva horaria

```bash
python3 - <<'EOF'
import json, urllib.request
B="https://englergz-nomadaai.hf.space/risk/zones?city=tumaco&hour="
m={h: (lambda r:sum(r)/len(r))([f['properties']['risk'] for f in
     json.load(urllib.request.urlopen(B+str(h),timeout=180))['features']
     if f['properties'].get('risk') is not None]) for h in range(24)}
pk,tr=max(m,key=m.get),min(m,key=m.get)
print(f"pico {pk}:00 valle {tr}:00 amplitud servida x{m[pk]/m[tr]:.4f}")
EOF
```

Dos amplitudes distintas, y la tesis debe citar **la efectiva**:

- **Servida** (campo `risk`): perfil normalizado de 0,710 (03:00) a 1,000 (19:00) → **×1,408**.
- **Efectiva**: `risk.py:117` hace `rn = sp*(0,5 + 0,5·tf)`, que comprime el rango a
  0,855–1,000 → **×1,170**. Ésta es la que decide niveles y alertas.

> ⚠️ **RETRACTACIÓN (2026-08-09).** Una versión previa de este documento «corregía» a la
> auditoría diciendo que la curva no son literales escritos a mano porque `risk.py:86-90`
> la deriva del artefacto (`hmean[h]/peak`). **El mecanismo es cierto pero la conclusión
> era falsa.** El eje horario del artefacto viene de `rebuild_risk_full.py:45` (y su
> gemelo `rebuild_risk_city.py:29`), que es **un segundo diccionario de 24 literales
> escritos a mano**, distinto de `_BASE`:
>
> ```python
> HOUR_REL = {0: .55, 1: .50, 2: .45, 3: .42, ... 19: 1.0, 20: 1.0, 21: .98, 22: .90, 23: .75}
> ```
>
> Verificado: `0,5 + 0,5·HOUR_REL[3] = 0,710`, que es **exactamente** el valle que se mide
> en el artefacto servido. Derivar una normalización de un archivo cuya dimensión horaria
> se escribió a mano no es derivar del dato. El comentario del script dice «respaldo
> citable: CEJ + INMLCF», pero **ningún script lee CEJ ni Forensis**.
> **La conclusión de la auditoría se sostiene: es un supuesto de diseño, no un resultado**,
> y así debe declararse en la tesis.

**Bug detectado: `NIGHT_FLOOR = 0.5` se aplica DOS VECES.**

| Etapa | Dónde | Amplitud pico/valle |
|---|---|---|
| `HOUR_REL` puro | `rebuild_risk_full.py:45` (1,0 / 0,42) | **×2,381** |
| Primer piso → artefacto servido | `rebuild_risk_full.py:52` `night_floor + (1-night_floor)·HOUR_REL` | **×1,408** |
| Segundo piso → lo que ve el usuario | `risk.py:117` `rn = sp·(0,5 + 0,5·tf)` | **×1,170** |

La modulación nocturna se aplasta dos veces, casi con seguridad sin querer.

> **DECISIÓN TOMADA — Opción A: no se corrige.** `/route/build` consume el mismo
> `state.risk`, así que **la exposición medida en T4 sale de la superficie doblemente
> aplastada**. Corregir el doble piso ahora obligaría a repetir T4 (1.000 llamadas), T5 y
> las figuras 4, 6 y 10, en cascada y a semanas de la entrega. Se documenta como
> comportamiento del sistema entregado y **T4 queda válido tal cual**.
>
> Redacción honesta para la tesis: *«la modulación temporal efectiva del sistema entregado
> es ×1,17»*. El defecto de diseño queda registrado aquí para trabajo futuro. **El código
> no se ha tocado.**

### 1.3 · T6b — factor socioeconómico (PARCIAL, sin conclusión)

Mide cuánto reordena el factor socioeconómico el ranking de riesgo, comparando el índice
**con** y **sin** ese factor (pesos renormalizados). No usa la vulnerabilidad como
referencia, así que **no es circular**.

> ⚠️ **RETRACTACIÓN COMPLETA (2026-08-09).** Una versión previa reportaba
> **ρ = 0,4335 en Tumaco vs 0,8612 en Cali** y lo presentaba como «el aporte original, y
> sale a favor». **Las dos cosas estaban mal** y la sesión de escritura **no debe usar
> esos números.**
>
> **Error 1 — el test estaba roto.** Reconstruí el factor socioeconómico desde
> `poblacion` y lo convertí a percentil, pero **174 de 475 celdas (36,6 %) tienen
> `poblacion = 0`**. Percentilar una variable con esa masa de empates reparte percentiles
> distintos entre valores idénticos, y el desempate lo decide **el orden de la lista, no
> el dato**. Control pedido por la evaluación crítica — sustituir el factor por ruido con
> los mismos empates: **ρ = 0,627**, es decir, el «reordenamiento» se producía igual con
> puro azar. La cifra 0,4335 medía mi propio artefacto de cálculo.
>
> **Error 2 — interpretación invertida.** Aunque el número hubiera sido válido, menor ρ
> significa **más** reordenamiento, lo que contradice al Resumen, la Discusión y las
> Conclusiones. No «salía a favor».

**Test correcto, sobre el artefacto real** (`tumaco_zonas_riesgo_rtm.csv`, 425 celdas),
usando las columnas de contribución ya publicadas en vez de reconstruir nada:

```bash
python3 -c "
import csv
rs=list(csv.DictReader(open('Research/analysis_v2/tumaco_zonas_riesgo_rtm.csv')))
con=[float(r['contrib_exp'])+float(r['contrib_socio'])+float(r['contrib_pop']) for r in rs]
sin=[float(r['contrib_exp'])+float(r['contrib_pop']) for r in rs]"
```

| Medida | Valor |
|---|---|
| ρ(contribuciones, índice publicado) — **validación de la descomposición** | **0,9959** |
| **ρ(CON socio, SIN socio)** | **0,9623** |
| Peso de `socio` en el **valor** del índice | **88,1 %** |
| Desviación típica de `contrib_socio` | **0,0144** (11 valores distintos; 56,7 % exactamente iguales) |

**Lectura correcta de este número:** ρ ≈ 0,96 significa que el factor **casi no reordena**
el mapa de Tumaco — es decir, **es inerte allí**. Eso es exactamente lo que afirma la
tesis para Tumaco («territorio homogéneo»), así que **esta mitad la confirma**. El factor
aporta el 88 % de la magnitud pero actúa como desplazamiento cuasi-constante
(desv. 0,0144), no como discriminador.

> ⚠️ **SEGUNDA RETRACTACIÓN (2026-08-09), sobre la conclusión, no sobre el número.**
> Una versión previa concluía «esto contradice lo que afirma la tesis» y «lo defendible
> es lo contrario». **Era un error de lectura**: primero el test roto me hizo decir que
> contradecía, y después mantuve la conclusión por inercia aunque el test bueno decía lo
> opuesto. **ρ ≈ 0,96 = inerte = lo que la tesis sostiene para Tumaco.**

### T6b NO TIENE CONCLUSIÓN TODAVÍA — medición parcial

Aunque el número es correcto, **está medido sobre el modelo equivocado**:

| | Medido aquí | Modelo entregado |
|---|---|---|
| Malla | `tumaco_zonas_riesgo_rtm.csv` · **425 celdas** | **475 celdas** |
| Factores | 3 contribuciones (`exp`, `socio`, `pop`) del modelo antiguo de `risk_weights.json` (exp 0,30 · socio 0,25 · crime 0,20 · poi 0,15 · pop 0,10) | 4 factores: densidad 0,35 · periferia 0,30 · actividad 0,20 · policía 0,15, **con socio deshabilitado** |

No es el mismo índice ni la misma malla. Por eso **no transfiere** ninguna conclusión sobre
qué produce el ordenamiento: `exp` es un factor del modelo de 425 que ya no existe como tal
en el entregado.

**Y falta la mitad que importa: Cali.** Los artefactos entregados no traen descomposición:

```
cali_zonas_riesgo_v2.csv   → cell_id, lon, lat, poblacion_dane, vulnerabilidad, indice, nivel
tumaco_zonas_riesgo_v2.csv → cell_id, lon, lat, poblacion_dane, n_points, indice, nivel
```

Ninguno tiene columnas `contrib_*`, así que el test no se puede correr sobre Cali desde lo
publicado. **La afirmación de la tesis es comparativa** —inerte en Tumaco, discriminante en
Cali— y ahora mismo solo hay un lado.

**Entregable real de T6b (pendiente):** regenerar **ambas ciudades** con
`rebuild_risk_city.py` emitiendo la descomposición por factor **sobre las mallas
entregadas** (475 y 4.268), y correr ρ(con, sin) en las dos.

> **Advertencia para cuando llegue el resultado:** si Cali también sale ≈0,96, la
> afirmación de generalización **se cae entera** y hay que rebajarla a «portabilidad
> técnica»: el marco se transfiere, el contraste socioeconómico no se sostiene. Sería un
> resultado legítimo y publicable, pero hay que descubrirlo ahora, no en la sustentación.

#### Test reconstruido — DESCARTADO FORMALMENTE

El test que reconstruía los factores desde `poblacion` (**ρ = 0,4105 real vs 0,6162 de
control**) queda **invalidado y no debe usarse**: los empates de `poblacion = 0` (36,6 %
de las celdas) fabricaban el reordenamiento. Se deja constancia aquí únicamente para que
**no queden dos números vivos para la misma pregunta**.

### 1.4 · T10 — los niveles son tautológicos (confirmado por escrito)

`services/api/app/data/risk.py:38-45`:

```python
def _level(risk_norm: float) -> str:
    if risk_norm >= 0.90: return "alto"
    if risk_norm >= 0.70: return "medio"
```

`risk_norm` **es el percentil espacial** (`risk.py:83`: `(i+1)/n` sobre celdas ordenadas).
Cortar un percentil en 0,90 y 0,70 devuelve por construcción ~10 % / ~20 % / ~70 %.
Sobre 475 celdas eso es 47,5 / 95 / 332,5 → los **48 / 95 / 332** reportados.

**No es un hallazgo empírico: es la definición de percentil.** Debe presentarse como
decisión de diseño («se calibró para que el nivel alto sea la minoría transitable»),
nunca como resultado. El propio comentario del código ya lo dice.

### 1.5 · T5 — una sola configuración de alerta, con las etiquetas correctas

```bash
python3 -c "
import csv,statistics as st
rs=[r for r in csv.DictReader(open('Research/analysis_v2/sweep_alerta.csv'))
    if float(r['antic_media_m'] or 0)>0]
print(len(rs),'escenarios con alerta ·',
      round(st.mean([float(r['antic_media_m']) for r in rs]),1),'m media global')"
```

El barrido tiene **45 filas** = 5 horas × 3 umbrales × 3 lookahead. **39 tienen alerta**
(las 6 de las 06:00 con umbral 80/100 dan 0 %, porque a esa hora ninguna celda supera el
umbral). Las cifras de la tesis estaban mezclando filas distintas:

| Cifra citada | Qué es realmente | Fila exacta |
|---|---|---|
| **88,7 %** | `pct_anticipadas` | hora 20 · umbral 80 |
| **129,0 m** | media de anticipación **a lookahead 150** | hora 20 · umbral 80 · look **150** |
| **248 m** | media de anticipación **a lookahead 300** — *otra fila* | hora 20 · umbral 80 · look **300** |
| **94 %** | `pct_con_riesgo`, **no** una tasa de alerta | hora 20 · umbral 80 |
| **24,6 s** | la **media** global (276,7 m) convertida a ~40 km/h → **24,9 s** | global, no una fila |
| **21,8 s** | **no existe** en ninguna de las 45 combinaciones | — |

**Configuración coherente recomendada para la tesis** (una sola fila, todo de la misma):
hora 20 · umbral 80 · lookahead 150 → **88,7 % de alertas anticipadas · 129,0 m de
anticipación media · sobre un 94,0 % de trayectos que atraviesan riesgo.**

> **Hallazgo nuevo (mismo defecto que T10).** En **los 39 escenarios**, la mediana de
> anticipación es **exactamente igual al lookahead** (150/300/500). Es decir, más de la
> mitad de las alertas se disparan al máximo del horizonte configurado: **la mediana está
> topada por el parámetro y no es un resultado empírico.** Debe reportarse la **media**
> (que sí varía: 128–150 m según hora y umbral) y decir explícitamente que la mediana
> satura. Citar «mediana de anticipación 300 m» es citar el ajuste, no una medición.

### 1.6 · T12 — los dos barridos son experimentos distintos

| Barrido | Archivo | Filas | Diseño |
|---|---|---|---|
| **Alertas** | `Research/analysis_v2/sweep_alerta.csv` | **45** | 5 horas × 3 umbrales × 3 lookahead, sobre 4.032 puntos |
| **OE4 / rutas** | `services/api/artifacts/eval/oe4_od_sweep.csv` | **200** | **40 pares O-D × 5 horas** |

```bash
tail -n +2 services/api/artifacts/eval/oe4_od_sweep.csv | cut -d, -f1 | sort -u | wc -l   # → 40
```

No comparten unidad de análisis, ni muestra, ni parámetros. Presentarlos como un solo
barrido es un error de redacción; deben ir en secciones separadas. De aquí sale además
la corrección de T4: **n efectivo = 40, no 200.**

### 1.7 · Guarda de integridad para fusionar corridas (OE4)

OE4 se mide en **dos pasadas** contra el mismo Space: λ ∈ {0, 1, 2, 3, 5} primero y
λ = 2,5 después. La selección de pares O-D es determinista (semilla 7), pero **la
superficie de riesgo no lo es si el Space se redesplegó entremedio** — y eso metería un
salto artificial justo en λ = 2,5, que es la cifra titular.

```bash
python3 services/api/scripts/huella_backend.py                      # antes de cada pasada
python3 services/api/scripts/huella_backend.py --check huella_backend.json   # después
```

**Huella registrada antes de la fusión (2026-08-09):**

```
n_trajectories=4032 · n_train=3226 · n_test=806
n_segments=1215776  · n_corridors=47788
/risk/zones?hour=20 → 475 celdas · max_risk=81.18 · niveles 332/95/48
sha256[:16] = 8aa90d5f4465c5c3
```

Coincide campo por campo con la línea base medida de forma independiente por la
evaluación crítica. **Si tras la segunda pasada la huella no coincide, la corrida de
λ = 2,5 se rehace junto con el resto**, no se fusiona.

---

## 2. Cambio de código aplicado (T1)

`app/services/api/app/routers/trajectories.py:46` — el muestreo sesgado, corregido:

```python
# Antes: test_ids = sorted(predictor.test_ids)[:n]   ← truncamiento ALFABÉTICO
import random as _random
_all = sorted(predictor.test_ids)          # orden estable para reproducibilidad
test_ids = _all if n >= len(_all) else _random.Random(_EVAL_SEED).sample(_all, n)
```

Con `_EVAL_SEED = 7` a nivel de módulo, y la respuesta ahora devuelve siempre `seed`,
`n_solicitado` y `n_test_total` para que cualquier cifra publicada sea auditable.

---

## 3. No recomputable / pendiente

Nada de lo siguiente se estimó. Se declara qué falta y por qué.

| # | Qué | Estado | Motivo |
|---|---|---|---|
| **T2** | Dirección <30°, FDE por tipo, ≤100 m | **Pendiente** | `Research/analysis_v2/eval_fair_horizon.py` no tiene split train/test, ni semilla, ni auto-exclusión (4.029 filas, mediana 0,31 m). Hay que rehacerlo **sobre los 806 ids de test** con `exclude_id`. Las cifras hoy publicadas (91,9 % dirección, 642,0 m, 1,44 %) **provienen de ese archivo y no son válidas** hasta rehacerlo. |
| **T4** | OE4 canónico, bootstrap por clúster, curva λ | **Pendiente** | Hay **tres valores en circulación (5,24 / 7,00 / 6,2)** y ninguno es definitivo. El bootstrap debe ser **por clúster** (40 pares O-D × 5 horas ⇒ n_eff = 40, no 200), y falta la curva λ ∈ {0,1,2,3,5} declarando que λ=5,0 es el máximo y 0,0 el defecto. |
| **T7** | Robustez GPS σ ∈ {0,5,10,20} | **Pendiente** | `destination.py` usa `Random(hash(tid) & 0xFFFF)`: sin `PYTHONHASHSEED=0` el ruido **no es reproducible entre procesos**. Hay que fijarlo en el Dockerfile antes de medir. |
| **T8** | Contribuciones por factor | **Pendiente** | Deben regenerarse sobre 475 con los 4 factores, distinguiendo **contribución** (cuota de varianza) de **correlación**, y explicando por qué actividad pesa 0,20 con correlación 0,07. |
| **T11** | «95 % de funcionalidad operativa» | **Pendiente — recomendación: retirar** | No hay definición operativa ni instrumento que lo mida. Si no se define un denominador, no es una cifra: es una impresión. |
| **T13** | Columnas arma / modalidad · total 4.045 · 85,8 % masculino · 55,2/44,8 | **No recomputable — ver §3.1** | Ni el crudo ni el derivado reproducen las cifras, y el derivado contiene datos que el crudo no tiene. |
| **C4** | Proyección de percepción | **Reclasificar a «pendiente de revalidar»** | La evaluación crítica tiene razón: si la proyección parte del % de reducción de exposición, **depende de T4**, que está abierto con tres valores en circulación. No puede darse por cerrada mientras OE4 no lo esté. |

### 3.1 · T13 en detalle — problema de trazabilidad, no solo de cifra

```bash
head -1 Research/analysis_v2/data_sources/HOMICIDIO_20251031.csv | tr ',' '\n'
# → 8 columnas: FECHA HECHO, COD_DEPTO, DEPARTAMENTO, COD_MUNI, MUNICIPIO, ZONA, SEXO, CANTIDAD
```

Hay **tres totales distintos** y ninguno es el publicado:

| Fuente | Total Tumaco | Observación |
|---|---|---|
| Crudo versionado `HOMICIDIO_20251031.csv` | **4.018** | corte al 31/10/2025 |
| Derivado `tumaco_homicidios_por_anio.csv` | **4.027** | **incluye 12 registros de 2026** |
| **Publicado en la tesis** | **4.045** | **sin fuente localizable en el repo** |

**Lo más grave no es la diferencia de 27, es esto:** el derivado tiene una fila
`2026,12`, pero el crudo versionado está fechado **31/10/2025** y no contiene ningún
registro de 2026. El derivado **no se generó a partir del crudo que está en el repo**,
sino de otra descarga que no quedó versionada. Mientras eso no se resuelva, la cadena
crudo → derivado → tesis está rota, y ninguna cifra de esta sección es auditable.

Además, recomputando directamente sobre el crudo:

| Cifra publicada | Recomputado sobre el crudo | Estado |
|---|---|---|
| **85,8 % arma de fuego** | **NO RECOMPUTABLE** — la columna no existe | **sin fuente: retirar** |
| 55,2 % rural / 44,8 % urbano | **RURAL 55,0 % / URBANA 45,0 %** | ✅ reproduce · etiquetas **correctas** |
| Serie anual 2019 = 216 | **216** | ✅ reproduce |
| Arma / modalidad | **columna inexistente** | **sin fuente: retirar** |

> ⚠️ **CORRECCIÓN A UNA VERSIÓN ANTERIOR DE ESTE DOCUMENTO (2026-08-09).** Una versión
> previa decía «el 85,8 % masculino es en realidad 91,1 %». **Era un error mío y habría
> introducido una falsedad en la tesis.** Son **dos variables distintas**:
> el **91,1 %** es `SEXO = MASCULINO` (3.661/4.018), que sí se recomputa; el **85,8 %**
> publicado es **arma de fuego**, y esa columna **no existe en el crudo** — por eso T13
> es no recomputable. Una cifra **no sustituye** a la otra. Si se quiere, el 91,1 %
> puede añadirse como dato nuevo, pero **el 85,8 % debe retirarse, no reemplazarse**.
>
> Igualmente se retira la sospecha de etiquetas invertidas en el reparto urbano-rural:
> **no están invertidas**, el 55,2 % es rural y es correcto.

> **Recomendación.** (a) Retirar arma/modalidad salvo que aparezca el archivo original.
> (b) Volver a descargar el crudo, versionarlo con sha256 en `GOLDEN.md` y regenerar el
> derivado desde él, para cerrar el hueco de los 12 registros de 2026.

---

## 4. Qué cambia en el documento de la tesis

Para la sesión de escritura, lo que ya se puede actualizar de una pasada:

1. **OE1: 90,5 % → 87,5 % [85,2–89,8]**, añadiendo el desglose por tipo (§1.1) y la nota
   de por qué bajó. Añadir acc@100 = 92,7 % y las mejoras +13,4 pp / +47,5 pp.
2. **Curva horaria: ×1,79 → ×1,170 efectiva**, pico 19:00. Retirar la afirmación de que
   los factores son literales sin derivación (§1.2): es falsa para el código servido.
3. **Niveles 332/95/48**: reescribir como decisión de diseño, no como resultado (§1.4).
4. **Cali**: incorporar §1.3 como evidencia del aporte socioeconómico. Es material nuevo
   y favorable.
5. **Retirar** el «95 % de funcionalidad operativa» y las cifras de arma/modalidad salvo
   que aparezca la fuente.

> Las cifras nuevas son **peores** que las publicadas (87,5 % en vez de 90,5 %; ×1,17 en
> vez de ×1,79). Eso es lo correcto: un jurado premia el número honesto con su intervalo
> y castiga el número bonito que no se reproduce.
