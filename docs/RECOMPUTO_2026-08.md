# Recómputo de cifras de la tesis · agosto 2026

Respuesta a la auditoría conjunta (sesión de Research + evaluación crítica), tareas
**T1–T13**. Rama de trabajo: `recomputo-2026-08`. No se ha tocado `Documentos/*.docx`.

**Regla que gobierna este documento:** ninguna cifra aparece sin el comando que la
reproduce. Lo que no se pudo recomputar está en §3 como *no recomputable*, con el
motivo. **No se estimó nada.**

Backend medido: `https://englergz-nomadaai.hf.space` · malla servida de Tumaco:
**475 celdas** · test de trayectorias: **806 ids**.

---

> ✅ **RESUELTO (2026-08-10).** El arreglo está desplegado y verificado entre reinicios.
> **OE1 remedido: idéntico (87,5 %).** **T4 rehecho sobre los pares nuevos: 1.200/1.200 rutas, cero fallos.**
> Queda T7 (robustez GPS). Se conserva el texto siguiente como registro de por qué hubo que rehacerlo.
>
> ⛔ (histórico) **BLOQUEANTE 2026-08-09: OE1, T4 y T7 hay que REHACERLOS tras redesplegar.**
> Se encontró la **causa raíz** de que barridos «con semilla fija» dieran resultados
> distintos: `destination.py` iteraba `set`s de cadenas antes de barajar, y el orden de un
> `set` depende del salt de hash del proceso. **Con la misma semilla, cada reinicio del
> Space devolvía otros pares O-D.** Arreglado (§2.1), pero **el arreglo exige redesplegar**
> y **los barridos deben repetirse después**: si se congelan ahora, nadie que reproduzca el
> comando obtendrá estos números — que es exactamente el reproche que originó esta auditoría.
>
> **El alcance incluye OE1**, no solo T4/T7: `destination.py:141` cambia el orden de
> construcción del KDTree, y ese orden decide el desempate cuando dos vecinos están a igual
> distancia. **Las predicciones pueden moverse.** El **87,5 %** de T1 quedaría medido sobre
> un backend distinto del que queda desplegado, así que hay que **remedirlo**. Las **medias siguen siendo estimadores insesgados**; lo que no es válido
> es la reproducibilidad puntual ni ninguna afirmación de máximo.

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
| **T6b** | «Inerte en Tumaco, discriminante en Cali» | **CERRADO — NO CONCLUYENTE.** Tumaco ρ=0,9841 (**inerte, confirmado, dentro del ruido**); Cali ρ=0,8491 (**efecto débil, no alcanza para «discriminante»**). La afirmación B se rebaja; la A queda intacta | `docs/T6B_CRITERIO.md` | `t6b_socioeconomico.csv` · `87b9cfb0b286f958…` |
| **T4** | OE4 «reducción de exposición» (5,24 / 6,2 / 7,00 en circulación) | **4,84 % · IC95 [3,62–6,22] a λ=2,5** (default real, **verificado de forma cruzada**). Tope λ=5,0: 5,88 % [4,42–7,39] | `python3 services/api/scripts/oe4_lambda_canonico.py` | `oe4_lambda_canonico.csv` · `586432d572a289cb…` |
| **T4** | IC95 de OE4 (±0,5 pp) | **2,1× más ancho** con bootstrap por clúster: [5,81–8,27] sobre el mismo artefacto | idem | `oe4_od_sweep.csv` · `4f714482ea4b0bf7…` |
| **T4** | *(no existía)* sobrecosto de distancia | **1,7 % a λ=2,5** · 3,7 % a λ=5,0 | idem | idem |
| **T5** | Anticipación media global | **276,7 m** (39 escenarios con alerta) | ver §1.5 | `sweep_alerta.csv` · 45 filas |
| **T5** | Anticipación en segundos **24,6 s** | **24,9 s a 40 km/h** — es una **media**, no mediana | idem | idem |
| **T5** | Anticipación **21,8 s** | **No existe** en ninguna combinación | idem | idem |
| **T7** | Robustez GPS 90 / 82 / 72 / 60,6 | **87,5 / 77,4 / 63,7 / 47,7 %** con IC95 — **ninguna reproduce** (tesis: 90,5 / 85,5 / 72,5 / 55,0); el rango «72-86 %» del Resumen tampoco | ver §1.14 | endpoint vivo, tras `blake2b` |
| **T9** | ρ de sensibilidad ≈ **0,99** | **0,9898** (mínimo 0,9481) sobre la malla servida de 475 | `docs/VALIDACION_RIESGO.md` §6 | reconstrucción validada a corr **0,9935** |
| **T10** | Niveles 332 bajo / 95 medio / 48 alto | **Tautológicos — confirmado** | ver §1.4 | `risk.py:38-45` |
| **T13** | Arma de fuego 85,8 % · sicariato 56,6 % · rural/urbana 55,2/44,8 | **✅ REPRODUCEN EXACTO** contra la API `m8fd-ahd9`. Total 4.045 → **4.050** (conjunto vivo, congelado hoy) | ver §3.1 | snapshot `0f64efd4…2d75` · 4.034 filas |
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

### 1.8 · T4 — OE4 canónico: curva λ y bootstrap por clúster

```bash
python3 services/api/scripts/oe4_lambda_canonico.py
# artefacto: services/api/artifacts/eval/oe4_lambda_canonico.csv
# sha256 = 586432d572a289cba5285ee01bba9eaada4672e50db6d98b507579bc72e5522c
```

1.200 filas = **40 pares O-D × 5 horas × 6 valores de λ**, pares fijados con semilla 7.
**n efectivo = 40**, no 200: el bootstrap remuestrea pares completos arrastrando sus 5 horas.

| λ | Qué es | Reducción media | **IC95 (clúster, n_eff=40)** | Mediana | Mejoran | Sobrecosto dist. |
|---|---|---|---|---|---|---|
| 0,0 | sin ponderación — **ancla** | 0,00 % | [0,00 · 0,00] | 0,00 | 0,0 % | 0,0 % |
| 1,0 | | 3,28 % | [2,22 · 4,50] | 0,90 | 99,0 % | 0,5 % |
| 2,0 | | 4,50 % | [3,29 · 5,93] | 2,90 | 100,0 % | 1,4 % |
| **2,5** | **default real del producto** | **4,84 %** | **[3,62 · 6,22]** | 3,45 | 100,0 % | 1,7 % |
| 3,0 | | 4,91 % | [3,70 · 6,26] | 3,70 | 100,0 % | 1,8 % |
| 5,0 | tope de la barra | 5,88 % | [4,42 · 7,39] | 5,70 | 100,0 % | 3,7 % |

