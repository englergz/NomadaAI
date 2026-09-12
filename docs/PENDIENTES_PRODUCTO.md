# Nómada.AI · Pendientes del producto — lo pedido vs lo hecho

**Estado a 2026-09-10 (actualizado tras la tanda de la tarde).** Fuente de verdad del backlog a partir de hoy; `ROADMAP_SESIONES.md`
queda como historial y `CUMPLIMIENTO_Y_PENDIENTES.md` como matriz de cumplimiento legal/técnico.

Cómo se construyó: se leyeron los **555 mensajes** del usuario en las 5 sesiones de NomadaAI
(2026-06-22 → 2026-09-10: Research, app, tesis, jurado interno, jurado externo), los documentos
del producto (`PLAN_PRODUCTO`, `DISENO_FUTURO`, `ROADMAP_SESIONES`, `CUMPLIMIENTO_Y_PENDIENTES`,
`CRITICA_Y_MEJORAS`) y se contrastó cada punto **contra el código y el historial de git**, no
contra lo que los docs decían. Donde el código no permite confirmar (hace falta teléfono o
simulador), se marca «sin confirmar».

Leyenda: ✅ hecho y verificado · 🟡 parcial · ❌ no hecho · ⚠️ sin confirmar · 👤 depende de ti.

---

## 0. Resumen

| Bloque | Pedido | Hecho | Parcial | Pendiente |
|---|---|---|---|---|
| Investigación y tesis | — | entregada 2026-08-11; recómputo T1–T13 cerrado | — | 5 líneas de trabajo futuro declaradas (§5) |
| Backend / API | 14 | 13 | 1 | push desde servidor |
| App móvil (producto) | 47 | 33 | 5 | 9 |
| Escritorio (tesis) | 12 | 12 | — | — |
| Seguridad y cumplimiento | 12 | 11 | — | 1 (RLS/authz fina en DELETE /history) |
| Calidad / arquitectura | 6 | 2 | 1 | 3 |
| Depende de ti | 10 | 2 | — | 8 |

**OTA (2026-09-10):** canal `production` creado, update publicado y manifiesto verificado (200
para la huella del APK, 204 para la vieja). Lo único que falta es que **instales el APK del
2026-09-10** (§6.1): los APK anteriores no reciben nada.

**Incidente del 2026-09-10 (encontrado al verificar en el emulador):** CARTO empezó a exigir
API key y servía «API KEY REQUIRED» sobre todo el mapa, en escritorio y app. Los lienzos de
Esri no tienen calles de Tumaco a zoom de ciudad. Se pasó a teselas vectoriales de
OpenFreeMap (Positron / Dark, datos de OpenStreetMap, sin clave) desde una fuente única en
`packages/shared/src/basemap.ts`; satelital sigue en Esri. Verificado en el emulador
(Tumaco y Cali con calles, riesgo y lugares) y en el escritorio local.

**Tanda del 2026-09-10 (commit 57d8e53):** cerrados los puntos 2 a 6 del orden sugerido —
onboarding de valor + Círculos «próximamente» + botones legales, Novedades tras OTA, ciudad por
país, iconos POI nativos y splash ligado a la carga real. Todos van por OTA. Verificados en el
emulador Pixel 7a (onboarding, Configuración, selector de ciudad, tarjeta OTA, splash con estados, iconos).

---

## 1. App móvil — lo pedido, uno a uno

