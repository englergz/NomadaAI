# Crítica dura y puntos de mejora (sin sesgo)

> Autocrítica **objetiva** del trabajo, científico-analítica y como producto comercial. El objetivo
> es **encontrar las grietas**, no defenderlas. Declararlas con honestidad fortalece la tesis y ordena
> el producto. Política: cada afirmación que sostenemos con literatura debe apoyarse en **2-4
> referencias (IEEE)**, no una sola (ver §4).
>
> **Estado a 2026-09-12.** Cifras alineadas con `RECOMPUTO_2026-08.md` y el `README.md`; las
> marcas ✅/🟡 reflejan lo que ya existe en código.

---

## 1. Críticas científico-analíticas (las que más duelen)

1. **El modelo de riesgo NO está validado contra verdad-terreno** a nivel punto-a-punto. Es un índice
   teórico-compuesto; el análisis de sensibilidad prueba que el *ranking* es **robusto**, no que sea
   **correcto**. 🟡 **VÍAS DE VALIDACIÓN (no depende solo de la DIJIN):** (a) **temporal** —el patrón
   noche/fin de semana coincide con evidencia nacional independiente [CEJ]—; (b) **dirección de
   factores** —55,2 % de homicidios en zona rural/periférica corrobora periferia→riesgo—; (c)
   **convergente** con percepción CEDRE; (d) **patrón de puntos con ACLED** (eventos georreferenciados,
   PAI); (e) **calibración plena** con reporte ciudadano o DIJIN. Ver `VALIDACION_RIESGO.md` §5.
2. **Los pesos de los factores son fijados a mano** (densidad 0,35 / periferia 0,30 / actividad 0,20 /
   policía 0,15 sobre los factores **activos** de Tumaco). Son **suposiciones parametrizadas**, sin
   ajuste guiado por datos. 🟡 **REENCUADRADO (no es solo debilidad):** el IRU es un **framework
   configurable** — cada factor se habilita/pesa **por contexto** (ciudad/zona), y esa configurabilidad
   *es* el aporte de portabilidad (Tumaco y Cali = dos configuraciones). Los pesos actuales son
   **cold-start informado por teoría**; su **ranking es robusto** (ρ≈0,99); la **calibración por datos**
   y los **pesos locales por celda (GWR)** son la evolución, y **no dependen solo de la DIJIN**: el
   **reporte ciudadano** genera el dato de resultado que los habilita (ver `MODELO_RIESGO.md` §3–§4,
   §6). ✅ **Externalizados** a `risk_config.<ciudad>.json`; el panel admin los muestra por ciudad con
   su motivo (2026-09-12). Editarlos desde la interfaz sigue pendiente: exige re-correr el pipeline.
3. **La hipótesis "periferia = más riesgo".** Se temía que estuviera invertida. ✅ **ARBITRADA (dato
   independiente):** con los homicidios de la Policía, **el 55,2 % ocurre en zona RURAL/periférica** vs.
   44,8 % urbana, aun cuando la población se concentra en el núcleo → la **dirección del factor es la
   correcta** (periferia/aislamiento → más violencia dirigida, coherente con corredores de economías
   ilegales y baja presencia estatal), **no invertida**. Pendiente: la magnitud intra-urbana exacta
   (microdato). Ver `VALIDACION_RIESGO.md` §5(b).
4. **El acierto de OE1 está inflado por el dato limpio** (SUMO). ✅ **MEDIDO** con ruido GPS gaussiano
   (`/trajectories/evaluate?noise_m=σ`, n = 805): 87,5 % (0 m) → **77,4 % (5 m)** → **63,7 % (10 m)** →
   47,7 % (20 m). Con el ruido típico de un teléfono el rendimiento esperado es **~64–77 %**, por
   debajo de la meta del 85 %. Es un **resultado cuantificado** y se declara así.
5. **Casi todo deriva de un solo dataset sintético (SUMO).** La predicción, el grafo de rutas y el
   factor "actividad" del riesgo salen de las mismas trayectorias. Hay **circularidad**. 🟡 **ACOTADA:**
   (i) los datos simulados son el **alcance aprobado** del anteproyecto, no un atajo; (ii) SUMO corre
   sobre la **red vial real** de Tumaco con OD realista → valida el **método**, no las cifras exactas de
   la ciudad; (iii) la circularidad es **parcial**: el riesgo usa datos **independientes** (DANE,
   homicidios Policía, OSM) y **solo el factor "actividad" (0,20)** viene de SUMO — el 80 % del índice
   no depende del dataset sintético. El cierre pleno = GPS real (fase de app).
6. **El patrón horario es nacional, transferido a Tumaco.** ✅ **JUSTIFICADO (dato + mecanismo):** el
   pico **nocturno (20:00, +83 % sobre el promedio) y de fin de semana (+54 %)** con **76,8 % arma de
   fuego** [CEJ, Reloj de la Criminalidad] es **coherente con la modalidad de Tumaco** (85,8 % arma de
   fuego, 56,6 % sicariato): el sicariato es violencia armada nocturna, no de riña diurna. Deja de ser
   "transferido a ciegas": es un **prior informado y consistente** con el mecanismo local. Pendiente:
   curva horaria propia de Tumaco (microdato). Ver `VALIDACION_RIESGO.md` §5(a).