> **VERIFICACION CRUZADA INDEPENDIENTE (2026-08-10).** La evaluacion critica corrio su
> propia implementacion, sin reusar este script, y obtuvo a lambda=2,5: **media 4,84 %,
> mediana 3,45, 100,0 % mejoran**, IC95 [3,55 - 6,13]. **Coincide al segundo decimal.**
> La diferencia de centesimas en el IC es el RNG del bootstrap. **OE4 queda cerrado.**
>
> Una discrepancia previa (4,43 % frente a 4,84 %) se resolvio: este script pedia
> 100 viajes y tomaba 40 con muestreo sembrado -- determinista, pero **otra muestra**
> (solo 17 de 40 pares en comun con los 40 primeros del endpoint). Se adopto la
> definicion mas simple: **los N primeros que devuelve el endpoint, sin submuestreo**,
> que es la que reproduce cualquiera sin leer el script.

**Cifra titular de OE4 para la tesis: 4,84 % [3,62 – 6,22], λ = 2,5.** Es lo que recibe el
usuario de fábrica: ambos clientes arrancan la barra de protección al 50 % y
`lambdaForLevel(pct) = pct/20` (`packages/shared/src/protection.ts`), verificado en
`apps/web/src/App.tsx:217` y `apps/mobile/src/app/map.tsx:371`. **λ = 5,0 es el tope**
de la barra, no el valor de operación; **λ = 0,0 da 0,00 % por construcción** y sirve de
ancla de validez del montaje.

#### Por qué había «tres cifras en circulación» — resuelto

El artefacto original, recomputado con **ambos** métodos de bootstrap:

| Método sobre `oe4_od_sweep.csv` (λ=5,0) | Media | IC95 | Ancho |
|---|---|---|---|
| **Por fila** (lo publicado, n=200) | 7,00 % | [6,42 · 7,57] | 1,15 pp |
| **Por clúster** (correcto, n_eff=40) | 7,00 % | **[5,81 · 8,27]** | **2,46 pp** |

**El intervalo correcto es 2,1× más ancho.** Con él, las cifras dejan de ser
contradictorias: **7,00 % y 5,24 % caen ambas dentro del IC de la corrida canónica a
λ=5,0** ([4,06 · 7,40]). No eran mediciones incompatibles, sino **la misma cantidad sobre
muestras distintas de pares O-D**, con una variabilidad real de ~2,5 pp que el bootstrap
por fila ocultaba.

> **El problema nunca fue que los números no cuadraran: fue que un IC de ±0,5 pp fabricaba
> una precisión inexistente.** Mismo patrón que T5 y T10 — un artefacto del método
> presentado como resultado. La corrección honesta no es elegir una de las tres cifras,
> es **publicar el intervalo verdadero**.

**Material nuevo que la tesis no tiene:** el **sobrecosto de distancia** (0,3 % → 3,0 %
según λ) es el contrapeso honesto de la reducción de exposición, y responde por adelantado
a la pregunta obvia de sustentación: *«¿cuánto más largo es el camino seguro?»*.
A λ=2,5 la respuesta es **1,7 % más de distancia a cambio de 4,84 % menos de exposición.**

### 1.9 · T11 / C5 — funcionalidad operativa, con denominador

```bash
cd apps/mobile && npm test
```

```
PASS src/__tests__/desvio.test.ts
PASS src/__tests__/reanudacion.test.ts
PASS src/__tests__/alerts.test.ts
Test Suites: 3 passed, 3 total
Tests:       21 passed, 21 total
```

| Métrica | Valor |
|---|---|
| Pruebas aprobadas / ejecutadas | **21 / 21 (100 %)** |
| Suites aprobadas / ejecutadas | **3 / 3** |
| Fecha de ejecución | 2026-08-09 |

**Qué cubre realmente** (esto es el alcance que debe declararse, no «la app»):
alertas de zona de riesgo, recálculo por desvío de ruta y reanudación del viaje en segundo
plano.

> **El «95 % de funcionalidad operativa» debe retirarse.** No tiene denominador ni
> instrumento: no se sabe sobre cuántas funciones se calculó ni cómo se evaluó cada una.
> Lo sustituible por una cifra defendible es **21/21 pruebas automatizadas sobre tres
> módulos críticos**, declarando **explícitamente que es cobertura de esos tres módulos,
> no de la aplicación completa**. Una cifra pequeña y verdadera resiste la sustentación;
> una grande sin denominador, no.

### 1.10 · C4 / Figura 14 — el −36,2 % NO se reproduce

> ⚠️ **CORRECCIÓN (2026-08-09).** Una versión previa de esta sección afirmaba
> «techo estable en 19,30 %, independiente de la muestra». **Era falso y no debe citarse.**
> El par `mot2591` alcanza **23,90 %**, reproducido de forma independiente.
>
> **Causa del error — y no fue un fallo silencioso.** La búsqueda entró completa
> (100/100 pares, 400/400 filas, sin excepciones tragadas). El problema es que
> **`/trajectories/sample?n=100` devuelve siempre el MISMO subconjunto fijo de 100
> trayectorias** de las 4.032 existentes (verificado: dos llamadas consecutivas dan
> idéntico resultado, empezando por `mot320`), y **`mot2591` no está entre ellas**.
> Mi «búsqueda amplia» no era amplia: muestreaba 100 elementos de un pool fijo que
> excluye al 97,5 % del corpus. **Ninguna búsqueda vía ese endpoint puede encontrar
> `mot2591`.**

```bash
python3 -c "
import json,urllib.request
B='https://englergz-nomadaai.hf.space'
c=json.load(urllib.request.urlopen(B+'/trajectories/mot2591/track'))['coords']
rq=urllib.request.Request(B+'/route/build',data=json.dumps({'origin':c[0],'dest':c[-1],
  'type':None,'hour':20,'risk_weight':5.0}).encode(),
  headers={'content-type':'application/json'},method='POST')
print(json.load(urllib.request.urlopen(rq))['comparison'])"
```

| Par | Reducción | Distancia extra | Horas |
|---|---|---|---|
| **`mot2591`** | **−23,90 %** | **+17,4 %** (2.929,7 vs 2.495,2 m) | idéntico en 6/12/18/20/22 |
| `mot1319` | −21,80 % | **+1,5 %** (2.829,1 vs 2.788,4 m) | — |

**Redacción correcta, que no depende de conocer el techo exacto:**

> *Sobre N rutas evaluadas, ninguna alcanza una reducción del 30 %; el máximo observado
> es del 23,90 %.*

**El veredicto de C4 no cambia** — ni las 1.600 evaluaciones propias ni las 200
independientes encontraron nada ≥30 % — pero **el número que acompaña la frase sí**.
No se publica ningún techo.

**Figura 14: la conclusión se mantiene (salida nº 3).** El −36,2 % no se reproduce con
ningún par ni ningún λ. Sale del pie y de la Lista de Figuras. Además hay que **desdoblar
el pie**: hoy junta el promedio del panel (`exposure_reduction_avg_pct`, `App.tsx:1088`
y `1164`) con un recorrido único, en una frase con un solo número visible.

