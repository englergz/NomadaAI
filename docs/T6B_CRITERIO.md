# T6b · Criterio de interpretación — FIJADO ANTES DE MEDIR

Fecha: 2026-08-09. **Escrito y commiteado antes de ejecutar la medición.**

Existe porque las dos lecturas anteriores de T6b salieron mal, y las dos por el mismo
motivo: **se interpretó el número después de verlo.** Primero se leyó al revés (ρ bajo
presentado como «sale a favor»), y al corregir se sobrecorrigió (ρ alto presentado como
«contradice la tesis», cuando decía justo lo que la tesis afirma). Con el criterio escrito
de antemano, el número dice lo que dice.

---

## Qué se mide

**ρ de Spearman entre el índice de riesgo CON el factor socioeconómico y el índice SIN él**
(pesos renormalizados), **por separado en Tumaco y en Cali**, sobre las **mallas
entregadas** (475 y 4.268 celdas) y con **la misma configuración de factores en ambas**.

Empates promediados. Nada reconstruido: se regenera con `rebuild_risk_city.py`, que ya
construye el índice con densidad · socioeconómico · periferia · policía y acepta pesos por
bandera.

## Cómo se lee ρ — tabla fijada de antemano

| ρ(con, sin) | Significado | Etiqueta |
|---|---|---|
| **≈ 1,00** (≥ 0,95) | quitar el factor **no cambia** el orden de riesgo | el factor es **INERTE** |
| **0,80 – 0,95** | reordena poco | **efecto débil** |
| **< 0,80** | reordena sustancialmente | el factor **DISCRIMINA** |

**Menor ρ = MÁS reordenamiento = el factor aporta más.** (Es la dirección que se leyó al
revés la primera vez.)

## Qué afirma la tesis y qué la confirmaría

La afirmación publicada es **comparativa**: el factor socioeconómico es **inerte en Tumaco**
(territorio homogéneo) y **discriminante en Cali** (territorio heterogéneo). Requiere las
dos mitades.

| Resultado | Veredicto fijado de antemano |
|---|---|
| ρ(Tumaco) ≥ 0,95 **y** ρ(Cali) < 0,80 | **La tesis se CONFIRMA.** El contraste existe y es el aporte del trabajo: evidencia de validez del marco. |
| ρ(Tumaco) ≥ 0,95 **y** ρ(Cali) ≥ 0,95 | **La tesis NO se sostiene.** El factor es inerte en ambas. Hay que **rebajar el aporte de «evidencia de generalización» a «portabilidad técnica»**: el marco se transfiere, el contraste socioeconómico no. Resultado legítimo y publicable. |
| ρ(Tumaco) < 0,80 | **La mitad de Tumaco es falsa** — el territorio no sería homogéneo respecto al factor. Hay que reescribir esa afirmación. |
| Cualquier par en la banda 0,80–0,95 | **No concluyente.** Se reporta el número y se declara que el contraste no alcanza para sostener la afirmación comparativa. |

## Guardas obligatorias antes de dar por bueno el número

1. **Control de azar.** Repetir sustituyendo el factor por una variable aleatoria con la
   **misma distribución de empates**. Si ρ real no se distingue del control, el test no
   mide nada y no se publica. (Esta guarda es la que detectó que la primera medición era
   un artefacto de percentilar `poblacion` con 36,6 % de ceros.)
2. **Varianza del factor.** Reportar media, desviación y nº de valores distintos de la
   variable socioeconómica en cada ciudad. Una variable saturada en su techo
   (como `socio`: 56,7 % de celdas exactamente en 1,0) **no puede discriminar por
   construcción**, y eso hay que decirlo aunque el ρ salga favorable.
3. **Misma configuración en ambas ciudades.** Si los pesos o los factores difieren entre
   Tumaco y Cali, la comparación no es válida y el resultado se descarta.

## Compromiso

**El veredicto se toma leyendo esta tabla, no reinterpretando el número.** Si el resultado
es el incómodo, se reporta el incómodo.
