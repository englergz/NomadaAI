# Plan de redacción de la tesis — Nómada.AI

> Estructura tomada de la plantilla oficial **U. Nariño (`Trabajo de Grado.docx`)**, formato IEEE.
> Regla de oro: **no inventar**. Cada afirmación cuantitativa sale de un artefacto reproducible
> (script/CSV/endpoint) o de una cita verificada. Redacción **por partes**, revisión párrafo a
> párrafo y cita a cita.

## Dónde se redacta
Cada sección se escribe primero en `docs/tesis/NN_seccion.md` (fácil de revisar e iterar); al final
se ensambla todo en el `.docx` con la plantilla U. Nariño (portada, TOC, numeración IEEE).

## Estructura y fuente de cada sección

| # | Sección (plantilla) | Contenido | De dónde sale (evidencia real) |
|---|---------------------|-----------|--------------------------------|
| 1 | **Introducción** | Problema, contexto Tumaco, pregunta, aporte | Anteproyecto (planteamiento) + contexto real de homicidios (`VALIDACION_RIESGO.md`) |
| 2 | **Objetivos** | General + 4 específicos | **Textual del anteproyecto aprobado** (no reformular) |
| 3 | **Marco teórico / antecedentes** | Actividades rutinarias, RTM, similitud de trayectorias, ruteo | `MODELO_PREDICCION.md`, `MODELO_RIESGO.md` — **solo citas verificadas** |
| 4 | **Metodología** | 4 fases: caracterización+predicción, riesgo RTM, ruteo, evaluación. Datos, modelos, protocolo train/test | `METODOLOGIA.md`, código real (`ml/destination.py`, `data/risk.py`, `ml/router.py`) |
| 5 | **Resultados** | Números reales por OE | OE1 `/trajectories/evaluate` (90%); OE2 `VALIDACION_RIESGO.md`; OE3 rutas+POIs; OE4 `oe4_od_sweep.csv` + escenarios |
| 6 | **Análisis y discusión** | Interpretación + límites honestos + comparación 3 vías | Todos los anteriores + `CUMPLIMIENTO.md` |
| 7 | **Conclusiones** | Cierre por objetivo | Tablero de `CUMPLIMIENTO.md` |
| 8 | **Recomendaciones / trabajo futuro** | DIJIN, encuesta percepción, app móvil, más ciudades | `CUMPLIMIENTO.md` (vacíos) |
| 9 | **Resumen / Abstract** | 200-250 palabras (se escribe al final) | Síntesis de todo |
| 10 | **Bibliografía** | IEEE, numeradas | Refs ya usadas en los docs (verificadas) + del anteproyecto |
| 11 | **Anexos** | Capturas, tablas, enlace al repo/Space, oficios DIJIN/DANE | Repo, Space, `Solicitud_*` |

## Orden de redacción propuesto (de lo más aterrizado a lo más narrativo)
1. **Metodología** — describe lo que se construyó (concreto, bajo riesgo de invención).
2. **Resultados** — las cifras reales ya medidas.
3. **Análisis y discusión** — interpretación + límites (aquí va la honestidad que suma).
4. **Marco teórico** — con las citas verificadas.
5. **Introducción + Objetivos**.
6. **Conclusiones + Recomendaciones**.
7. **Resumen/Abstract** y **Bibliografía** (al final, cuando el contenido existe).

## Método de trabajo por sección
Para cada sección: (a) yo redacto un borrador corto y fundamentado; (b) lo revisas párrafo a párrafo;
(c) verifico cada cita y cada número contra su fuente; (d) ajustamos; (e) se marca como cerrada.