**Sustituto trazable para la Figura 14** — usar `mot2591` (−23,90 %, +17,4 %), que es
reproducible con el comando de arriba.

#### Hallazgo con contenido: la protección no cuesta lo mismo en todas partes

`mot2591` y `mot1319` tienen reducción casi igual (−23,9 % vs −21,8 %) pero **sobrecosto
de distancia que difiere en un orden de magnitud** (+17,4 % vs +1,5 %). Es decir: **en
algunos corredores la protección es casi gratis y en otros se paga cara.** Es más
interesante que el promedio del 5-7 % y responde por adelantado a la pregunta obvia del
jurado: *«¿cuánto más largo es el camino seguro?»*.

#### Defecto de método detectado (para trabajo futuro)

`/trajectories/sample` devuelve un subconjunto fijo, no una muestra aleatoria. **Cualquier
barrido construido sobre ese endpoint —incluido el OE4 canónico— explora solo ese pool.**
No invalida las medias (el pool no está sesgado por exposición), pero **sí impide afirmar
máximos o techos**. Para eso hace falta un endpoint de muestreo real sobre los 4.032.

### 1.11 · (SUPERADA por 1.12 — no citar) alerta con umbrales en escala cruda

Las cifras publicadas (88,7 % · 94,0 % · 280,3 m) salen de
`Research/analysis_v2/eval_anticipatory_alert.py`, que lee la malla **de 425 celdas a
250 m** de la etapa de desarrollo, con la curva horaria ×1,79. La tesis documenta la
zonificación como **475 celdas a 150 m** y declara amplitud ×1,17.

Los dos artefactos **ni siquiera comparten esquema de `cell_id`**: `ix*100000+iy`
(p. ej. `1500063`) frente a secuencial (`53`). `rz.get(cell_of(x,y))` devolvería **0,0 en
toda la malla entregada** — no da otro resultado, es que no puede leerla.

**Se eligió la opción A (remedir), no la B (declararlo)**, y fue lo correcto: la malla
entregada tiene **otra escala** (`max_risk = 81,18`), así que los umbrales 60/80/100 del
barrido viejo **no son trasladables**. Con umbral 80 el `% con riesgo` cae de **94,0 % a
4,6 %**. Declararlo como «pendiente» habría dejado en pie unas cifras que no describen el
sistema entregado.

```bash
/tmp/.oe3venv/bin/python services/api/scripts/oe3_alerta_malla_entregada.py     --hours 6,12,20,22 --thr 40,50,60,70 --lookahead 150,300,500
# artefacto: artifacts/eval/oe3_alerta_malla475.csv
```

No reimplementa `cell_of`: la malla entregada trae `lon`/`lat` por celda, así que **resuelve
el riesgo por proximidad espacial** (rejilla + media diagonal), quedando independiente del
esquema de ids. Corre sobre las **4.032 trayectorias · 1.526.430 puntos · 475 celdas**.

#### Configuración coherente recomendada — y reproduce el 88,7 %

| | Publicado (malla 425) | **Malla entregada (475)** |
|---|---|---|
| Configuración | h=20 · thr=80 · look=150 | **h=22 · thr=70 · look=150** |
| **% anticipadas** | 88,7 % | **88,7 %** ✅ |
| Anticipación media | 129,0 m | **133,4 m** |
| % de trayectos con riesgo | 94,0 % | **23,6 %** |

**La tasa de anticipación se sostiene**: el motor de alerta avisa con la misma eficacia.
Lo que cambia radicalmente es **cuántos trayectos atraviesan riesgo alto** (94,0 % → 23,6 %),
y eso es consecuencia directa de la compresión de la superficie ya documentada en T3.

**Lectura honesta:** el 94,0 % describía una superficie con amplitud ×1,79 y celdas de
250 m. Sobre el sistema realmente entregado, **menos de una cuarta parte de los recorridos
atraviesa una zona de riesgo alto** — lo cual es *mejor* noticia de producto y peor titular.

#### Efecto de la hora, que antes no se veía

Con umbral 70, a las **06:00 y 12:00 ninguna celda lo supera** (0,0 %); a las 20:00 lo hace
el 37,0 % y a las 22:00 el 23,6 %. La modulación horaria **sí discrimina** sobre la malla
entregada, pese a la compresión.

> **Sin partición train/test, y es correcto.** La alerta es una **regla evaluada sobre
> recorridos observados**, no un modelo aprendido: no hay nada que pueda filtrarse del
> corpus. Por eso usa los 4.032 desplazamientos y no las 806 de prueba. Debe decirse
> explícitamente en la tesis para que la pregunta no llegue en sustentación.

### 1.12 · C8 / OE3 — la alerta en el PUNTO DE OPERACION REAL

> **RETRACTACION (2026-08-10) de la seccion 1.11.** El barrido anterior buscaba la
> configuracion (h=22, thr=70, look=150) hasta que reaparecia el 88,7 % publicado.
> **Eso es ajustar a una cifra heredada** -- el vicio exacto que origino esta auditoria.
> El punto de operacion no es un parametro libre: es lo que hace la app.
> Los numeros de 1.11 NO deben citarse.

`app/data/risk.py:167` define el punto de operacion real, y el barrido anterior lo
incumplia en **tres** ejes a la vez:

| | Barrido de 1.11 (mal) | **Sistema desplegado** |
|---|---|---|
| Umbral | 40/50/60/70 sobre `risk` **crudo** (max 81,18) | **`threshold_norm = 0.7` sobre `risk_norm`** (percentil 0-1) |
| Horizonte | `lookahead` 150/300/500 m | **sin horizonte** -- recorre la continuacion entera |
| Hora | fija | **hora estimada de LLEGADA** a cada punto (`speed_mps = 8.3`) |

```bash
/tmp/.oe3venv/bin/python services/api/scripts/oe3_alerta_punto_operacion.py
```

Sobre **4.032 desplazamientos / 1.526.430 puntos / 475 celdas**:

| Hora de inicio | % con alerta | Anticipacion media | Anticipacion mediana |
|---|---|---|---|
| 06:00 | 84,3 % | 1.166,2 m (140,5 s) | 196,4 m (23,7 s) |
| 12:00 | 98,5 % | 588,8 m (70,9 s) | 280,8 m (33,8 s) |
| 18:00 | 99,1 % | 497,9 m (60,0 s) | 162,1 m (19,5 s) |
| **20:00** | **99,1 %** | 480,8 m (57,9 s) | **129,0 m (15,5 s)** |
| 22:00 | 99,0 % | 523,8 m (63,1 s) | 193,5 m (23,3 s) |

**Cifras para la tesis (hora pico, 20:00):** ver **§1.16**, que corrige estas medianas.
Las de esta seccion incluyen los avisos de anticipacion cero y subestiman la anticipacion real.

