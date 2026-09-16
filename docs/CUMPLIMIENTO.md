# Cumplimiento de resultados vs. lo propuesto en el anteproyecto

> **Estado a 2026-09-16.** Autoevaluación frente a los objetivos, resultados esperados e indicadores
> del anteproyecto aprobado. Todas las cifras son las **recomputadas** sobre el sistema desplegado
> (`RECOMPUTO_2026-08.md`, cada una con su comando y el hash de su artefacto) y coinciden con el
> `README.md`. La tesis se entregó el **2026-08-11**.
>
> Leyenda: ✅ cumplido · 🟡 parcial · ❌ no alcanzado (declarado).

> **Cifras retiradas.** Versiones anteriores de este documento publicaban 90,0 % [85,0–94,4] y 7,8 m
> en OE1, robustez «72–82 %», alerta «88,7 %» con «~280 m / 25 s», OE4 «−7,0 % [6,4–7,6]» con
> «95 % de rutas que mejoran», «95 % de funcionalidad» y «replicado en Cali como prueba de
> adaptabilidad». **Ninguna debe citarse.** El motivo de cada retirada está en `RECOMPUTO_2026-08.md`.

## Tablero: prometido → obtenido → estado

| OE | Resultado esperado / indicador (anteproyecto) | Resultado obtenido | Estado |
|----|-----------------------------------------------|--------------------|--------|
| **OE1** | Modelo de IA integrado, con pruebas de funcionalidad y rendimiento, y **precisión de predicción superior al 85 %**. | k-vecinos + rumbo sobre el conjunto de prueba no visto (**n = 805**): **87,5 % de acierto a ≤50 m (IC 95 % [85,2–89,8])**; ≤100 m 92,7 %; error mediano 7,70 m; dirección correcta (<30°) 92,4 % [90,7–94,3]. `GET /trajectories/evaluate?n=806`. | ✅ en entorno simulado |
| OE1 | Robustez (implícita en «rendimiento»). | Con ruido GPS gaussiano el acierto a ≤50 m cae a **77,4 % (σ = 5 m)**, **63,7 % (10 m)** y **47,7 % (20 m)**. Con el ruido típico de un teléfono la meta del 85 % **no se sostiene**. | 🟡 declarado |
| OE1 | Informe de caracterización con especificaciones de calidad y patrones. | Análisis hecho (TrajCL, TRACLUS, Fréchet). Su redacción corresponde al documento de tesis, que no vive en este repositorio. | ✅ análisis · redacción fuera del repo |
| **OE2** | Modelo de IA con pruebas y **precisión superior al 85 %**. | Índice RTM multivariable y configurable sobre **475 celdas** de 150 m, con datos DANE 2018, OSM y Policía. Orden espacial robusto a perturbaciones de los pesos: **ρ = 0,9898** (mínimo 0,9481). Curva horaria de amplitud ×1,17 con pico a las 19:00, **supuesto de diseño no calibrado con dato local**. Sin verdad-terreno georreferenciada no hay precisión que medir. | ❌ precisión ≥85 % no alcanzada · índice ✅ |
| OE2 | Informe de recopilación, preprocesamiento y categorización de datos. | Hecho: caracterización de 4.045 homicidios (85,8 % arma de fuego, 56,6 % sicariato, 55,2 % rural) y reconstrucción del índice. `VALIDACION_RIESGO.md`. | ✅ |
| **OE3** | Sistema de recomendaciones operativo con **69 % de precisión** en identificación de áreas de riesgo y rutas optimizadas en tiempo real. | Ruteo ponderado por riesgo (`/route/build`) y alerta evaluada en el punto de operación real (percentil 0,70): a la hora pico **99,1 %** de los recorridos recibe aviso, **65,8 %** cruza zona de nivel alto; el **58,7 %** de los avisos precede a la entrada, con mediana de **756 m (91 s)**. El 69 % de identificación depende de la misma verdad-terreno que falta en OE2. | 🟡 sistema ✅ · 69 % ❌ |
| OE3 | Panel visual con **al menos tres capas** (riesgo, puntos de interés, rutas). | Riesgo, lugares (`/pois`), ruta segura y directa, recorrido y corredores, en escritorio y en la app. | ✅ |
| **OE4** | Informe sobre **≥5 escenarios** urbanos, con **mejora de al menos 30 %**. | 45 escenarios de alerta y barrido origen-destino de 1.200 rutas (40 pares × 5 horas × 6 valores de λ). En la configuración de fábrica (λ = 2,5): **−4,84 % de exposición (IC 95 % [3,62–6,22])**, bootstrap por conglomerados sobre 40 pares, con 1,7 % de sobrecosto; mejora el **100 %** de los recorridos. En λ = 5: −5,88 %. **Ninguna ruta llega al 30 %.** | 🟡 escenarios ✅ · 30 % ❌ |
| OE4 | Sistema revisado y optimizado, con **95 % de funcionalidad operativa sin errores críticos**. | El «95 %» no tenía denominador y se retiró. La cifra medida hoy: **104/104 pruebas automáticas del cliente móvil**, **16/16 invariantes de `/route/build`** (Tumaco y Cali) y **67 comprobaciones de humo del backend** (supresión de datos, identidad, errores de base de datos, riesgo por ciudad y validación de reportes). Sistema desplegado en `https://englergz-nomadaai.hf.space`. | ✅ con denominador |

