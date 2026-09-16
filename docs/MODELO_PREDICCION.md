# Modelo de Predicción de Destino (OE1)

> **NómadaAI** · Trabajo de Grado, MGTIC, Facultad de Ingeniería, Universidad de Nariño. Autor:
> Engler González Prado. Director: PhD. Manuel Ernesto Bolaños Gonzáles.
> La aplicación lo expone en `services/api` (`/predict/online`, `/predict/destination`,
> `/trajectories/evaluate`).

Responde la pregunta central del primer objetivo: **dado el inicio del recorrido de una persona,
¿hacia dónde se dirige?** El componente tiene dos partes complementarias: **caracterizar** la
movilidad y **predecir** la continuación del trayecto.

---

## 1. Datos y variables

El insumo es el conjunto maestro de trayectorias de la simulación de Tumaco (SUMO), derivado de la
base de simulación del PhD. Andrés Oswaldo Calderón Romero [T0]. Cada registro es la posición de un agente en un instante:

| Variable | Significado |
|----------|-------------|
| `id` | identificador del viaje (el prefijo indica el tipo: `mot…`, `car…`, `bus…`, `truck…`) |
| `x` | coordenada X (EPSG:3857, metros) |
| `y` | coordenada Y |
| `t` | tiempo (segundos desde el inicio del recorrido) |
| `kind`/tipo | clase del vehículo (moto, carro, bus, camión) |

Una **trayectoria** = secuencia ordenada por `t` de puntos `(x, y)` de un `id` de cierto `tipo`.
Composición: predomina la **motocicleta**, coherente con Tumaco.

---

## 2. Caracterización de la movilidad

Tres técnicas complementarias describen *cómo se mueve la ciudad*:

- **Aprendizaje de representaciones (TrajCL/TSMini)** [T1], [T2]: un modelo **Transformer
  auto-supervisado (contrastivo)** codifica cada trayectoria en un *embedding*; la similitud se mide
  por **coseno**. Sirve para **caracterizar** y recuperar trayectorias parecidas.
- **Descubrimiento de corredores (TRACLUS)** [T3]: *partition-and-group* — segmenta las trayectorias
  y agrupa los segmentos con **DBSCAN** [T4] para descubrir los corredores más transitados.
- **Recuperación por distancia de Fréchet** [T5]: dada una trayectoria, recupera las más parecidas.

---

## 3. Predicción de destino — método

La predicción operativa es por **recuperación / analogía (k-vecinos espaciales + rumbo)**,
interpretable y eficiente:

1. Del prefijo observado se toman el **último punto** y el **rumbo** (ángulo de avance).
2. Con un **KDTree** [Tk] se buscan, entre los puntos de inicio de segmento de las trayectorias de
   **entrenamiento**, los vecinos dentro de radios crecientes (25 m, 60 m, 120 m), filtrando por
   **mismo tipo** y **coherencia de rumbo**.
3. La **continuación** de los mejores vecinos se propone como predicción (top-k).
4. **Control anti-fuga:** se excluye explícitamente la propia trayectoria (`exclude_id`); el conjunto
   **test** no se indexa (división train/test).

> **Coherencia con el anteproyecto (declaración honesta):** el anteproyecto previó redes neuronales
> recurrentes (RNN). La implementación es por **analogía/vecino más cercano + rumbo**, una técnica de
> aprendizaje basado en instancias [Tr], competitiva e interpretable. Se declara la desviación; queda
> abierta la incorporación de un modelo neuronal supervisado para comparación.

### 3.1 Ablation — ¿ayudan los embeddings TrajCL a la predicción?
Experimento controlado (geom vs. geom+embedding): añadir la similitud por embedding **no mejora** la
predicción (hit@50 m: 79,1 % → 79,2 %). **Conclusión:** TrajCL se usa para **caracterización** (§2), no
para esta predicción de destino.

Este experimento se corrió sobre una muestra de 800 trayectorias con la partición del prototipo
(semilla 7), en la etapa de investigación. Su 79 % no es comparable con el 87,5 % de §4.1, que se
mide con el predictor desplegado sobre las 805 trayectorias de prueba; lo que importa aquí es la
diferencia entre las dos columnas (0,1 puntos), no el nivel.

---

## 4. Evaluación (protocolo y métrica)

- **División train/test** reproducible (semilla fija): el modelo solo indexa *train*; se mide sobre
  el conjunto **test no visto** (evita el sesgo de "predecir algo ya conocido").
- **Métrica oficial — error a horizonte emparejado (FDE/ADE):** se compara el punto **predicho**
  contra el punto **real** recorrido a la **misma longitud de arco** (lo que el modelo realmente
  predice: la continuación, no el destino final del viaje completo).
- Se reporta además el error **vs. destino final** como referencia de transparencia (tarea de
  horizonte largo, mucho más difícil).

### 4.1 Resultados (medidos sobre el sistema desplegado)

Todas las cifras salen de una sola fuente, un solo modelo y una sola muestra: el predictor
desplegado, evaluado sobre las **805 trayectorias del conjunto de prueba** con
`GET /trajectories/evaluate?n=806` (el servicio arranca con `PYTHONHASHSEED=0` y el ruido usa un hash
estable, así que el comando da lo mismo entre reinicios). Intervalos al 95 % por bootstrap.

