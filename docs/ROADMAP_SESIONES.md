# Roadmap de sesiones — backlog consolidado (fuente de verdad del trabajo pendiente)

> Se actualiza en cada sesión. Lo hecho se marca con fecha y commit. Orden = prioridad acordada.

## Hecho (resumen)
- ✅ Web escritorio: tokens claro/oscuro pares, branding (favicon/PWA/login), menú agrupado, fix crash StrictMode.
- ✅ App móvil Fases 0–4: scaffold Expo + shared, mapa MapLibre (web+nativo), riesgo, buscador destino
  (POIs+Nominatim con direcciones), ruta segura vs directa coloreada POR TRAMO, regla EVITAR/AVISAR,
  alertas graduadas por acción (1×zona), recorrido libre + predicción online por movimiento (~≥15 km/h),
  recorrido automático (opt-in), reporte ciudadano persistente (rate-limit servidor), Ajustes
  (tema en caliente, capas, heatmap paletas/intensidad/opacidad, vehículo B.6.1, umbral), «Tu protección»
  (/history, mode:'mobile'), FABs coherentes, licencia PolyForm NC.

## Cola de trabajo (en orden)

### R1 · Framework de riesgo configurable (brief Parte A1+A2) — SIGUIENTE
1. Golden test: hash de artifacts actuales (ver `services/api/scripts/GOLDEN.md`) — el refactor con
   config equivalente NO debe cambiar un decimal.
2. `risk_config.<city>.json`: registro de 8 factores {enabled, weight, temporal_profile, motivo}
   (densidad, periferia, actividad, policía, socioeconómico, POIs, iluminación, delito-reportado).
