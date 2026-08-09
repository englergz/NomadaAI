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
| **T3** | Amplitud de la curva horaria **×1,79** | **×1,170 efectiva** (la que gobierna alertas y niveles) · **×1,408** en el campo `risk` servido | ver §1.2 | `/tmp/curva_horaria.json` · `662a4cd1f05f0feff…` |
| **T3** | Hora pico | **19:00** (valle 03:00) | idem | idem |
| **T6b** | «El factor socioeconómico aporta» *(afirmado sin evidencia)* | **ρ(con, sin) = 0,4335 en Tumaco · 0,8612 en Cali** | ver §1.3 | endpoint `/risk/zones` ambas ciudades |
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

**Corrección a la auditoría:** el hallazgo original decía que la curva son «24 literales
escritos a mano en `build_risk_spatiotemporal.py:11` sin script de derivación». **No es
así en el código servido**: `risk.py:86-90` la deriva del propio artefacto
(`hmean[h]/peak`, media de riesgo por hora sobre el pico). Es reproducible, no literal.

### 1.3 · T6b — Cali no circular (el de mayor valor estratégico)

Mide cuánto reordena el factor socioeconómico el ranking de riesgo, comparando el índice
**con** y **sin** ese factor (pesos renormalizados). No usa la vulnerabilidad como
referencia, así que **no es circular**.

| Ciudad | n celdas | ρ(con socioec., sin socioec.) | Lectura |
|---|---|---|---|
| **Tumaco** | 475 | **0,4335** | el factor **reordena** el mapa |
| **Cali** | 4.268 | **0,8612** | el factor **casi no cambia** el mapa |

> **Este es el aporte original que hoy se afirma sin evidencia, y sale a favor.** En
> Tumaco quitar el factor socioeconómico cambia el orden de riesgo de forma sustancial
> (ρ=0,43); en Cali el índice queda casi igual (ρ=0,86), porque los factores geométricos
> dominan en una malla metropolitana. Es decir: **el componente socioeconómico es
> necesario precisamente en la ciudad del estudio**, y sería prescindible en una capital.
> Es un resultado defendible y no autocumplido.

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
| 85,8 % masculino | **91,1 %** (3.661/4.018) | **no reproduce** |
| 55,2 % / 44,8 % urbano-rural | **45,0 % urbana / 55,0 % rural** | magnitud correcta, **pero verificar que las etiquetas no estén invertidas** en el documento |
| Serie anual 2019 = 216 | **216** | ✅ reproduce |
| Arma / modalidad | **columna inexistente** | **sin fuente: retirar** |

> **Recomendación.** (a) Retirar arma/modalidad salvo que aparezca el archivo original.
> (b) Volver a descargar el crudo, versionarlo con sha256 en `GOLDEN.md` y regenerar el
> derivado desde él. (c) Revisar en el documento si el 55,2 % está etiquetado como urbano
> —sería una inversión—, porque el dato real es 55,0 % **rural**. (d) Corregir 85,8 → 91,1 %.

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