### 1.1 Navegación y protección (núcleo) — ✅ completo
| Pedido (fecha) | Estado |
|---|---|
| Detectar movimiento y empezar a analizar la trayectoria sin destino (06-23, 07-08) | ✅ recorrido libre + predicción online |
| Alertas anticipadas con umbral configurable (06-23: «50 % es muy bajo») | ✅ umbral en Ajustes, defecto 70 % |
| Zona de incidencia dinámica por hora (06-23) | ✅ `/risk/zones?hour=` · **corregido 09-10:** la app no enviaba la hora y el servidor devolvía siempre la de las 19:00; ahora manda la hora real y recarga al cambiar de hora |
| Una sola alerta por zona, no repetir (07-02, 07-03) | ✅ |
| «Transita con precaución» cuando no hay alternativa (asesor, 07-03) | ✅ regla EVITAR/AVISAR por tramo |
| Ruta segura vs directa coloreada por tramo; sentido vial respetado (07-07) | ✅ |
| Barra de protección min/equilibrada/max → deslizante azul (07-11) | ✅ `protection-slider`, niveles desde `/config/app` |
| Elegir destino en marcha + recálculo al desviarse (07-11) | ✅ recálculo >45 m, respeta la barra en vivo |
| Buscar dirección → pin para confirmar → ruta desde mi ubicación (07-11) | ✅ |
| Modo navegación: cámara inclinada al rumbo, salida garantizada (07-10, 07-11) | ✅ |
| Fluidez en tiempo real (07-11 campo: «relento») | ✅ BestForNavigation 1 s/3 m + interpolación ~25 fps |
| AutoTrip: quieto 15 min → preguntar → 2ª sin respuesta → cerrar (07-11) | ✅ |
| Segundo plano con app cerrada + reanudar al volver (07-10, 07-11) | ✅ Android e iOS; reenganche Android corregido 08-03 |
| Protección automática (vigía) con la app cerrada (07-08, 08-03) | ✅ Android · ⚠️ iOS sin probar |
| Vehículo por tipo, predeterminado + por viaje (07-08, 07-20) | ✅ |
| Vehículo «3D» estilo Rappi/Uber (07-10, 07-11) | 🟡 sprites SVG isométricos por tipo; **3D real (modelo/three.js) no hecho** |
| Heatmap suave tipo Rappi (07-11) | ❌ descartado por ti el mismo día: «las grillas quedan mejor» |
| Animación de destellos al poner protección máxima (07-11) | ❌ descartado por ti: «no se parece en nada» |

### 1.2 Alertas y notificaciones
| Pedido | Estado |
|---|---|
| Notificaciones apiladas tipo Android/iOS, con hora (06-23, 06-28) | ✅ historial en «Tu protección», filtros |
| Banners con categorías, auto-descarte y ✕ (07-10) | ✅ info 6 s / warn 10 s / alerta 15 s |
| Estados de fondo visibles («Obteniendo ubicación…», «Cargando mapa…») (07-10, 07-11) | 🟡 existen algunos; **no hay un sistema formal de estados** (U7 pendiente 1) |
| Vibración + prioridad máxima / time-sensitive (07-11) | ✅ canal MAX, vibración por nivel |
| Logo de la app en las notificaciones (08-03) | ⚠️ sin confirmar en teléfono |
| Notificación «Protección activada» desde la tarea headless (08-03) | ⚠️ no apareció en `dumpsys`; la persistente sí |
| **Push desde servidor** (incidente cerca, cambio de riesgo) — PLAN_PRODUCTO B.3 | ❌ no hay token push ni endpoint |
| Botón de notificaciones aparte del perfil con puntico «sin leer» (07-10) | ⚠️ sin confirmar |

### 1.3 Ciudades y cobertura
| Pedido | Estado |
|---|---|
| Selector de ciudad estilo inDrive + «¿Estás en X?» (07-07) | ✅ |
| Cambio de ciudad animado en nativo (07-10, 07-11) | ✅ verificado 08-03 |
| Cali funcional sin predicción (08-04) | ✅ riesgo + **grafo vial OSM** (rutea desde 09-07, −19,1 % a λ=2,5) |
| Ciudades que rutean las dice el servidor (`/route/cities`) | ✅ |
| **Modal de ciudad por país**: detecta país, nombre oficial, disponible / próximamente / no disponible, «¿cambiar de país?», buscador (07-11) | ✅ **(09-10)** país de la ciudad activa, estado dicho por `/risk/cities` + `/route/cities`, buscador sin tildes; «¿Estás en X?» solo propone ciudades servidas |
| Predicción en Cali (paso 3 de DISENO_FUTURO) | ❌ exige recoger trayectorias reales de Cali |

### 1.4 Onboarding, legal, perfil
| Pedido | Estado |
|---|---|
| Onboarding 4 slides + login Google / invitado al final (07-09, 07-10) | ✅ |
| **Onboarding de valor**: destacar reportar incidentes, protección automática, sesión para el histórico y Círculos «próximamente» (08-03 16:02, DISENO_FUTURO §4) | ✅ **(09-10)** 5 páginas: te cuidamos · protección automática · rutas y riesgo · reporta lo que ves · Círculos (próximamente) + nota «la cuenta solo conserva tu histórico» |
| Términos y privacidad con fecha, aceptación explícita, versión registrada (08-03) | ✅ v1.0.0 |
| Borrado de datos con doble confirmación, local + servidor (08-04) | ✅ |
| Feedback obligatorio antes de borrar, al servidor y al panel admin, no al correo (08-04) | ✅ `POST /feedback` (09-08) |
| Botones «Privacidad y opinión» y «Términos y privacidad» redundantes (08-04) | ✅ **(09-10)** ahora «Mis datos y opinión» y «Términos y política de privacidad», en una fila |
| Nacionalidad con lista de países; fecha de nacimiento válida (07-10) | ✅ |
| Google login: pantalla en blanco / «page could not be found» (07-10, 08-03) | 🟡 corregido en `a2fa92a` (deep link) · ⚠️ el 08-03 lo reportaste otra vez; sin confirmar después |
| Consentimiento de Google dice «Clerk», no Nómada.AI (07-11, 08-03) | 👤 Google Cloud Console → OAuth consent screen (§6) |