7. **OE4 (−4,84 %) es un proxy de un proxy.** Mide reducción de exposición sobre la superficie de riesgo,
   no una baja observada del delito. 🟡 Su validez externa **crece con la validación #1** (c/d:
   convergente CEDRE + patrón de puntos ACLED): a mayor validación de la superficie, mayor grado el
   proxy. Internamente es consistente y preciso (IC estrecho); externamente, supeditado a #1.
8. ~~Sin estadística inferencial.~~ ✅ **RESUELTO:** intervalos de confianza 95 % por bootstrap en OE1
   (87,5 % [85,2–89,8]) y OE4 (4,84 % [3,62–6,22], bootstrap por conglomerados sobre 40 pares).
9. **Una sola ciudad validada.** 🟡 **PORTABILIDAD TÉCNICA, NO VALIDACIÓN:** el pipeline corre en
   **Cali** (4.268 celdas) y rutea sobre OSM, pero el efecto del factor socioeconómico resultó **no
   concluyente** (ρ con/sin factor: Tumaco 0,9841, Cali 0,8491; `T6B_CRITERIO.md`) y sobre Cali no se
   ha corrido el barrido canónico de OE4. No demuestra la validez del marco.
10. **Datos desactualizados/limitados.** Censo DANE 2018 (7 años); homicidios sin hora ni coordenadas;
    OSM sin iluminación. La base empírica intra-urbana es débil.
11. **El tiempo solo cambia la INTENSIDAD, no los lugares.** `riesgo = percentil_espacial × hora × día`:
    la hora/día escalan el riesgo de forma **uniforme**; el *ranking espacial* es constante. En la
    realidad los hotspots **se desplazan** por hora (zona de bares peligrosa de noche, no a mediodía).
    Capturar esa **interacción espacio-temporal** requiere dato espacio-temporal de delito. 🟡
    **SOLUCIÓN DE DISEÑO (implementable):** hacer la modulación temporal **específica por factor** en
    vez de global — p. ej., subir el peso de **periferia/aislamiento de noche** (menos vigilancia) y de
    los **POIs de vida nocturna** en su franja. Así el *ranking* espacial cambia con la hora sin
    necesitar el microdato. Queda especificado en el framework (`MODELO_RIESGO.md` §7); su
    implementación va a la sesión de código.

## 2. Críticas como producto comercial

1. **Cero usuarios reales / cero validación de mercado.** La "efectividad" y el BI corren sobre datos
   simulados o auto-generados. No hay un solo viaje real de un usuario.
2. **La propuesta de valor entrega ~5 % de reducción de exposición** (−4,84 % en λ = 2,5). ¿Alcanza para que alguien cambie
   de ruta o pague? Dudoso *product-market fit* con ese margen.
3. **Riesgo ético/legal serio.** Pintar una zona de "verde/seguro" cuando no lo es puede crear **falsa
   seguridad** (daño real, responsabilidad legal). Etiquetar el riesgo por barrio puede **estigmatizar**
   comunidades o ser usado en su contra. En una ciudad en conflicto, es delicado. 🟡 **MITIGABLE ya:**
   (a) **descargo** visible ("índice de referencia relativo, no garantía de seguridad"); (b) hablar de
   **"menor exposición relativa"**, nunca de "seguro"; (c) sección de **ética** en la tesis. — descargo
   añadido en la app (Ayuda).
4. **El dato es estático** (censo 2018, homicidios históricos). Un producto necesita **actualización
   viva** → depende del bucle de **reporte ciudadano**, que ya existe en la app pero todavía
   no alimenta el índice (factor R3 pendiente).
5. **No hay foso competitivo (moat).** RTM y k-vecinos son estándar. ¿Qué es defendible frente a un
   competidor con más datos?
6. **Costo de onboarding por ciudad.** Cada ciudad requiere ensamblar a mano trayectorias + DANE +
   OSM + policía. No está automatizado → no escala barato.
7. **Privacidad/regulación.** Rastrear movimiento + perfilar riesgo toca Ley 1581/2012; el manejo de
   datos de criminalidad es sensible. 🟡 **MITIGADO:** términos y política v1.0.0 con Ley 1581,
   aceptación registrada, borrado de datos y cifrado en reposo (2026-08/09).