**Reportar la MEDIANA, no la media.** La media (480,8 m) casi cuadruplica a la mediana
porque la distribucion tiene cola larga: los trayectos que empiezan lejos de cualquier
zona alta avisan a kilometros de distancia y arrastran el promedio. La mediana describe
el caso tipico.

**Por que el 84,3 % de las 06:00 es mas bajo:** a esa hora el factor temporal esta en su
valle (`tf = 0,71`), asi que menos celdas superan `risk_norm >= 0,7`. **La modulacion
horaria discrimina de verdad** sobre la malla entregada -- respaldo empirico para lo que
en T3 quedo como supuesto de diseno.

> **Sin particion train/test, y es correcto.** La alerta es una **regla evaluada sobre
> recorridos observados**, no un modelo aprendido: no hay nada que pueda filtrarse del
> corpus. Por eso usa los 4.032 desplazamientos y no las 806 de prueba. Debe decirse
> explicitamente en la tesis para que la pregunta no llegue en sustentacion.

> **Nota de honestidad:** la mediana a las 20:00 coincide en 129,0 m con una cifra del
> prototipo viejo. **Es coincidencia y no se usa como validacion**: sale de una medicion
> hecha sin mirar el numero anterior, con umbral, horizonte y reloj distintos.

### 1.13 · OE3 — precaucion frente a nivel alto: la alerta SI discrimina

El 99,1 % de 1.12 necesita contrapeso: `threshold_norm = 0.7` es la frontera del nivel
**precaucion**, y a las 20:00 abarca el 30,1 % de las zonas. Que casi todo recorrido cruce
alguna no es un logro del motor, es aritmetica del umbral. La medicion que lo pone en
contexto es el **nivel alto** (`risk_norm >= 0,90`):

```bash
python services/api/scripts/oe3_alerta_punto_operacion.py --threshold 0.9
```

| Hora | Aviso de **precaucion** (>=0,70) | Zona de **nivel alto** (>=0,90) | Mediana (alto) |
|---|---|---|---|
| 06:00 | 84,3 % | **0,0 %** | -- |
| 12:00 | 98,5 % | **30,4 %** | 1.399,4 m (168,6 s) |
| 18:00 | 99,1 % | **60,4 %** | 404,1 m (48,7 s) |
| **20:00** | **99,1 %** | **65,8 %** | **381,5 m (46,0 s)** |
| 22:00 | 99,0 % | **59,2 %** | 464,5 m (56,0 s) |

**Esto convierte una alarma casi siempre encendida en un sistema con discriminacion real.**
A las 06:00 **ningun** recorrido cruza zona de nivel alto (0,0 %) frente al 65,8 % de las
20:00. El contraste 0 % -> 65,8 % es la mejor evidencia empirica de que la modulacion
horaria funciona sobre la superficie entregada.

#### Desajuste de vocabulario que la tesis debe corregir

El Resumen y la Introduccion dicen *«anticipa alertas antes de alcanzar zonas de riesgo
**alto**»*. **El sistema no hace eso**: umbraliza en 0,70, que es la frontera de
**precaucion** (`_level`: alto >= 0,90 · medio >= 0,70). A las 06:00 no existe ni una celda
de nivel alto en todo Tumaco y aun asi el 84,3 % de los recorridos recibe aviso, todos por
zonas medias.

No es un error de implementacion -- es coherente con el esquema de tres niveles que la
propia tesis describe. **Lo que esta mal es la palabra en el texto.**

Redaccion propuesta:

> «El sistema emite al menos un aviso de precaucion en el 99,1 % de los recorridos a la
> hora pico, consecuencia de que el umbral de aviso --fijado en el percentil 0,70-- abarca
> el 30,1 % de las zonas a esa hora. El evento escaso e informativo es el cruce de zona de
> nivel alto, que ocurre en el 65,8 % de los recorridos a las 20:00 y en **ninguno** a las
> 06:00.»

**Para Recomendaciones -- fatiga de alerta:** un umbral que abarca el 30 % del territorio
produce avisos casi universales. Elevar el umbral de aviso o **graduar el mensaje por
nivel** es una linea de mejora declarable: limitacion de producto reconocida, no defecto
oculto.

### 1.14 · T7 -- robustez GPS, remedida tras el arreglo blake2b

```bash
curl -s "$API/trajectories/evaluate?n=806&noise_m=SIGMA"
```

| sigma (m) | n | acc@50 m | IC95 | **Publicado en la TESIS** | delta | acc@100 m | FDE mediana |
|---|---|---|---|---|---|---|---|
| 0 | 805 | **87,5 %** | [85,2 - 89,8] | 90,5 % | -3,0 pp | 92,7 % | 7,70 m |
| 5 | 805 | **77,4 %** | [74,0 - 80,2] | 85,5 % | **-8,1 pp** | 82,2 % | 10,20 m |
| 10 | 805 | **63,7 %** | [60,2 - 67,1] | 72,5 % | **-8,8 pp** | 67,3 % | 15,40 m |
| 20 | 805 | **47,7 %** | [44,3 - 51,1] | 55,0 % | **-7,3 pp** | 52,2 % | 71,30 m |

> **CORRECCION DE ETIQUETA (2026-08-10).** Una version previa comparaba contra
> «90 / 82 / 72 / 60,6». **Esos NO son los valores de la tesis**: el 82 y el 60,6 salen de
> mediciones intermedias de julio que quedaron en el git log. Los publicados son
> **90,5 / 85,5 / 72,5 / 55,0**, que es contra lo que compara la tabla de arriba. La
> conclusion no cambia -- las nuevas estan por debajo de ambos juegos -- pero los deltas
> si, y son los de esta tabla.

**Ninguna cifra publicada reproduce.** Las reales estan entre 3,0 y 8,8 puntos por debajo. Ahora si son reproducibles: `blake2b(tid)` sustituyo a
`hash(tid)`, que dependia del salt del proceso.

**El rango «72-86 %» del Resumen no se sostiene**: el rango real es **47,7 - 87,5 %**.
Debe sustituirse por la tabla completa con sus intervalos, declarando sigma en cada punto.

> **Lectura honesta:** la degradacion es mas fuerte de lo publicado, y eso es informacion
> util -- dice que el metodo depende de GPS de calidad razonable (sigma <= 5 m mantiene
> 77,4 %) y se degrada notablemente con ruido urbano severo. Declararlo es mas defendible
> que un 60,6 % que no reproduce.

### 1.15 · C5 -- pruebas de humo sobre `/route/build` (el indicador, no lo adyacente)

El indicador aprobado habla de *«sin errores criticos en el manejo de rutas seguras»*, que
vive en el backend. Las 21 pruebas de `apps/mobile` cubrian cliente movil: evidencia
adyacente. Estas ocho comprueban **invariantes** del endpoint -- propiedades que deben
cumplirse siempre, no valores concretos, asi que no caducan cuando cambien las cifras.

