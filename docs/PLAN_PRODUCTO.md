# Plan para perfeccionar Nómada.AI (modelo robusto + producto)

> Hoja de ruta para: (1) un **modelo de riesgo defendible y citable**, y (2) el **producto/app**
> (Android/iOS) escalable y replicable a otras ciudades. Cada factor de riesgo va con su respaldo.
>
> **Estado a 2026-09-12.** Es el documento de **visión** escrito en julio de 2026. Lo construido y lo
> pendiente se sigue en `PENDIENTES_PRODUCTO.md`; las notas ✅/🟡/❌ de abajo marcan dónde la realidad
> ya difiere del plan.

---

## Parte A — Modelo de riesgo robusto y defendible

### A.1 Principio: Risk Terrain Modeling (RTM)
Combinamos **factores del territorio** (no incidentes puntuales, que no tenemos) en un índice por
celda. Marco: **Caplan & Kennedy (2011)**. Esto es lo correcto ante escasez de microdato.

### A.2 Factores propuestos (cada uno con evidencia)
| Factor | Señal | Efecto | Respaldo citable | Fuente de dato |
|--------|-------|--------|------------------|----------------|
| **Iluminación** | calles con poca/nula luz | ↑ riesgo | **Welsh & Farrington (2008)** meta-análisis Cochrane: mejor alumbrado ↓ delito ~21% | OSM `highway=street_lamp`, `lit=yes/no` (Overpass) |
| **Periferia / aislamiento** | lejos del centro, baja vigilancia | ↑ riesgo | **Jacobs (1961)** "ojos en la calle"; **Newman (1972)** espacio defendible | distancia al centroide (ya) |
| **Densidad poblacional** | más gente/objetivos | ↑ exposición | **Cohen & Felson (1979)** actividades rutinarias; Brender (2012) | DANE manzana (ya) |
| **Actividad/tráfico** | concurrencia | ± (matiz) | actividades rutinarias | trayectorias SUMO (ya) |
| **Generadores/atractores** | bares, expendios, cantinas | ↑ riesgo | **Brantingham & Brantingham (1995)** crime generators/attractors | OSM `amenity=bar/pub/nightclub` (ya bajamos POIs) |
| **Presencia estatal** | lejos de policía/instituciones | ↑ riesgo | CEDRE (2024): débil presencia estatal en periferia | OSM `amenity=police`; distancia |
| **Infraestructura precaria** | paredes madera, hacinamiento, sin servicios | ↑ vulnerabilidad | **Shaw & McKay (1942)** desorganización social; CEDRE (2024) NBI | CEDRE por zona (7 zonas) / DANE |
| **Temporal (hora/día)** | noche/madrugada, fines de semana | ↑ riesgo | **INMLCF – Forensis** (patrón horario de homicidios en Colombia) ← *conseguir y citar* | Forensis (Medicina Legal) |

### A.3 Índice y calibración
- Índice = Σ wᵢ · pctl(Fᵢ) sobre los factores **activos**. Pesos reales hoy (fuente de verdad
  `rebuild_risk_full.py`): **densidad 0.35 / periferia 0.30 / actividad 0.20 / lejanía policía 0.15**
  (Σ=1). Iluminación, POIs de riesgo y socioeconómico están **definidos pero deshabilitados** en
  Tumaco (sin dato apto / homogeneidad) — ver `MODELO_RIESGO.md` §3.
- **Normalización por percentil espacial** (evita que todo se vea rojo) + modulación temporal.
- **Análisis de sensibilidad** (ya) para robustez del ranking (ρ≈0,99).
- **Framework configurable:** cada factor `{enabled, weight}` por ciudad (renormaliza a Σ=1 sobre los
  activos). Tumaco y Cali = dos configuraciones. 🟡 **(2026-09-12)** el panel admin **muestra** factores,
  pesos y motivos por ciudad; editarlos exige re-correr el pipeline offline y no se hace desde la UI.

### A.4 Curva temporal (pendiente clave)
Hoy es **supuesto**. Acciones: (a) obtener el patrón horario/diario de **Forensis (INMLCF)** o un
estudio revisado por pares y citarlo; (b) si no, dejarla como **parámetro de escenario** explícito,
sin afirmar una curva validada. Piso nocturno ya aplicado (la violencia no se anula de madrugada).

### A.5 Validación
- **Con lo que hay:** caracterización real (arma/modalidad), sensibilidad, coherencia con CEDRE.
- **Cuando llegue DIJIN:** precisión/recall/F1 espacial → cierra el ≥85%.
- **Reporte ciudadano** (app): calibración continua con datos comunitarios (participativo).