8. ~~La app no existe.~~ ✅ **Existe** (Android/iOS con Expo): ruta segura, alertas, reporte,
   segundo plano, modo sin conexión y actualizaciones por aire. Sin publicar en tiendas y sin usuarios
   reales, que es la grieta que queda (#1 de esta sección).
9. **Adopción/confianza sin evidencia.** No hay investigación con usuarios ni con autoridades: no
   sabemos si lo usarían o confiarían.

## 3. ¿Estamos "bien"? Veredicto honesto
- **Como tesis de maestría:** sí, **con la honestidad por delante**. OE1 cumple (con la salvedad del
  dato simulado), OE3 cumple en lo operativo (sin el 69 %), OE4 tiene proxy medido (−4,84 %, sin el 30 %), y el **aporte real** es el *marco replicable en
  contexto de escasez* + la discusión metodológica. **Declarar las 10 grietas de §1 la fortalece.**
- **Como producto comercial:** **todavía no.** Faltan usuarios reales, validación del valor y bucle de
  datos vivo. La app y el marco legal básico ya existen (2026-09). Hoy es un **prototipo de investigación**, no un producto.

## 4. Política de citación (2-4 fuentes por afirmación, IEEE)
Varias afirmaciones hoy penden de **una sola** cita. Hay que **reforzarlas**. Estado:

| Afirmación | Cita actual | Reforzar con (candidatos verificables) |
|------------|-------------|----------------------------------------|
| Densidad/actividad → oportunidad de delito | Cohen & Felson [1] | Brantingham & Brantingham [2]; Sampson et al. [3] |
| Aislamiento/baja vigilancia → violencia | Jacobs [4]; Newman [5] | Shaw & McKay [6]; Sampson et al. [3] |
| Iluminación → delito | Welsh & Farrington [7] | *(reforzar: Painter; Farrington & Welsh; Chalfin et al. — verificar)* |
| RTM como marco ante escasez | Caplan & Kennedy [8] | *(reforzar: Kennedy et al.; Drawve — verificar)* |
| Patrón temporal (noche/domingo) | CEJ 2019 [9]; INMLCF [10] | *(reforzar con 1-2 artículos académicos — verificar)* |
| Pesos locales por zona (GWR) | Fotheringham et al. [11] | *(reforzar: Brunsdon; Cahill & Mulligan — verificar)* |

> **Regla:** no inventar referencias. **Estado: reforzado** — cada afirmación tiene ahora 2-4 fuentes
> verificadas en `REFERENCIAS.md` (Painter, Chalfin et al., Drawve, Sampson et al., Ratcliffe,
> Cahill & Mulligan, Felson & Boba, etc.).

## 5. Mejoras priorizadas (qué atacar y en qué orden)
1. **Reforzar citación** (2-4 por afirmación) en todos los docs — barato, sube el rigor de inmediato.
2. ✅ **Intervalos de confianza / significancia** en OE1 y OE4 (bootstrap sobre el held-out y el barrido).
3. **Declarar explícitamente** en la tesis la no-validación del riesgo y el sesgo del dato simulado
   (ya iniciado en `VALIDACION_RIESGO.md` — reforzar).
4. 🟡 **Prueba de replicabilidad mínima**: el pipeline ya corre en Cali, pero solo prueba portabilidad
   técnica; T6b resultó no concluyente. Pasar a «demostrar» exige el barrido canónico sobre Cali y dato
   de resultado.
5. **Marco ético** (falsa seguridad, estigmatización, privacidad) como sección de la tesis.
6. **Bucle de datos vivo** (reporte ciudadano) + **validación con usuarios** → convierte prototipo en
   producto y habilita GWR/calibración real.

## Referencias (IEEE)
[1] L. E. Cohen and M. Felson, "Social change and crime rate trends: A routine activity approach," *American Sociological Review*, vol. 44, no. 4, pp. 588–608, 1979.
[2] P. L. Brantingham and P. J. Brantingham, "Criminality of place: Crime generators and crime attractors," *European Journal on Criminal Policy and Research*, vol. 3, no. 3, pp. 5–26, 1995.
[3] R. J. Sampson, S. W. Raudenbush, and F. Earls, "Neighborhoods and violent crime: A multilevel study of collective efficacy," *Science*, vol. 277, no. 5328, pp. 918–924, 1997.
[4] J. Jacobs, *The Death and Life of Great American Cities*. New York, NY, USA: Random House, 1961.
[5] O. Newman, *Defensible Space: Crime Prevention Through Urban Design*. New York, NY, USA: Macmillan, 1972.
[6] C. R. Shaw and H. D. McKay, *Juvenile Delinquency and Urban Areas*. Chicago, IL, USA: Univ. of Chicago Press, 1942.
[7] B. C. Welsh and D. P. Farrington, "Effects of improved street lighting on crime: A systematic review," *Campbell Systematic Reviews*, vol. 4, no. 1, pp. 1–51, 2008.
[8] J. M. Caplan, L. W. Kennedy, and J. Miller, "Risk terrain modeling: Brokering criminological theory and GIS methods for crime forecasting," *Justice Quarterly*, vol. 28, no. 2, pp. 360–381, 2011.
[9] Corporación Excelencia en la Justicia, "Reloj de la Criminalidad," Bogotá, Colombia, 2019.
[10] Instituto Nacional de Medicina Legal y Ciencias Forenses, *Forensis: Datos para la Vida*. Bogotá, Colombia.
[11] A. S. Fotheringham, C. Brunsdon, and M. Charlton, *Geographically Weighted Regression*. Chichester, UK: Wiley, 2002.