## Lo que está sólido

- **OE1 supera la meta en el entorno simulado**, con el límite inferior del IC por encima del 85 % y
  sobre datos no vistos. La caída bajo ruido GPS está medida, no supuesta.
- **Marco de riesgo auditable**: cada factor, su peso y el motivo de apagarlo quedan en
  `risk_config.<ciudad>.json`, y el panel admin los muestra por ciudad.
- **Ruteo que nunca empeora la exposición**: está garantizado por construcción (Dijkstra sobre un coste
  que incluye el riesgo). Lo que se contrasta empíricamente es la magnitud.
- **Producto real**: API y escritorio desplegados; app Android/iOS con actualizaciones por aire; panel
  admin con datos de producción.
- **Reproducibilidad**: semillas fijas, hash estable del ruido y artefactos con `sha256` en
  `services/api/scripts/GOLDEN.md`.

## Límites declarados

1. **Datos simulados.** Las trayectorias salen de SUMO sobre la red vial real de Tumaco. Falta validar
   con GPS real.
2. **Sin verdad-terreno de delito.** Los homicidios abiertos no traen coordenada ni hora. Por eso OE2
   (≥85 %) y OE3 (69 %) quedan sin alcanzar.
3. **El margen de OE4 lo pone el territorio.** La red vial de Tumaco ofrece pocas alternativas; el
   ≥30 % no se alcanza con ningún λ evaluado.
4. **Cali es portabilidad técnica, no validación del marco.** El pipeline corre allí (4.268 celdas) y
   rutea sobre la red de OpenStreetMap, pero la prueba de si el factor socioeconómico reordena el mapa
   resultó **no concluyente** (ρ con/sin factor: Tumaco 0,9841, Cali 0,8491). Ver `T6B_CRITERIO.md`.
   Sobre Cali no se ha corrido el barrido canónico de OE4.
5. **Percepción ciudadana** no medida: requiere encuesta con usuarios reales.

## Sobre «¿el modelo aprende con el uso?»

El modelo de destino es de **recuperación**: no reentrena, pero su base crece con cada trayectoria
observada. En la demo los datos son simulados, así que esa mejora con el uso es una **capacidad del
producto**, no un indicador medido de la tesis.

## Veredicto (2026-09-16)

**OE1 cumplido** en entorno simulado, con robustez declarada. **OE3 y OE4 cumplidos en su parte
operativa** (sistema, capas, escenarios, funcionalidad con denominador) y **no alcanzados en sus
umbrales numéricos** (69 % y 30 %). **OE2 entrega un índice fundamentado y robusto, sin la precisión
≥85 %**, que exige microdato georreferenciado. Los incumplimientos están medidos y explicados; ninguno
se presenta como logrado.