### 1.5 Reporte ciudadano
| Pedido | Estado |
|---|---|
| Reporte persistente, anónimo, rate-limit en servidor (07-02) | ✅ |
| Más categorías (07-11) | ✅ 11 categorías es/en |
| Iconos ilustrativos por categoría + motivación comunitaria (08-03) | ✅ iconos · 🟡 texto de motivación mínimo |
| **Fotos** en los reportes (PLAN_PRODUCTO B.4, 08-03 20:24, 08-03 21:09) | ❌ ni selector, ni columna, ni Storage. Postgres no sirve para archivos: hace falta Supabase Storage o R2 (👤 decisión) |
| Input del reporte tapado por el teclado (08-03 16:21) | ⚠️ sin confirmar tras el arreglo del teclado |

### 1.6 Ajustes, ayuda, diseño
| Pedido | Estado |
|---|---|
| Ajustes = mismo contenido que el menú del escritorio; tema en caliente; capas; heatmap (07-07) | ✅ |
| Defaults semáforo / intensidad 50 % / opacidad 25 %, sin líneas de grilla (07-08, 07-11) | ✅ |
| Switch tipo iOS, copy sin «Android» (07-11) | ✅ |
| «Restablecer configuración» (08-03) | ✅ con confirmación |
| Ayuda en móvil portada de la web, no rehecha (08-03) | ✅ `help-sheet` consume `packages/shared/help.ts` |
| Títulos vs subtítulos diferenciados en la ayuda móvil (08-03) | ⚠️ hay jerarquía en código; sin confirmar visualmente |
| Radios coherentes en toda la app (07-10, 08-03) | ✅ tokens `Radii` |
| Wordmark Sora, «.AI» azul, punto redondo, sin relleno (07-10, 07-11) | ✅ `BrandWordmark` |
| Agrupar los 4 botones de configuración en «más opciones» desplegable (08-04 14:04) | ✅ **(09-10)** tarjeta «Más opciones» plegable (ayuda · mis datos y opinión · términos · restablecer), verificada en el emulador |
| **Iconos de lugares (POI) en el mapa nativo** como en web (07-09, 07-11, 08-04) | ✅ **(09-10)** PNG generados de la misma tabla que la web (`scripts/gen_poi_icons.py`), capa `symbol` con `<Images/>`; verificado en el emulador Pixel 7a (tamaño corregido: el @2x se registraba como @1x) |
| Botón «centrar» no centra (07-10, 07-11, **08-04 19:36**) | ⚠️ `a2fa92a` lo arregló el 07-11; lo volviste a reportar el 08-04 y no hay commit posterior. Hay que probarlo en teléfono |
| Tocar fuera cierra el teclado (08-03) | ⚠️ sin confirmar |

### 1.7 Arranque y actualizaciones
| Pedido | Estado |
|---|---|
| Splash animado con el logo real, ≤4 s, solo en frío (07-10) | ✅ |
| **El splash debe reflejar la carga real**, no ser decorativo (08-03 15:09) | ✅ **(09-10)** espera ajustes → ubicación → capa de riesgo (`lib/boot.ts`) con tope de 4 s y dice qué está cargando |
| Sin icono nativo antes del splash (07-11, 08-03 21:33 «sigue en iOS») | ⚠️ Android resuelto; **iOS sin confirmar** |
| OTA sin reinstalar; nunca en mitad de un viaje (07-10) | ✅ **(09-10)** canal + update + manifiesto 200 verificados; tarjeta «actualización lista» que solo permite aplicar sin recorrido · ⚠️ falta instalar el APK del 09-10 |
| Vista «Novedades» tipo changelog al abrir tras actualizar (07-10) | ✅ **(09-10)** hoja una vez por versión nueva (`constants/changelog.ts`, es/en) |
| Sin internet / servidor caído / conexión lenta: mensajes honestos (08-03 21:09) | ✅ `lib/connectivity.ts` |
| Caché de `/risk/zones` y POIs + cola de escrituras para operar sin red (U7 pendiente 4) | ✅ **(09-10)** `lib/offline-cache.ts` (red primero; sin red, la última copia con aviso de cuándo es) para riesgo, lugares, ciudades; `lib/write-queue.ts` (cifrada, 7 días, en orden, para al primer fallo) para reportes y viajes, se vacía al volver la señal. 9 pruebas. Emulador: capa servida desde la copia con su aviso y reporte encolado sin red, verificados en pantalla; el vaciado se observó por sus efectos (la cola queda vacía en el arranque siguiente), no con captura del aviso |
| GPS robusto con reintentos y precisión progresiva (U7 pendiente 2) | 🟡 última posición conocida + fix 25 s; sin backoff |
| Live reload sin reinstalar APK (07-11) | 🟡 funciona con `expo run:android`; `expo-dev-client` no instalado |