```bash
python services/api/scripts/c5_humo_route_build.py
```

| Prueba | Propiedad | Resultado |
|---|---|---|
| `ruta_factible` | un O-D valido devuelve ruta con >=2 vertices | PASA (217 / 212) |
| `od_invalido` | un O-D fuera de la red falla limpio, no 5xx | PASA (HTTP 422) |
| `lambda_cero` | lambda=0 devuelve reduccion exactamente 0 | PASA |
| `no_negativa` | lambda>0 nunca devuelve reduccion negativa | PASA |
| `segura_no_mas_corta` | la segura nunca es mas corta que la directa | PASA |
| `exposicion_menor` | la exposicion de la segura no supera la directa | PASA |
| `hora_modula` | cambiar la hora cambia la exposicion | PASA |
| `monotonia_lambda` | mas lambda nunca reduce menos | PASA |

**8/8 aprobadas.** Sumadas a las 21 del cliente movil: **29/29 pruebas automatizadas**,
cubriendo alertas de zona, recalculo por desvio, reanudacion en segundo plano **y el
manejo de rutas seguras del backend**.

### 1.16 · OE3 — que fraccion de los avisos PRECEDE a la entrada

> **CORRECCION IMPORTANTE a §1.12 (2026-08-10).** Las medianas de §1.12 (129,0 m a las
> 20:00) se calcularon **incluyendo los avisos de anticipacion CERO** -- aquellos en que el
> primer punto del recorrido ya supera el umbral y la persona **ya esta dentro** de la
> zona. Esos ceros arrastraban la mediana hacia abajo. **La cifra condicionada a que el
> aviso realmente preceda a la entrada es 756,0 m (91,1 s).** Citar la de §1.12 sin este
> matiz subestima la anticipacion real por un factor de casi seis.

En `lookahead_alert`, si el primer punto del recorrido ya supera el umbral, `acc = 0`: el
aviso llega cuando ya no sirve. **Esa fraccion no es 100 % por construccion**, es una
propiedad medible del motor -- y es el numero que da valor a la alerta.

```bash
python services/api/scripts/oe3_alerta_punto_operacion.py --threshold 0.7
```

| Hora | Con alerta | **Anticipados** (el aviso precede) | Mediana (solo anticipados) | Media |
|---|---|---|---|---|
| 06:00 | 84,3 % | **63,7 %** | 1.102,7 m (132,9 s) | 1.829,5 m |
| 12:00 | 98,5 % | **65,9 %** | 826,3 m (99,6 s) | 893,1 m |
| 18:00 | 99,1 % | **60,3 %** | 762,2 m (91,8 s) | 826,1 m |
| **20:00** | **99,1 %** | **58,7 %** | **756,0 m (91,1 s)** | 819,7 m |
| 22:00 | 99,0 % | **63,0 %** | 723,5 m (87,2 s) | 831,3 m |

**El 41,3 % de los avisos a la hora pico llega cuando la persona ya esta dentro de la
zona.** Es la limitacion mas concreta del motor y hay que declararla: el sistema no puede
anticipar cuando el recorrido **empieza** en zona de precaucion, cosa frecuente en un
municipio donde el umbral abarca el 30,1 % del territorio.

> **Es un hallazgo, no un defecto oculto.** Da pie a una recomendacion accionable: avisar
> tambien al **iniciar** un recorrido dentro de zona de precaucion, con un mensaje distinto
> («estas en una zona de precaucion») en vez de una alerta de aproximacion que llega tarde.

#### Parrafo para OE3, ya con todas las piezas

> El sistema emite al menos un aviso de precaucion en el **99,1 %** de los recorridos a la
> hora pico --consecuencia de que el umbral, fijado en el percentil 0,70, abarca el
> **30,1 %** de las zonas a esa hora--, mientras que el **65,8 %** atraviesa ademas una
> zona de nivel alto. El **58,7 %** de esos avisos precede a la entrada en la zona, con una
> anticipacion mediana de **756,0 m (91,1 s)**; el resto corresponde a recorridos que ya
> comienzan dentro de una zona de precaucion. A las 06:00 la proporcion de recorridos que
> alcanzan el nivel alto cae al **0 %**, pues a esa hora ninguna celda del municipio lo
> alcanza.

**El contraste 0 % -> 65,8 % entre madrugada y hora pico es la evidencia empirica de que la
modulacion horaria funciona sobre la superficie entregada** -- lo que en C3 quedo como
supuesto de diseno sin respaldo. Merece decirse explicitamente: es un hallazgo que el
documento hoy no tiene.

> **Nada de `/evaluate/alerts` debe sobrevivir en el texto**, ni siquiera el 88,7 %. Ese
> endpoint sirve `eval_alerta_anticipada.csv`, generado con `CELL = 250.0` sobre la malla de
> **425 celdas** y curva x1,79, con `cell_id` del esquema `ix*100000+iy` que **no puede leer
> la malla entregada**. Conservar el 88,7 % junto a estas cifras seria poner una cifra del
> prototipo al lado de cifras del producto: el defecto C3 exacto que ya se retiro de las
> Figuras 6 y 14.

> **Pendiente menor:** las medianas de nivel alto de §1.13 (381,5 m a las 20:00) tambien
> incluyen los ceros. La cifra condicionada exige repetir la corrida con `--threshold 0.9`;
> mientras tanto, **citar de §1.13 solo los porcentajes** (0,0 % / 65,8 %), que no estan
> afectados.

### 1.17 · T2 — direccion y FDE, con el HORIZONTE EMPAREJADO

> **RETRACTACION DOBLE (2026-08-10). Ni habia fuga, ni el 65,0 % era correcto.**
>
> **(a) No habia fuga de datos.** La evaluacion critica retiro su propio hallazgo C2:
> `trajcl_predict_clean.py` **ya excluia la propia trayectoria** (`cid == self_id ->
> continue`). Partiendo `eval_fair_horizon.csv` por la particion real: **TRAIN 92,0 % vs
> TEST 91,6 %** -- sin diferencia. La mediana de 0,31 m no era firma de auto-recuperacion,
> sino consecuencia de que el corpus es una simulacion SUMO donde muchos viajes comparten
> tramos. **Lo real es un error de ETIQUETA**: la tesis presenta cifras de las 4.029
> trayectorias dentro de un parrafo que dice «conjunto de prueba no visto».
>
> **(b) Mi 65,0 % era un error de definicion, no un hallazgo.** Comparaba el rumbo al
> **ultimo vertice de la polilinea predicha** contra el rumbo al **destino final** de la
> trayectoria real. Pero la prediccion esta **truncada al horizonte** (~195 m) mientras
> `truth` es la continuacion completa (mediana ~900 m): **razon de arcos 0,21**. Eran
> rumbos hacia puntos a distancias distintas. **El 65,0 % NO debe citarse.**