| Lectura | Resultado |
|---------|-----------|
| **Acierto a ≤50 m** | **87,5 %** (IC 95 % [85,2–89,8]) |
| Acierto a ≤100 m | 92,7 % |
| Dirección correcta (<30°) | 92,4 % [90,7–94,3]; error angular mediano 0,25° |
| Error mediano (FDE al horizonte emparejado) | 7,70 m [7,0–8,5] |
| Acierto a ≤50 m por tipo | bus 91,1 % (n = 45) · carro 90,9 % (198) · **moto 85,8 % (555)** · camión 100 % (7) |
| Error mediano por tipo | bus 9,20 m · carro 7,95 m · moto 7,70 m · camión 7,00 m |
| Mejora sobre la línea recta · sobre Markov | +13,4 pp (74,1 % → 87,5 %) · +47,5 pp (40,0 % → 87,5 %) |
| Robustez a ruido GPS (σ = 5 · 10 · 20 m) | 77,4 % · 63,7 % · 47,7 % (`&noise_m=`) |
| Acierto al **destino final** del viaje (≤100 m) | 1,00 % [0,0–3,0] en una muestra de 100: tarea de horizonte largo, se declara como referencia |

Supera la meta del **85 %** fijada como indicador de OE1 en el anteproyecto, en el entorno simulado
y con el límite inferior del intervalo por encima de la meta. La clase más difícil es la motocicleta,
que es además el 69 % del conjunto de prueba y el vehículo característico de Tumaco. Con el ruido
típico de un teléfono (5 a 10 m) el acierto queda entre 63,7 % y 77,4 %, por debajo de la meta; es
un resultado medido, no una salvedad.

Además, la aplicación calcula una **efectividad en vivo** que compara, en cada paso, el punto
predicho con el recorrido real seguido (sirve también para **rutas nuevas**).

**Cifras retiradas.** Versiones anteriores de este documento publicaban «~90 %», «~96 %», «~8 m»,
medianas por tipo al destino final de 578 / 789 / 1.385 / 1.372 m y un 1,4 % de acierto al destino.
El 90 % salía de las primeras 200 trayectorias del conjunto de prueba en orden alfabético, que no
contenían ninguna moto; las medianas por tipo venían de un archivo de 4.029 trayectorias sin
partición. Ninguna debe citarse; el detalle está en `RECOMPUTO_2026-08.md` §1.1, §1.14 y §1.17.

### 4.2 Hallazgos de validez
1. **Sin fuga de datos:** el predictor excluye la propia trayectoria (`exclude_id`) y el conjunto de
   prueba no se indexa. Se comprobó partiendo por la partición real: entrenamiento 92,0 % y prueba
   91,6 % de dirección correcta, sin diferencia.
2. **Reproducible:** iteración ordenada de los conjuntos, semilla fija y hash estable del ruido; el
   mismo comando devuelve el mismo resultado entre reinicios del servicio.
3. **Limitación:** datos de simulación SUMO con rutas compartidas, lo que favorece la recuperación;
   validar con partición no redundante y con datos GPS reales es trabajo futuro.

---

## 5. Articulación con OE3

La continuación predicha alimenta la **alerta anticipada** (OE3): se evalúa el riesgo (OE2) de las
zonas que se alcanzarán a la **hora estimada de llegada** y se avisa **antes** de ingresar a una zona
de alto riesgo. Ver [MODELO_RIESGO.md](MODELO_RIESGO.md) y [METODOLOGIA.md](METODOLOGIA.md).

---

## Referencias

- [T0] A. O. Calderón Romero, *Base de simulación de movilidad (red vial de Tumaco + trayectorias SUMO)*, Universidad de Nariño. https://github.com/aocalderon/Research/tree/master/Scripts/SUMO
- [T1] X. Chang, E. Tanin, J. Qi et al., "Contrastive Trajectory Similarity Learning with Dual-Feature Attention (TrajCL)," en *Proc. IEEE ICDE*, 2023.
- [T2] Y. Chang, X. Cai, C. S. Jensen y J. Qi, "K Nearest Neighbor-Guided Trajectory Similarity Learning (TSMini)," *arXiv:2502.00285*, 2025.
- [T3] J.-G. Lee, J. Han y K.-Y. Whang, "Trajectory clustering: A partition-and-group framework (TRACLUS)," en *Proc. ACM SIGMOD*, 2007, pp. 593–604.
- [T4] M. Ester, H.-P. Kriegel, J. Sander y X. Xu, "A density-based algorithm for discovering clusters (DBSCAN)," en *Proc. KDD*, 1996, pp. 226–231.
- [T5] H. Alt y M. Godau, "Computing the Fréchet distance between two polygonal curves," *Int. J. Comput. Geom. Appl.*, vol. 5, pp. 75–91, 1995.
- [Tk] J. L. Bentley, "Multidimensional binary search trees used for associative searching (k-d tree)," *Commun. ACM*, vol. 18, no. 9, pp. 509–517, 1975.
- [Tr] S. Russell y P. Norvig, *Artificial Intelligence: A Modern Approach*, 4.ª ed. Pearson, 2020.