### 1.8 iOS
| Pedido | Estado |
|---|---|
| Verificar en simulador iPhone 17 Pro, no asumir Android (07-11, 08-03) | 🟡 arranque, mapa, recorrido, segundo plano y reanudar ✅ · **protección automática, cambio de ciudad, canal de alertas, login Google y rendimiento ⚠️ sin probar** |
| Instrucciones de compilación iOS que funcionen (08-04: «no he podido ver la app en iOS») | 🟡 `COMANDOS.md` §4 tiene el flujo; falta que tú lo confirmes en tu máquina |

---

## 2. Escritorio (tesis) — ✅ cerrado el 2026-07-20
Ajustes espejo del móvil, barra de protección idéntica con niveles configurables, maqueta de
teléfono con modal real y filtros, banners en el mapa, marcas reales de tienda (deshabilitadas
hasta publicar), «.AI» azul, brand único, aviso de demo, panel admin v1, auditoría XSS.
Nada pendiente salvo lo del panel admin (§3).

---

## 3. Backend, admin y plataforma
| Pedido | Estado |
|---|---|
| Framework de riesgo configurable por ciudad (`risk_config.<city>.json`, 8 factores) — R1 (07-08) | ✅ Tumaco y Cali configurados, golden test |
| Histórico por usuario en BD para BI (07-01) | ✅ `/history`, `mode`, `source` |
| Verificar token Clerk en servidor; admin solo en servidor | ✅ |
| Rate-limit por IP en servidor | ✅ (09-08) |
| `POST /feedback` + pestaña Opiniones | ✅ (09-08) |
| Cali rutea (grafo OSM, `risk_at` con KDTree) | ✅ (09-07) |
| **Panel admin robusto**: menú izquierdo, todo configurable, ciudades/regiones reales, pesos por ciudad con vista previa, ingesta de trayectorias, entrenamientos, BI (07-03, 07-10, **08-04: «es una basura»**) | ❌ hoy 4 pestañas en 168 líneas. Tú mismo pediste cerrar primero la app móvil (08-04 14:17) |
| U6.2: editar `risk_config` por ciudad desde el admin (re-corre el pipeline) | ❌ |
| Push desde servidor (token + envío) | ❌ |
| Portal app web de usuario (mismo dominio, vista móvil) + smart banner — PLAN B.8 | ❌ hosting «pendiente por decidir» desde 07-07 |
| Fotos: endpoint + Storage | ❌ (§1.5) |
| `DELETE /history?user_id=` sin exigir que `user_id == sub` (auditoría 07-12, riesgo bajo) | ❌ mitigar cuando la sesión sea obligatoria |

---

## 4. Calidad y arquitectura
| Pedido | Estado |
|---|---|
| Pruebas automatizadas de lo crítico (08-04) | ✅ 27 móvil + 16 invariantes `/route/build` (Tumaco y Cali) |
| Cifrado en reposo, `npm audit`, `pip-audit` | ✅ (09-08) |
| Refactor `map.tsx` en hooks `useTrip/useCity/useBanner/useHealth` (07-10, U7-ARCH) | ✅ **(09-10)** `map.tsx` 1.294 → 744 líneas; `hooks/use-trip` (recorrido, alertas, recálculo, inactividad, segundo plano), `use-city`, `use-banner`, `use-health`, `use-ota`. Sin cambio de comportamiento: código movido tal cual, verificado en el emulador |
| `BaseSheet` común para las 6 hojas (duplican backdrop/estilos) | ✅ **(09-10)** `components/base-sheet.tsx`; las 9 hojas (ajustes, ciudad, reporte, protección, notificaciones, ayuda, legal, privacidad, novedades) solo ponen su contenido. Valores por hoja conservados (opacidad, tope de altura, relleno) |
| Sistema formal de banners/estados (`useBanner`) | 🟡 `useBanner` existe (un aviso, auto-descarte por tono); falta la cola por categorías |
| Splash: calibrar waypoints del punto sobre el PNG (U7 pendiente 6) | ⚠️ |