**Medicion correcta**, caminando `truth` hasta acumular el mismo arco que la prediccion
(misma definicion que `eval_fair_horizon.py:69`):

```bash
python services/api/scripts/t2_destino_direccion.py https://englergz-nomadaai.hf.space 100
```

| Metrica | Publicado | **Emparejado (test)** | IC95 | Solo-test del auditor |
|---|---|---|---|---|
| **Direccion <=30 grados** | 91,9 % | **90,0 %** | [84,0 - 95,0] | **91,6 %** |
| FDE mediana al horizonte | -- | **9,3 m** | [7,4 - 10,2] | -- |
| Precision <=100 m (horizonte) | -- | **92,0 %** | [86,0 - 97,0] | -- |
| Precision <=100 m (destino final) | 1,44 % | **1,00 %** | [0,0 - 3,0] | 1,49 % |

**Las dos mediciones independientes coinciden: el 91,6 % del auditor cae dentro de
[84,0 - 95,0].** Y la FDE al horizonte (9,3 m) es coherente con la mediana global de
7,70 m ya cerrada en T1.

> **Ojo a dos magnitudes que no deben mezclarse:** el **92,0 %** es precision <=100 m
> **al horizonte emparejado**; el **1,00 %** es <=100 m **al destino final del viaje**.
> Son preguntas distintas -- «cuan bien predice los proximos 200 m» frente a «cuan bien
> adivina donde termina el viaje»-- y la segunda es, logicamente, mucho mas dificil.

**Para la tesis:** las tres cifras de C2 **no se recomputan, se reetiquetan**. Reportar
**91,6 % · 1,49 % · 644,1 m** (los valores solo-test del `eval_fair_horizon.csv`) diciendo
de donde salen, o los emparejados de esta tabla. Lo que no puede quedar es una cifra de las
4.029 presentada como «conjunto de prueba no visto».

#### CIERRE DEFINITIVO — el error angular, ya en `/trajectories/evaluate`

Se anadio a ese endpoint (`ang_med_deg`, `acc_ang30_pct`, ambos con bootstrap), que ya
itera `sorted(test_ids)`, corre el **predictor desplegado** y admite n hasta 2000. Con eso
**OE1 entero sale de UNA fuente, UN modelo y UNA muestra de 805**.

```bash
curl -s "https://englergz-nomadaai.hf.space/trajectories/evaluate?n=806"
```

| Metrica | **n=805** | IC95 | Publicado |
|---|---|---|---|
| acc@50 m | 87,5 % | [85,2 - 89,8] | 90,5 % |
| acc@100 m | 92,7 % | — | — |
| FDE mediana | 7,70 m | [7,0 - 8,5] | — |
| **Direccion <=30 grados** | **92,4 %** | **[90,7 - 94,3]** | **91,9 %** |
| Error angular mediano | **0,25 grados** | [0,2 - 0,3] | — |

**Direccion por tipo:** bus 95,6 % (n=45) · car 96,5 % (n=198) · **mot 90,6 % (n=555)** ·
truck 100,0 % (n=7).

**CUATRO mediciones independientes convergen** en la direccion:

| Fuente | Valor |
|---|---|
| Publicado en la tesis | 91,9 % |
| Solo-test de `eval_fair_horizon.csv` (auditor) | 91,6 % |
| Muestra de 100 con horizonte emparejado | 90,0 % [84,0 - 95,0] |
| **Endpoint sobre las 805 (definitivo)** | **92,4 % [90,7 - 94,3]** |

> **C2 queda cerrado como problema de ETIQUETA, no de integridad.** La cifra publicada
> reproduce. Lo unico que hay que corregir es de donde se dice que sale: **reportar
> 92,4 % [90,7 - 94,3] sobre las 805 de test**, medido con el predictor desplegado, en vez
> de una cifra de las 4.029 presentada como «conjunto de prueba no visto».

### 1.18 · OE3 — nivel alto SIN el sesgo de anticipacion cero

Repetida la corrida de §1.13 con el conteo corregido. **Estas cifras SI son citables**:

| Hora | Cruza nivel alto | **Anticipados** | Mediana (solo anticipados) |
|---|---|---|---|
| 06:00 | **0,0 %** | -- | -- |
| 12:00 | 30,4 % | **84,5 %** | 2.314,4 m (278,8 s) |
| 18:00 | 60,4 % | **73,6 %** | 2.360,1 m (284,3 s) |
| **20:00** | **65,8 %** | **71,6 %** | **2.391,1 m (288,1 s)** |
| 22:00 | 59,2 % | **77,9 %** | 1.874,5 m (225,8 s) |

**El motor anticipa MEJOR las zonas de nivel alto que las de precaucion**: 71,6 % frente
al 58,7 %, con una mediana de 2.391 m (288 s) frente a 756 m (91 s). Tiene sentido -- las
zonas altas son minoria y estan mas concentradas, asi que es raro que un recorrido empiece
justo dentro de una.

> Es la mejor noticia de OE3 y conviene decirla: **cuando el peligro es serio, el aviso
> llega con casi cinco minutos de margen en el 71,6 % de los casos.**

### 1.19 · T8 / I5 — CONTRIBUCION frente a CORRELACION, sobre las 475

La tesis presenta «contribuciones» de densidad (0,32), periferia (0,36) y policia (0,34)
junto a una «correlacion con trafico» de 0,07, **como si las cuatro fueran la misma
magnitud**. No lo son. Y el artefacto que produce esas tres cifras
(`tumaco_zonas_riesgo_rtm.csv`) tiene **425 celdas y el modelo antiguo de 3 factores**, no
las 475 entregadas con 4.

```bash
python services/api/scripts/t8_contribuciones.py
```

| Factor | Peso | **Contribucion a la varianza** | Correlacion (percentil) | Correlacion (crudo) |
|---|---|---|---|---|
| densidad | 0,35 | **0,3120** | 0,3777 | 0,3236 |
| periferia | 0,30 | **0,3238** | 0,4458 | 0,3621 |
| **actividad** | 0,20 | **0,1378** | 0,2849 | **0,0648** |
| resto | 0,15 | **0,2264** | 0,5147 | 0,5147 |
| **SUMA** | 1,00 | **1,0000** | — | — |

**Son dos preguntas distintas y hay que nombrarlas distinto:**

- **Correlacion** — ¿la celda con mas de este factor tiende a tener mas riesgo? Relacion
  bivariada; ignora el peso y a los demas factores.
- **Contribucion** — ¿que fraccion de la **varianza** del indice explica este factor?
  Descomposicion exacta `Var(I) = suma_i w_i · Cov(f_i, I)`, cuyas cuotas **suman 1**.

#### Por que `actividad` pesa 0,20 y «correlaciona 0,07»