---

## Parte B — Producto / App móvil (Android · iOS)

### B.1 Stack
- **Expo / React Native**, reutilizando la **API FastAPI** y **Clerk** (SDK móvil). Un solo backend
  para web y móvil. Mapas: MapLibre Native.

### B.2 Vista principal
- Mapa en vivo + **navegación segura** (turn-by-turn), capa de riesgo (toggle), ruta segura vs directa.
- Barra inferior: destino, prioridad de seguridad, hora. Botón grande "Ir seguro".

### B.3 Notificaciones (3 tipos, no confundir)
1. **Alertas de proximidad (locales):** al acercarse a una zona de alto riesgo en la ruta.
   **Una sola vez por zona** (ya corregido en web). Silencio configurable.
2. **Push (servidor):** incidente reportado cerca, cambio de riesgo por hora, alerta comunitaria.
3. **Banners flotantes in-app:** estado ("generando ruta", "ruta segura −X%"), no intrusivos.

### B.4 Reporte de incidentes (clave)
- El usuario reporta: tipo (robo, riña, iluminación dañada, presencia sospechosa), ubicación, foto,
  hora. → alimenta el modelo (**participativo**, Arteaga Botello 2005) y **llena el vacío de datos**.
- Moderación/anti-abuso: rate-limit, verificación, agregación (no exponer reportes crudos).

### B.5 Escalable / replicable a otras ciudades
- **Config por ciudad** (`city`): dataset de trayectorias + malla de riesgo + POIs + bbox. Cambiar de
  ciudad = cambiar datos, no código. La DB ya tiene columna `city`.
- Onboarding de una ciudad nueva: (1) trayectorias/OD, (2) DANE manzana, (3) OSM (luz, POIs, policía),
  (4) rebuild del índice, (5) publicar.

### B.6 Validaciones y seguridad (implementar bien desde ya)
- **Entrada:** validar todos los payloads (Pydantic en API; esquemas en cliente).
- **Auth:** Clerk (verificación de token en escritura — ya). Roles a futuro (usuario/moderador).
- **Permisos móviles:** ubicación (en uso/segundo plano), notificaciones — pedir en contexto.
- **Datos:** integridad de reportes, deduplicación, rate-limit, RLS/row-level en DB por usuario.
- **Privacidad:** anonimizar, cumplir Ley 1581/2012; no rastrear sin consentimiento.

---

## B.6.1 Vehículo del usuario (registro)
En el registro/perfil, el usuario puede indicar su **vehículo más usado** (opcional). Se guarda como
**predeterminado** y se puede **cambiar en cada viaje**. Saber el vehículo mejora la predicción (rutas
según el tipo: moto/carro/bus/camión). UX: un **banner no intrusivo** motiva a indicarlo, aclarando que
es opcional y cambiable. Tipos con datos en el demo: moto, carro, bus, camión (taxi ≈ carro).

## B.7 Multi-ciudad en la UI (selector + animación)
- El rótulo "Tumaco" pasa a ser un **selector de ciudad** (Tumaco, Cali, …). Al cambiar: `map.flyTo`
  hacia la nueva ciudad + recarga de su capa de riesgo (`/risk/zones?city=…`). Cada ciudad tiene su
  `<city>_riesgo_horario.csv` (ya generado para Cali). El backend elige el archivo por `city`.
- Onboarding de ciudad = correr `rebuild_risk_city.py --city X --mpio "X" --bbox …` (DANE+OSM). Sin código.

## B.8 Arquitectura escritorio vs. móvil (decisión de implementación)
- **La vista actual (panel + simulador) es de ESCRITORIO** (herramienta de análisis/demo/tesis).
- **Desde el móvil (navegador)** debe cargar la **app de usuario** (mapa + navegación segura + alertas),
  no el panel de análisis. Detección por viewport/`user-agent`; **mismo dominio**, distinta vista.
- **App nativa Android/iOS y web = MISMO código** (Expo / React Native + React Native Web): una sola
  base para móvil y web de usuario; el panel de escritorio queda como vista aparte (web).
- ~~Capas nativas por SO (Apple Maps en iOS, Google Maps en Android)~~ **Decisión tomada distinta:**
  MapLibre en las tres plataformas (MapLibre React Native en Android/iOS, MapLibre GL JS en web) con
  base vectorial de OpenFreeMap. Ubicación en segundo plano y permisos = APIs nativas de Expo.
- ❌ **(2026-09-12)** la vista de usuario en el navegador del móvil no existe todavía: el dominio sirve
  el escritorio. Hosting pendiente de decidir.