3. Refactor `rebuild_risk_full.py` → registro de factores; Σ=1 sobre activos; disabled=0; `--config`.
4. A2 (crítica #11): `temporal_profile` POR FACTOR (flat/night_up/nightlife/custom24) →
   `IRU = Σ w_i·TEMP_i(h)·pctl(F_i)`: el ranking espacial cambia con la hora sin microdato.
   Sincronizar MODELO_RIESGO.md §2/§7 en el mismo commit.
5. Extras acordados: endpoint `/risk/explain?cell=` (desglose w_i·pctl(F_i)); hash de config + fecha
   en los CSV de salida (reproducibilidad); re-correr pipeline y reportar números para figuras/TABLA I/ρ/OE4.

### R1b · A6 — Imagen de riesgo COMPARATIVA (al regenerar)
- Conservar la superficie anterior; presentar AMBAS (config anterior vs. actual) con rótulos de
  factores activos. Aplicar en README y MODELO_RIESGO.md. En tesis: figura adicional o nota, SIN
  solaparse con la Fig. 5 (degenerado vs. multifactor) — rotular las dos comparaciones distinto.
- Reportar números nuevos (correlaciones, zonas, ρ, OE4) para sincronizar docs + tesis.

### R2 · Adquisición de dato (A3)
- Overpass tags correctos (bar/pub/nightclub, shop=alcohol, marketplace, bus_station) Tumaco;
  DANE manzana socioec.; iluminación OSM/VIIRS. Vacío → OFF documentado en §3.2 (hallazgo).

### R3 · Bucle ciudadano (A4) — base ya persiste
- `F_report(z,t)` con decay/verificación/anonimización como factor del registro (OFF hasta volumen).
- A5 calibración/GWR: especificado (§4.2), se activa con dato de resultado.

### U1 · UI app de usuario (brief Parte B + pendientes previos) — ✅ HECHO (2026-07-08)
- ✅ B1: pila Perfil/Ajustes/Reportar sobre el FAB ubicación (columna derecha, anclada con onLayout
  a la altura REAL de la barra inferior); banner abajo-centro (left 16 / right 72, no tapa FABs).
- ✅ B2 marca «Nómada.AI» flotante arriba-centro (pointerEvents none). ✅ B3 seam: borde completo +
  overflow hidden en las 3 hojas modales.
- ✅ B4 Lugares con iconos por categoría (emoji rasterizado a imagen del mapa en web; NATIVO queda
  con círculos de color hasta tener assets PNG — pendiente menor). ✅ B5 «Directa».
- ✅ B6 historial de alertas (hora/zona/acción/tipo, AsyncStorage cap 100, en «Tu protección»);
  registra proximidad y anticipadas (lib/alert-log.ts).
- ✅ B8 Ajustes: VEHÍCULO / RECORRIDO Y ALERTAS / TEMA / MAPA Y CAPAS / RIESGO (toggle + heatmap
  dentro, deshabilitado si capa OFF). Sin taxi ✓.
- ✅ Descargo ético bajo la barra cuando hay ruta o recorrido activo.
- ✅ Estados: buscador sin resultados, error al cargar capa de riesgo; hitSlop ≥44pt en vehículos.
- Verificado en Expo web claro/oscuro; typecheck limpio. Pendiente U1: iconos POI en mapa NATIVO.
- ✅ Ronda de feedback (2026-07-09): B3 real (backdrop a pantalla completa, sin línea recta tras
  las esquinas); POIs con MaterialCommunityIcons rasterizados (PNG sin círculo blanco, tamaño
  crece con zoom, tap → popup nombre+categoría traducida); naming «Protección: Mínima/Equilibrada/
  Máxima»; alerta de Atención adaptada al vehículo efectivo (carro→ventanas, moto→casco, genérico);
  tema Sistema reactivo en vivo (Appearance+matchMedia); idioma Sistema no soportado → aviso
  honesto (fallback es); perfil: «Reiniciar historial» como enlace discreto con confirmación,
  «Limpiar» alertas con confirmación y filtros Todas/En zona/Anticipadas; wordmark Nómada.AI con
  logo + tipografía Sora (OFL) y «.AI» siempre azul (componente BrandWordmark).

### U1c · Coherencia visual + onboarding (feedback 2026-07-09) — ✅ HECHO
- ✅ Tokens `Radii` en theme.ts (pill 999 controles/botones · control 14 · card 16 · sheet 20)
  aplicados en todas las hojas (Ajustes, Reporte, Protección, Ciudad).
- ✅ Marca flotante SIN relleno: wordmark con halo adaptativo (blanco en claro, negro en oscuro)
  sobre el mapa; chip de ciudad debajo.
- ✅ «Protección» con el mismo patrón que «Vehículo»: rótulo al frente de sus opciones.
- ✅ Onboarding primera vez (/welcome): 4 slides deslizables con iconos, puntos de progreso,
  Omitir, «Siguiente»→«Comenzar»; persistido en AsyncStorage. Ahí se ubicará el login (U4):
  Google + invitado al final del recorrido (NO se simula mientras no haya claves Clerk).
- ✅ El MAPA es la pantalla principal (/): index redirige a /welcome solo la primera vez;
  se retiró la portada vieja y el FAB «volver»; /health ahora avisa en el mapa SOLO si falla.
- Verificado en Expo web claro/oscuro; typecheck limpio.

### U1d · Ronda de pruebas pre-APK (feedback 2026-07-10) — ✅ HECHO
- ✅ Welcome: bug del primer render (slides apiladas — ancho ahora medido con onLayout),
  contenido más abajo; login Google/invitado intacto.
- ✅ Splash animado de arranque (~3 s, components/animated-splash.tsx): retícula de calles,
  la ruta dibuja una «N» (strokeDashoffset), el punto azul la recorre y aterriza como el «.»
  de Nómada.AI; solo en arranque en frío, la app carga detrás.
- ✅ Perfil: nacionalidad con LISTA de países (constants/countries.ts, es/en, buscador) y
  fecha de nacimiento con selectores día/mes/año (components/picker-sheet.tsx genérico).
- ✅ Ubicación: el FAB centrar SIEMPRE vuela a la posición; al abrir, si el permiso ya está
  concedido, la ubicación se carga sola (sin diálogo — permisos en contexto).
- ✅ Banners/alertas arriba (bajo el chip de ciudad); punto verde/coral REAL en el chip
  (/health cada 60 s); FABs perfil/ajustes/reportar/centrar centrados en el lateral derecho;
  botón reportar con relleno coral + megáfono.
- ✅ Modo navegación en recorrido: cámara inclinada (pitch 50-55°) orientada al RUMBO del
  teléfono (brújula en nativo, movimiento en web) y vehículo cenital según el tipo
  (SVG en web, sprite de Views en nativo con MarkerView).
- APK: prebuild + gradle assembleRelease local (SDK en ~/Library/Android/sdk).

### DECISIÓN DE STACK (2026-07-10): NO reescribir, NO migrar a Flutter
La lentitud reportada NO es del stack (RN/Expo/MapLibre) sino de configuración:
watchPosition estaba en Balanced/4s/15m (→ «relento» y desfase en carretera) y la
cámara hacía easeTo suelto por punto. Flutter usaría el mismo MapLibre y el mismo GPS
del SO → mismo problema, perdiendo semanas de U1–U4. Camino correcto = tuning +
arquitectura, no cambiar de lenguaje. Documentado para no reabrir el debate.

### U7 · Fluidez tiempo-real + robustez (feedback 2026-07-10, campo) — EN CURSO, MÁXIMA prioridad
Hecho en esta pasada:
- watchPosition → BestForNavigation, 1s/3m; rumbo desde course del GPS en movimiento.
- GPS con última-posición-conocida inmediata + fix de alta precisión (25s) — arregla
  «no se pudo obtener ubicación» recurrente.
- Ruta /sso-callback (fix «page could not be found» al volver del login Google).
- Guard «viaje fantasma»: no registra viaje si no hubo movimiento (≥4 puntos).
Hecho 2026-07-11: barra Protección azul (intensidad por nivel), defaults
semaforo/int50%/op25%, sin líneas de grilla, POIs nativos = emoji sobre círculo
(canvas no existe en nativo), modales responsive (Ajustes/Perfil con maxHeight 90%
+ ScrollView → «Listo» siempre visible), switch iOS, copy corto sin «Android»,
RUTEO en viaje libre (elegir destino en marcha) + RECÁLCULO al desviarse >45m.
Pendiente (orden de campo):
A. FLUIDEZ cámara: seguimiento continuo (interpolación entre fixes, no salto por
   punto); marcador que se desliza; probar en APK que el mapa gira con el teléfono.
A2. HONESTIDAD web vs nativo: web (maplibre-gl) y nativo (maplibre-react-native) son
    renderers DISTINTOS; POI-icons/flyTo/pitch difieren. Montar verificación real en
    emulador Android + simulador iOS antes de dar por bueno lo del mapa nativo.
    (city flyTo en nativo SIGUE fallando pese a animationMode; requiere device test.)
B. AutoTrip inteligente: si quieto >15 min → preguntar «¿sigues en viaje?» (alert 60s);
   sin respuesta y sin moverse → repreguntar a los 15 min; 2ª sin respuesta → finaliza
   automático. Detección de arranque YA funciona en campo (confirmado por usuario).
C. Ruteo en viaje libre: permitir elegir destino DESPUÉS de iniciar; recálculo al
   desviarse de la ruta segura (¿implementado? — verificar/agregar).
D. Copys/UI: «Recorrido libre automático» con menos texto (explicación DEBAJO del
   toggle); switch tipo iOS; quitar mención «Android» (multiplataforma); modal
   Reportar con botones que encajen + MÁS categorías de incidente.
E. Selector de PROTECCIÓN: reemplazar los 3 chips (palabras largas) por una barra
   deslizante elegante (paleta de la app): «Protección» al medio, «Mínima»–«Máxima»
   en extremos, 3 topes marcados, default centro.
F. Estados de segundo plano SIEMPRE visibles y para público general: «Obteniendo
   ubicación…», «Cargando mapa de riesgo…», etc. (hoy casi nunca aparece).
G. Fecha de nacimiento: avisar cuando la fecha no es válida (hoy valida en silencio).
H. Animación cambio de ciudad en NATIVO: sigue sin funcionar / «deja full todo» al
   cambiar — INVESTIGAR a fondo (¿Camera key/animationMode?).
I. Splash: quita pantalla negra con logo previa a la animación (splash nativo del SO);
   calibrar waypoints del punto sobre el PNG.
J. Consentimiento Google: pantalla dice «ir a Clerk», no «Nómada.AI» — configurar
   nombre/branding de la app OAuth en el dashboard de Clerk (acción del usuario).

### U7-SEC · CIBERSEGURIDAD (transversal, prioritario)
- Nunca exponer ubicaciones/viajes: cifrar histórico local sensible (expo-secure-store
  para tokens ya; evaluar cifrado de trip logs), HTTPS estricto, no loguear coords en
  claro, minimizar datos enviados, verificar token en servidor (CLERK_ISSUER en Space),
  RLS/authz en escrituras, rate-limit, consentimiento y borrado (Ley 1581).
- Auditar antes de publicar: /security-review sobre el diff.

### U7-B · Feedback 2026-07-11 (verificado en emulador Android)
VERIFICADO funcionando en nativo: cambio de ciudad (flyTo Tumaco↔Cali con heatmap),
vehículo Marker por tipo (ya no es punto), Ajustes responsive con «Done» visible +
switches iOS, banner auto-descarte + ✕, «End trip» sale de navegación, riesgo carga.
Nuevas tareas (orden):
1. VEHÍCULO 3D ilustrado estilo Uber/Rappi (SVG isométrico por tipo: moto/carro/bus/
   camión) — el sprite naranja actual NO parece vehículo. react-native-svg ya está.
2. HEATMAP SUAVE (referencia imagen2 tipo Rappi): capa `heatmap` nativa con centroides
   de celda pesados por risk_norm, en vez de grillas cuadradas. Web+nativo. Elegante.
3. CIUDAD por PAÍS: el modal detecta el país actual y lista sus ciudades con NOMBRE
   OFICIAL y estado: Disponible / Próximamente (seleccionable pero avisa, ej. Cali) /
   No disponible (deshabilitado). Abajo: switch «¿Cambiar de país? / ver todos» +
   input buscador de todos los lugares.
4. PUSH + VIBRACIÓN + PRIORIDAD: expo-notifications push (token, servidor), canal
   Android IMPORTANCE_HIGH con vibración, iOS time-sensitive/critical (que NO se
   agrupen ni dupliquen; entrega inmediata para alertas de seguridad). expo-haptics
   para vibración en alertas.
5. ANIMACIÓN protección MÁXIMA (referencia imagen5 ultracode de Claude Code): al poner
   la barra en Máxima, la pista se «llena» de destellos que parpadean y el tono vira a
   azul→morado. Con Animated en protection-slider.
6. iOS: simulador iPhone 17 Pro disponible — verificar ahí tras Android.

### U7-BIZ · Modelo de negocio (publicidad + suscripción)
- Publicidad SUTIL, no invasiva, NUNCA interrumpe la función: aparece muy
  eventualmente (ej. tarjeta patrocinada discreta en la hoja de notificaciones/
  historial, o un aviso breve DESPUÉS de finalizar un viaje — jamás durante). Definir
  ubicación exacta sin tapar el mapa ni las alertas.
- Quitar anuncios = contribución «cafecito»: USD 0.99 / COP 1.990 mensual, o anual
  USD 9.90 / COP 19.900 → destinado a mantenimiento, operación y mejoras. Copy honesto.
- Implementación futura: RevenueCat/StoreKit+Play Billing; feature flag `adsEnabled`.

### U7-OTA · Actualizaciones sin reinstalar
expo-updates (canal prod): cambios JS/asset al instante; vista «Novedades» tipo
changelog al abrir tras actualizar; NUNCA actualizar durante un viaje (solo en frío).

### U7-ARCH · Refactor (mantenibilidad/escalabilidad)
Extraer de map.tsx: hooks useTrip / useCity / useBanner / useHealth / useLocation;
BaseSheet común (6 hojas duplican backdrop/estilos); servicios en lib/ sin lógica en
vistas; recortar APK 151MB (split ABIs, proguard/shrink). Patrón: capa servicios →
hooks → vistas. Sin duplicación.

### U7 · (histórico) plan previo pruebas reales Android — consolidado arriba
Hecho en esta pasada: banners con auto-descarte por categoría (info 6s / warn 10s /
alerta 15s) y ✕ manual; guard «sin fix GPS no hay viaje» + estado «Obteniendo tu
ubicación…»; wordmark recortado en APK (no pintar hasta cargar Sora); punto del
wordmark redondo; flyTo de ciudad en NATIVO (focus le gana al GPS en cámara).
Pendiente (orden):
1. Sistema de notificaciones in-app formal: categorías (error / actividad-de-fondo /
   alerta precaución-atención), cola, duraciones propias — extraer hook useBanner.
2. GPS robusto: reintentos con backoff + accuracy progresiva («No se pudo obtener tu
   ubicación» recurrente en APK), estados de actividad visibles siempre.
3. OTA: expo-updates (canal producción) — novedades JS/asset SIN reinstalar APK;
   vista «Novedades» estilo changelog al abrir tras actualizar; NUNCA aplicar
   update durante un viaje (checkear solo en frío).
4. Resiliencia: sin internet (cache de /risk/zones y POIs en AsyncStorage + cola de
   escrituras), cerrar/reabrir la app restaurando viaje en curso, ubicación en
   segundo plano durante viaje (foreground service + notificación persistente).
5. Refactor de arquitectura (mantenibilidad): extraer de map.tsx los hooks
   useTrip / useCity / useBanner / useHealth; BaseSheet común para las 6 hojas
   modales (hoy duplican backdrop/estilos); servicios en lib/ sin lógica en vistas;
   revisar peso del APK (151 MB → recortar ABIs/assets, enable proguard/shrink).
6. Splash: calibrar waypoints del punto sobre el PNG real (hoy se desvía en el lazo).
7. Vehículo 3D real EN ESTE PROYECTO (custom layer con modelo — web three.js,
   nativo por evaluar); el sprite acostado actual es el paso intermedio.
8. Salida de navegación: «Finalizar» ya restaura cámara (pitch/bearing 0) — validar
   en APK; si no, forzar reset imperativo en nativo.
9. U5 escritorio (tesis): «.AI» azul + Sora + Menú→Ajustes completo — SIGUE PENDIENTE.
10. iOS: correr en simulador tras estabilizar Android.
- ✅ expo-localization instalado; `lib/i18n.tsx` con diccionario es/en completo (home, mapa,
  banners, alertas por acción, Ajustes, reporte, «Tu protección») y `t()` con interpolación.
- ✅ Ajuste `lang: system|es|en` persistente + sección IDIOMA en Ajustes (cambio en caliente).
- ✅ 'system' sigue el idioma del dispositivo (en → inglés; resto → español, público objetivo).
- ✅ Fechas con locale según idioma (es-CO / en-US). Categorías de reporte: la CLAVE viaja a la
  API en español (modelo); solo el rótulo se traduce. Verificado en Expo web; typecheck limpio.

### U3 · CIUDAD estilo inDrive (pendiente previo) — ✅ HECHO (2026-07-09)
- ✅ Chip de ciudad bajo la marca (arriba-centro) → hoja selectora (`city-sheet.tsx`) que lista
  /risk/cities ∩ ciudades con coordenadas conocidas, con capacidades honestas por fila
  («Riesgo, predicción y rutas» vs. «Solo mapa de riesgo»).
- ✅ Cambio de ciudad: flyTo (prop `focus` del mapa, web+nativo) + recarga `/risk/zones?city=` +
  limpieza del viaje. Cliente compartido: `riskZones(bbox, city)` y `riskCities()`.
- ✅ Detección: al ubicar, si la ciudad soportada más cercana ≠ activa, tarjeta «¿Estás en X?»
  con Sí/No — se pregunta, no se impone.
- ✅ Honestidad en ciudad parcial (Cali): se ocultan buscador/vehículo/protección/CTAs y POIs;
  nota fija explica que hoy solo hay mapa de riesgo; autoTrip y predicción deshabilitados.
- Verificado en Expo web (Tumaco↔Cali con superficie real de Cali del Space); typecheck limpio.

### U4 · LOGIN (pendiente previo + B7) — ✅ HECHO en app móvil (2026-07-09)
- ✅ @clerk/clerk-expo (misma clave publicable del escritorio, en apps/mobile/.env) con
  tokenCache seguro; sin clave la app es 100% invitado (igual que el escritorio).
- ✅ Login al FINAL del onboarding: «Continuar con Google» (SSO real, verificado hasta
  /v1/client/sign_ins) + «Continuar como invitado». Y en la hoja de perfil para invitados.
- ✅ Perfil en «Tu protección»: foto/nombre/correo, cerrar sesión; fecha de nacimiento y
  nacionalidad en unsafeMetadata con consentimiento explícito Ley 1581 → BI.
- ✅ Token Bearer en TODAS las escrituras (history trip/reset, reportes) vía puente
  lib/auth.ts; user_id efectivo = Clerk id con sesión, uid anónimo sin ella.
- ✅ Foto del usuario en el FAB de perfil.
- Pendiente U4: configurar CLERK_ISSUER en el Space (para que el backend VERIFIQUE los
  tokens); sincronizar vehículo/tema al perfil; foto en reportes cuando exista Storage.

### U5b · ESCRITORIO (tesis) — coherencia con la app (feedback 2026-07-11)
- ✅ Grillas de riesgo SIN líneas divisoras (risk-line eliminado, como el móvil).
- Pendiente: «Menú» del escritorio = misma estructura que AJUSTES de la app móvil
  (vehículo predeterminado, tema, capas, riesgo, umbral) sin quitar lo del panel.
- Historial de ALERTAS en escritorio: modal que sube hasta arriba dejando ver SOLO el
  nombre de la app (como el sheet del móvil), «Listo» abajo → botón «Ir a la app móvil»
  que abre/enlaza la app. Con sesión iniciada, muestra MI historial igual que el móvil.
- Cada simulación debe ir cargando normal (no bloquear la vista de historial).

### U5 · ESCRITORIO (brief Parte C)
- «Menú» → «Ajustes» con TODO lo de la app (tema/vehículo predeterminado/heatmap/umbral) sin quitar
  lo existente (satelital, seguir vehículo, trayectorias, ayuda). Vehículo elegido = predeterminado
  del panel.

### U6 · ADMIN + PORTAL (pendientes previos + brief parte 2)
- Panel admin (B.9) con rol Clerk verificado EN SERVIDOR: editar risk_config por ciudad con vista
  previa; moderación de reportes; BI (mode sim|mobile ya separado).
- Portal appweb: dominio propio pendiente de decisión; smart banner «continuar aquí / descargar app»;
  botón desde el escritorio.

## Reglas permanentes
- Commits 100% autoría de englergz, sin trailer de coautoría. Verificar en preview claro/oscuro y
  responsive. MODELO_RIESGO.md sincronizado con el código. Cambio de factores ⇒ re-correr pipeline,
  regenerar 6 figuras + TABLA I + correlaciones + ρ + OE4 y reportar números.