**El 0,07 de la tesis es la correlacion del `n_points` EN CRUDO** (medido: 0,0648). Pero el
indice **no usa el crudo, usa su percentil**, y ese correlaciona **0,2849**. La diferencia
es la asimetria brutal de la variable:

```
n_points: min 0 · mediana 491 · media 3.214 · max 45.800
asimetria media/mediana = 6,54x · el 1 % superior concentra el 11,9 % de la actividad
```

Con una cola asi, la correlacion lineal en crudo la dominan unas pocas celdas extremas y no
describe la relacion tipica. **Percentilar es precisamente lo que corrige eso**, y por eso
el factor aporta el **13,8 % de la varianza** del indice pese a su «0,07».

> **Para la tesis:** el 0,07 **no debe presentarse junto a las contribuciones**, porque
> invita a leer que el factor es inutil. Si se cita, debe decirse que es la correlacion del
> valor crudo y que el modelo usa el percentil, cuya correlacion es 0,28 y cuya contribucion
> a la varianza es 0,138.

> **LIMITE DECLARADO — el «resto» no es «policia».** El factor policia no esta en los
> artefactos entregados (exige redescargar OSM). Se despeja algebraicamente del indice, pero
> ese residuo **absorbe tambien cualquier desajuste de reconstruccion**: 47 de 475 valores
> caen fuera de [0,1]. Por eso la fila se llama **resto** y no se afirma que sea el factor
> policia. Su contribucion (0,2264) es un techo, no una medicion del factor.

### 1.20 · Figuras 6, 7 y 8 — regeneradas sobre el sistema entregado

Las tres originales salen del prototipo y **contradicen al texto ya corregido**:

| Figura | Original | Problema |
|---|---|---|
| 6 | `risk_hour_curve.png` | muestra amplitud x1,79; el texto dice **x1,17** |
| 7 | `sweep_alerta.png` | umbrales 60/80/100 sobre `risk` **crudo**; el punto de operacion real es `threshold_norm = 0,70` |
| 8 | `eval_alerta_anticipada.png` | muestra el **88,7 %**, cifra ya RETIRADA del texto |

```bash
python services/api/scripts/figuras_6_7_8.py
```

| Nueva | sha256 | Que muestra |
|---|---|---|
| `fig6_curva_horaria.png` | `846badc013987650…` | |
| `fig7_umbral_cobertura.png` | `46546ce6f7f5187c…` | |
| `fig8_alerta_operacion.png` | `b1698a693b3ff93a…` | |

**Figura 6** — las DOS curvas juntas: el factor servido (x1,408) y la **modulacion
efectiva** (x1,170), que es la que gobierna niveles y alertas. Hace visible el doble piso
nocturno en vez de esconderlo.

**Figura 7** — sustituye el barrido de umbrales por lo que de verdad explica el
comportamiento: **cuanto territorio cubre cada umbral a cada hora**. A las 06:00 ninguna
celda alcanza el nivel alto; a las 20:00 lo hace el 10,1 %, y el umbral de precaucion
abarca el 30,1 %. Es la figura que responde por adelantado a «¿un aviso que suena en 99 de
cada 100 viajes que informa?».

**Figura 8** — dos paneles: (a) cobertura de la alerta por hora, con las tres magnitudes
que no deben confundirse —recibe aviso / atraviesa nivel alto / el aviso precede—; (b)
anticipacion mediana **solo de los avisos que preceden**.

> **Convencion IEEE aplicada (2026-08-11).** Las tres figuras se regeneraron **sin titulo
> interno**: en IEEE el pie del documento ES el titulo, y rotularlo dentro del grafico lo
> duplica con dos redacciones distintas. Importa especialmente en la Fig. 6, cuyo pie dice
> «supuesto de modulacion sin calibrar» — matiz que costo tres rondas y que un titulo
> interno perdia. Ademas: **tildes en todos los rotulos**, **coma decimal** (x1,408 y
> x1,170), **sin nombres de archivos de codigo** dentro de las figuras (lenguaje de
> repositorio, va en el cuerpo o en un anexo), y aire suficiente arriba en la Fig. 8.

> **Detalle de honestidad grafica:** en 8b las 06:00 quedan **en blanco** para nivel alto,
> no en cero. A esa hora no hay ningun aviso de ese tipo, y dibujar un 0 diria «avisa con
> 0 m de margen» cuando lo cierto es «no hay aviso que medir». Va anotado en la propia
> figura.

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

## 2.1 · Arreglo de reproducibilidad (causa raíz de T4, T7/I2 y C4)

Tres iteraciones de `set` + `hash()` salteado, en `services/api/app/ml/destination.py`:

| Línea | Antes | Después |
|---|---|---|
| 141 | `for tid in self.train_ids:` | `for tid in sorted(self.train_ids):` (KDTree) |
| 158 | `for tid in self.train_ids:` | `for tid in sorted(self.train_ids):` (Markov) |
| 222 | `ids = [t for t in self.test_ids …]` | `ids = sorted(t for t in self.test_ids …)` |
| 282 | `_r.Random(hash(tid) & 0xFFFF)` | `blake2b(tid)` — estable sin depender del entorno |

Y en `services/api/Dockerfile`: `ENV PYTHONHASHSEED=0`.

**Demostración del fallo y del arreglo:**

```bash
for i in 1 2 3; do PYTHONHASHSEED=random python3 -c "
import random
ids={f'mot{i}' for i in range(1,300)}
a=[t for t in ids]; random.Random(7).shuffle(a)      # ANTES
b=sorted(ids);      random.Random(7).shuffle(b)      # DESPUÉS
print(f'antes {a[:3]}  despues {b[:3]}')"; done
```

```
antes ['mot250','mot144','mot117']   despues ['mot123','mot214','mot30']
antes ['mot100','mot236','mot163']   despues ['mot123','mot214','mot30']
antes ['mot126','mot57','mot165']    despues ['mot123','mot214','mot30']
```

Misma semilla: **antes tres listas distintas, después idénticas.**

**NO afectado** (verificado): la partición train/test hace `sorted()` en la línea 133 antes
de barajar con semilla 42 → **el 80/20 y los 3.226/806 son correctos**. `/trajectories/evaluate`
usa `sorted(test_ids)` → estable; su problema era otro (T1).

**Test de aceptación — entre REINICIOS, no dentro del mismo proceso.**

> ⚠️ Una versión previa proponía «dos llamadas seguidas deben dar la misma lista». **Ese
> test no prueba nada**: dentro de un mismo proceso el orden de un `set` siempre fue
> estable, y ya pasaba ANTES del arreglo. El fallo ocurría **entre reinicios**.

1. Con el Space arriba, guardar la lista de `/trajectories/sample?n=40`.
2. **Factory rebuild** desde Settings del Space — no un restart: el `ENV` del Dockerfile
   exige reconstruir la imagen.
