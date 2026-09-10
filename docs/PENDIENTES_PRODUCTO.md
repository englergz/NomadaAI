# Nómada.AI · Pendientes del producto — lo pedido vs lo hecho

**Estado a 2026-09-10.** Fuente de verdad del backlog a partir de hoy; `ROADMAP_SESIONES.md`
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

**Lo que hoy impide que un usuario reciba mejoras sin reinstalar:** la OTA. El código ya está
bien (huella estable, cabecera de canal, APK compilado), pero falta **crear el canal en EAS,
publicar el update e instalar el APK nuevo** (§6.1). Todo lo demás son funciones.

---

## 1. App móvil — lo pedido, uno a uno

### 1.1 Navegación y protección (núcleo) — ✅ completo
| Pedido (fecha) | Estado |
|---|---|
| Detectar movimiento y empezar a analizar la trayectoria sin destino (06-23, 07-08) | ✅ recorrido libre + predicción online |
| Alertas anticipadas con umbral configurable (06-23: «50 % es muy bajo») | ✅ umbral en Ajustes, defecto 70 % |
| Zona de incidencia dinámica por hora (06-23) | ✅ `/risk/zones?hour=` |
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
| **Modal de ciudad por país**: detecta país, nombre oficial, disponible / próximamente / no disponible, «¿cambiar de país?», buscador (07-11) | ❌ el sheet lista ciudades sin país ni estados |
| Predicción en Cali (paso 3 de DISENO_FUTURO) | ❌ exige recoger trayectorias reales de Cali |

### 1.4 Onboarding, legal, perfil
| Pedido | Estado |
|---|---|
| Onboarding 4 slides + login Google / invitado al final (07-09, 07-10) | ✅ |
| **Onboarding de valor**: destacar reportar incidentes, protección automática, sesión para el histórico y Círculos «próximamente» (08-03 16:02, DISENO_FUTURO §4) | ❌ los 4 slides actuales hablan de mapa, rutas y alertas; ninguno de reportar, protección automática ni Círculos |
| Términos y privacidad con fecha, aceptación explícita, versión registrada (08-03) | ✅ v1.0.0 |
| Borrado de datos con doble confirmación, local + servidor (08-04) | ✅ |
| Feedback obligatorio antes de borrar, al servidor y al panel admin, no al correo (08-04) | ✅ `POST /feedback` (09-08) |
| Botones «Privacidad y opinión» y «Términos y privacidad» redundantes (08-04) | ❌ siguen los dos en Ajustes |
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
| Agrupar los 4 botones de configuración en «más opciones» desplegable (08-04 14:04) | ❌ sin commit que lo toque |
| **Iconos de lugares (POI) en el mapa nativo** como en web (07-09, 07-11, 08-04) | ❌ siguen círculos de color; exige PNG registrados con `<Images/>` |
| Botón «centrar» no centra (07-10, 07-11, **08-04 19:36**) | ⚠️ `a2fa92a` lo arregló el 07-11; lo volviste a reportar el 08-04 y no hay commit posterior. Hay que probarlo en teléfono |
| Tocar fuera cierra el teclado (08-03) | ⚠️ sin confirmar |

### 1.7 Arranque y actualizaciones
| Pedido | Estado |
|---|---|
| Splash animado con el logo real, ≤4 s, solo en frío (07-10) | ✅ |
| **El splash debe reflejar la carga real**, no ser decorativo (08-03 15:09) | 🟡 solo espera la fuente Sora; no espera ajustes, ubicación ni capa de riesgo |
| Sin icono nativo antes del splash (07-11, 08-03 21:33 «sigue en iOS») | ⚠️ Android resuelto; **iOS sin confirmar** |
| OTA sin reinstalar; nunca en mitad de un viaje (07-10) | ✅ código (`lib/ota.ts`) · ❌ **nunca ha llegado a un teléfono** (§6.1) |
| Vista «Novedades» tipo changelog al abrir tras actualizar (07-10) | ❌ `checkForUpdate` devuelve `pending` pero ninguna pantalla lo usa |
| Sin internet / servidor caído / conexión lenta: mensajes honestos (08-03 21:09) | ✅ `lib/connectivity.ts` |
| Caché de `/risk/zones` y POIs + cola de escrituras para operar sin red (U7 pendiente 4) | ❌ diagnostica, pero no cachea |
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
| Refactor `map.tsx` en hooks `useTrip/useCity/useBanner/useHealth` (07-10, U7-ARCH) | 🟡 bajó de >2.000 a 1.247 líneas; **los hooks no existen** |
| `BaseSheet` común para las 6 hojas (duplican backdrop/estilos) | ❌ |
| Sistema formal de banners/estados (`useBanner`) | ❌ |
| Splash: calibrar waypoints del punto sobre el PNG (U7 pendiente 6) | ⚠️ |

---

## 5. Trabajo futuro declarado (tesis y `DISENO_FUTURO.md`) — diseñado, no construido
1. **Círculos** — grupos de cuidado con ubicación por excepción (disparadores: riesgo alto,
   inactividad, pánico, desvío), WebSocket por círculo, buffer offline, SMS de último recurso.
   Modelo de datos y transporte ya especificados. Ni la entrada «Próximamente» en Ajustes existe.
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

### 6.1 Para que la OTA llegue por fin a un teléfono — orden exacto
1. 👤 Crear el canal (configuración persistente de la cuenta EAS, por eso no lo hice):
   `cd apps/mobile && npx eas-cli@latest channel:create production`
2. 👤 Publicar: `npx eas-cli@latest update --branch production --message "OTA verificada"`
   (con el árbol como está: huella Android `be94deb1…`, iOS `3e19b2de…`).
3. 👤 Instalar el APK nuevo (`apps/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`)
   y abrir la app. Los APK anteriores no enviaban el canal: no recibirán nada.
4. Yo verifico que el manifiesto responde 200 para esa huella.

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
1. §6.1 — canal EAS + update + APK (sin esto ninguna corrección llega a nadie).
2. Onboarding de valor + entrada «Círculos · próximamente» + quitar el botón legal redundante (una tarde, todo JS → sale por OTA).
3. Vista «Novedades» al actualizar (ya hay `pending`; falta la pantalla).
4. Modal de ciudad por país con estados.
5. Iconos POI en nativo (PNG + `<Images/>`).
6. Splash ligado a la carga real (ajustes + ubicación + capa de riesgo, con el tope de 4 s).
7. Fotos en reportes (bloqueado por la decisión de Storage).
8. Refactor `map.tsx` → hooks + `BaseSheet` + `useBanner` (habilita lo demás sin romper).
9. Caché offline + cola de escrituras.
10. Panel admin de verdad (menú lateral, ciudades, pesos, ingesta, BI) — frente grande.
11. Push desde servidor · publicidad/donación · Círculos.