## B.9 Panel de administración (config total) — visión de producto
Un **panel web de admin** para administrar TODO sin tocar código (tiene sentido y es la evolución natural):
- **Ciudades/regiones:** selectores reales del mundo (país → departamento → municipio, desde DANE/GADM);
  alta de una ciudad = elegir el municipio y correr el pipeline (`rebuild_risk_city.py`) desde la UI.
- **Pesos del riesgo por ciudad** (densidad, periferia, policía, socioec., iluminación…) editables con
  vista previa del mapa. Base para **calibración por ciudad** (y GWR cuando haya datos).
- **Ingesta de trayectorias:** subir/conectar datos de movilidad (GPS real o SUMO) por ciudad →
  reentrenar el modelo de predicción; hoy Tumaco usa SUMO, el panel lo generaliza.
- **Entrenamientos:** lanzar/monitorear reentrenos; ver totales (trayectorias, train, test) por ciudad.
- **BI de uso:** cuántos viajes vienen del **simulador** vs. de un **móvil en movimiento** (real).
  → añadir columna `source` (`sim` | `mobile`) a `sim_effectiveness` (hoy ya guarda `mode`, `session`).
- **Moderación** de reportes ciudadanos.
> Es un frente grande (roadmap), pero encaja: convierte el prototipo en una **plataforma administrable**.
>
> **Construido (2026-09-12):** menú lateral; resumen con KPIs y reportes por categoría; ciudades con
> riesgo, red vial y predicción, y sus factores con peso y motivo (solo lectura); configuración de la
> app; moderación de reportes; opiniones; alta y baja en el catálogo de ciudades. La columna `source`
> del histórico existe. **No construido:** edición de pesos con vista previa, selectores
> país → municipio, ingesta de trayectorias y entrenamientos (no caben en el Space, ver
> `PENDIENTES_PRODUCTO.md` §6.3).

## Presentación para la sustentación (objetivo: completa, contundente, fenomenal)
Guion propuesto (con las cifras y figuras ya listas):
1. **Problema** (Tumaco, violencia/inseguridad = problema #1, CEDRE) → figura de contexto.
2. **Objetivos** (textual del anteproyecto).
3. **Método** (predicción por recuperación; riesgo RTM multi-factor citado; ruteo consciente del riesgo).
4. **Resultados con IC** (recomputados, `RECOMPUTO_2026-08.md`): OE1 87,5 % [85,2–89,8]; OE3 alerta en el punto de operación (99,1 % con aviso, 58,7 % anticipados, mediana 756 m); OE4 −4,84 % [3,62–6,22].
5. **El giro honesto**: el mapa era de tráfico → reconstrucción con DANE; `img/riesgo_antes_despues.png`.
6. **Portabilidad**: el marco corre en Cali (4.268 celdas, rutea sobre OSM); el efecto del factor socioeconómico es no concluyente (T6b), y se dice así; `img/replica_cali_vs_tumaco.png`.
7. **Autocrítica** (las 10 grietas) → madurez investigativa.
8. **Producto y roadmap** (app, reporte ciudadano, multi-ciudad).
9. **Cierre**: "marco replicable que funciona en el extremo de la escasez y escala hacia la abundancia".

## Roadmap por fases
1. **Modelo v2 (corto):** 🟡 distancia a policía ✅; iluminación y POIs de riesgo **apagados con motivo**
   (sin dato apto en Tumaco). La curva temporal quedó declarada como supuesto de diseño.
2. **Cierre tesis:** ✅ entregada el 2026-08-11.
3. **App MVP:** ✅ Expo + API + Clerk; mapa, ruta segura, alertas, reporte, segundo plano, OTA, sin conexión.
4. **Producto:** 🟡 moderación ✅, multi-ciudad ✅ (Tumaco y Cali), panel BI ✅ · push ❌, fotos ❌,
   tiendas ❌.

## Referencias nuevas a citar
- Welsh, B. C., & Farrington, D. P. (2008). *Effects of improved street lighting on crime.* Campbell/Cochrane.
- Brantingham, P. & Brantingham, P. (1995). *Criminality of place: crime generators and crime attractors.*
- INMLCF — *Forensis: Datos para la vida* (patrón temporal de homicidios en Colombia).
- (Ya en `VALIDACION_RIESGO.md`): Caplan & Kennedy 2011; Jacobs 1961; Newman 1972; Cohen & Felson 1979;
  Shaw & McKay 1942; Bámaca/Brender 2014; CEDRE 2024.