3. Volver a pedir la lista. **Tienen que ser idénticas.**

Solo si coinciden puede congelarse el barrido canónico.

> **Efecto en la tesis:** §Validez y confiabilidad dice hoy «las particiones y los cálculos
> usan semilla fija». La partición sí; los barridos y la prueba de ruido, no.
> **Tras el arreglo la frase pasa a ser verdadera** — se resuelve haciéndola cierta, no
> reescribiéndola.

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
| **T2** | Dirección <30°, FDE por tipo, ≤100 m | **§1.17 CERRADO — era ETIQUETA, no fuga.** Dirección **92,4 %** [90,7-94,3] sobre las **805**, con el predictor desplegado. El 91,9 % publicado **reproduce** | `Research/analysis_v2/eval_fair_horizon.py` no tiene split train/test, ni semilla, ni auto-exclusión (4.029 filas, mediana 0,31 m). Hay que rehacerlo **sobre los 806 ids de test** con `exclude_id`. Las cifras hoy publicadas (91,9 % dirección, 642,0 m, 1,44 %) **provienen de ese archivo y no son válidas** hasta rehacerlo. |
| **T7** | Robustez GPS σ ∈ {0,5,10,20} | **Pendiente** | `destination.py` usa `Random(hash(tid) & 0xFFFF)`: sin `PYTHONHASHSEED=0` el ruido **no es reproducible entre procesos**. Hay que fijarlo en el Dockerfile antes de medir. |
| **T8/I5** | «Contribuciones» 0,32/0,36/0,34 y «correlación» 0,07 mezcladas | **§1.19.** Sobre las 475 con 4 factores: contribuciones **0,312 / 0,324 / 0,138 / 0,226** (suman 1). El **0,07 es la correlación del crudo**; el percentil que usa el modelo correlaciona **0,285** | Deben regenerarse sobre 475 con los 4 factores, distinguiendo **contribución** (cuota de varianza) de **correlación**, y explicando por qué actividad pesa 0,20 con correlación 0,07. |
| **T11 / C5** | «95 % de funcionalidad operativa» | **MEDIDO — §1.9 y §1.15.** El 95 % se retira; la cifra real es **29/29 pruebas** (21 cliente movil + 8 humo sobre `/route/build`). |

| **C4** | Proyección de percepción | **DESBLOQUEADA** | Dependía de T4, que ya está cerrado. La proyección debe rehacerse partiendo de **4,92 % [3,34–6,66] (λ=2,5)**, no de 5,24 / 6,2 / 7,00, y arrastrar el intervalo. |

### 3.1 · T13 — ⛔ RETRACTADO POR COMPLETO (2026-08-09)

> **TODO LO QUE ESTA SECCIÓN DECÍA ERA FALSO. NO APLICAR NADA DE ELLO.**
>
> Concluí «no recomputable» y recomendé **retirar el 85,8 % de arma de fuego** y
> **sustituirlo por el 91,1 % masculino**. **Las dos cosas están mal** y ambas quedaron
> commiteadas por error. Quedan anuladas.
>
> **La causa del error:** asumí que la fuente era el CSV local
> `HOMICIDIO_20251031.csv`. **Ese es otro dataset** — el nacional, 331.026 filas, que
> efectivamente no tiene columna de arma. La fuente real es la **API de datos.gov.co,
> conjunto `m8fd-ahd9`**, consultada **en vivo** por
> `Research/analysis_v2/oe2_valida_riesgo.py:67-71` con `$where cod_muni='52835'` —
> exactamente el identificador que la tesis ya citaba. Vi ese script en el listado y
> nunca lo abrí.

**Verificación independiente ejecutada contra la API (2026-08-09):**

```bash
python3 -c "
import json,urllib.parse,urllib.request
from collections import Counter
u='https://www.datos.gov.co/resource/m8fd-ahd9.json?'+urllib.parse.urlencode(
  {'\$where':\"cod_muni='52835'\",'\$limit':100000})
rows=json.load(urllib.request.urlopen(urllib.request.Request(u,
  headers={'User-Agent':'NomadaAI/1.0'}),timeout=180))
print(len(rows),'filas ·',sum(int(float(r.get('cantidad',1))) for r in rows),'homicidios')"
```

| Cifra | Tesis | **Reproducido hoy** | Estado |
|---|---|---|---|
| Arma de fuego | 85,8 % | **85,8 %** | ✅ **reproduce exacto** |
| Sicariato | 56,6 % | **56,6 %** | ✅ reproduce exacto |
| Rural / Urbana | 55,2 / 44,8 | **55,2 / 44,8** | ✅ reproduce exacto |
| Total | 4.045 | **4.050** | conjunto vivo → **congelar** |
| Serie 2019 | 216 | **216** | ✅ reproduce |

**Lo único real que queda de T13** —y es mucho menor de lo que dije— es que el conjunto es
**vivo**: 4.045 en su momento, 4.050 hoy, y seguirá subiendo.

**Decisión tomada (Opción A — congelar hoy):**

- Snapshot congelado por la sesión de escritura: `m8fd-ahd9_tumaco_snapshot_2026-08-09.json`
  · **4.034 filas · 4.050 homicidios** · `sha256 0f64efd4…2d75`.
- **El texto pasa de 4.045 a 4.050**, con fecha de consulta. Los porcentajes **no se mueven**
  (85,8 / 56,6 / 55,2-44,8 idénticos).
- **2026 se excluye solo de la serie anual** (Figura 1), no de la caracterización: así las
  cuatro cifras quedan idénticas y solo cambia un número. Cláusula: *«serie 2003–2025; se
  excluye 2026 por tratarse de un año en curso al momento de la consulta»*.

> Nota sobre el hash: el sha256 depende de la serialización. El canónico **oficial** es el
> del snapshot congelado (`0f64efd4…`); mi verificación independiente usó otra
> serialización y da `ec8a2bc9…`. **Los datos son los mismos** (4.034 filas / 4.050).

<details>
<summary>Texto original de T13 — CONSERVADO SOLO COMO REGISTRO DEL ERROR, NO APLICAR</summary>

#### (anulado) Problema de trazabilidad

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

> **(anulado)** Las recomendaciones de este bloque quedan sin efecto: la fuente existe,
> es trazable y las cifras reproducen.

</details>

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
5. **Retirar** el «95 % de funcionalidad operativa» (T11) — ver C5 más abajo.
6. **T13: no retirar nada.** Arma de fuego, sicariato y urbano-rural **reproducen exacto**.
   Único cambio: **4.045 → 4.050** con fecha de consulta, y cláusula de exclusión de 2026
   de la serie anual.

> Las cifras nuevas son **peores** que las publicadas (87,5 % en vez de 90,5 %; ×1,17 en
> vez de ×1,79). Eso es lo correcto: un jurado premia el número honesto con su intervalo
> y castiga el número bonito que no se reproduce.