---

## 5. Trabajo futuro declarado (tesis y `DISENO_FUTURO.md`) — diseñado, no construido
1. **Círculos** — grupos de cuidado con ubicación por excepción (disparadores: riesgo alto,
   inactividad, pánico, desvío), WebSocket por círculo, buffer offline, SMS de último recurso.
   Modelo de datos y transporte ya especificados. Desde el 09-10 hay tarjeta «Círculos · próximamente» en Configuración y página en el onboarding; el código de Círculos no existe.
2. **Cobertura por grados** — ✅ el análisis se convirtió en producto (Cali rutea). Falta la
   predicción (trayectorias reales) y el barrido canónico OE4 sobre Cali con la misma disciplina.
3. **Publicidad sutil + donación «cafecito»** (USD 0,99 / COP 1.990 mes; 9,90 / 19.900 año) —
   `ads_enabled` existe en `/config/app`; sin UI, sin RevenueCat/StoreKit/Play Billing.
4. **Dato vivo**: bucle ciudadano `F_report(z,t)` como factor (R3), Overpass con tags correctos,
   iluminación VIIRS (R2), calibración/GWR cuando haya dato de resultado (A5), curva horaria
   Forensis o declararla escenario, datos DIJIN si llegan.
5. **Validación en campo** con GPS real de desplazamientos (recomendación de la tesis).
6. **Vehículo 3D real** (custom layer con modelo) — el sprite isométrico es el paso intermedio.

---

## 6. Depende de ti (no del código)

### 6.1 OTA — estado 2026-09-10
1. ✅ Canal `production` creado y update publicado (lo hiciste tú el 09-10).
2. ✅ Manifiesto verificado: 200 para la huella del APK, 204 (sin update) para la huella vieja.
3. 👤 **Instalar el APK del 2026-09-10** (`apps/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`,
   huella `be94deb1…`) y abrir la app dos veces: la primera descarga, la segunda muestra
   «Novedades». Los APK anteriores no enviaban el canal: no recibirán nada.
4. Regla nueva en `COMANDOS.md` §5: `eas update` se publica justo después de compilar y solo si
   la huella del APK y la de `runtimeversion:resolve` coinciden (los restos de gradle en
   `node_modules` cambian la huella).

### 6.2 Resto
| Tarea | Estado |
|---|---|
| `ADMIN_USER_IDS` en el Space con tu **User ID** de Clerk (`user_…`, no `app_…`) | ⚠️ dijiste «ya puse el id» el 08-03; sin confirmar que sea el `user_` |
| Google Cloud Console: proyecto + marca en la pantalla de consentimiento (quita «Clerk») | ❌ |
| «Secured by Clerk» en el login: solo se quita en plan pago de Clerk | decisión |
| Storage para fotos: Supabase Storage (proyecto en pausa, se cancela a los 7 días inactivo) o Cloudflare R2 | decisión |
| Hosting de la app web de usuario | pendiente desde 07-07 |
| Neon: mínimo 1 CU, sin scale-to-zero, réplica, restore 7 días, IP allowlist — todo plan pago | decisión (gratis sirve hoy) |
| Publicar en App Store / Play Store (los botones del escritorio están deshabilitados hasta entonces) | ❌ |
| Probar en tu teléfono: centrar, login Google, teclado, notificación con logo, iOS completo | ❌ |

---

## 7. Descartado explícitamente (para no reabrirlo)
- Migrar a Flutter (07-10): la lentitud era configuración de GPS/cámara, no el stack.
- Heatmap suave tipo Rappi (07-11): «las grillas quedan mejor».
- Animación de destellos en la barra de protección (07-11).
- Emojis en la interfaz (07-03): iconos.
- Renumerar las 91 citas de la tesis (08-10).
- Supabase como base de datos principal: Neon gratis sirve; Supabase solo tendría sentido para Storage.

---

## 8. Orden sugerido para lo que sigue (valor / esfuerzo)
~~1–7~~ ✅ cerrados el 2026-09-10 (commits 57d8e53, 052561d y b65675f) y verificados en el
emulador Pixel 7a; la OTA republicada corre en el emulador con la hoja de Novedades.
~~9. Refactor `map.tsx` → hooks + `BaseSheet`~~ ✅ (09-10). Queda solo la cola de banners por categoría (menor).
~~10. Caché offline + cola de escrituras~~ ✅ (09-10).
8. Fotos en reportes (bloqueado por la decisión de Storage).
11. Panel admin de verdad (menú lateral, ciudades, pesos, ingesta, BI) — frente grande.
12. Push desde servidor · publicidad/donación · Círculos.
