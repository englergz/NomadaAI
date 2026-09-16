# Nómada.AI · Cumplimiento y pendientes

Estado a 2026-08-03 (filas actualizadas hasta 2026-09-16). Lo que dice **✅** está verificado ejecutando, no solo escrito.

---

## A. Cumplimiento

### A.1 Legal y protección de datos — ✅ RESUELTO

| Requisito | Estado |
|---|---|
| Términos de uso con fecha de vigencia | ✅ v1.1.0, vigente desde 2026-09-15 (antes v1.0.0, 2026-08-03) |
| Política de privacidad con fecha de vigencia | ✅ v1.1.0, vigente desde 2026-09-15. Corrige dos frases que no eran exactas en la v1.0.0 («de forma anónima» y «sin cuenta, tus datos se quedan en tu teléfono»); añade qué guarda el servidor, a quién se asocia, proveedores, moderación con seudónimos y qué hace «Borrar mis datos». La app pide aceptarla de nuevo |
| Aceptación explícita en el primer arranque (no premarcada) | ✅ verificado |
| Registro de qué versión aceptó cada usuario | ✅ versión + fecha |
| Ley 1581/2012: finalidad, responsable, derechos del titular | ✅ en la política |
| Canal de contacto y solicitud de borrado | ✅ borrado en la app + contacto |
| Declarar que la app es gratuita y las donaciones voluntarias no dan funciones | ✅ en los términos |
| Aviso de que el índice es orientativo y la IA puede equivocarse | ✅ visible en la app |

> Ya no hay bloqueantes legales. El borrado ejecuta en el dispositivo Y en el
> servidor (`DELETE /history`), con doble confirmación: casilla no premarcada +
> diálogo del sistema. Se conserva únicamente la constancia de aceptación legal,
> que es prueba de un acto del usuario, no un dato personal que él aportó.

### A.2 Privacidad en el producto — ✅ en buen estado

| Requisito | Estado |
|---|---|
| Funciona sin cuenta (sesión opcional) | ✅ |
| Las coordenadas no se imprimen en logs | ✅ verificado por búsqueda en el código |
| El rastro del viaje se borra al finalizar | ✅ |
| Solo se retiene un prefijo de 120 puntos, no el viaje entero | ✅ |
| Reportes ciudadanos anónimos y agregados | ✅ |
| Notificación persistente mientras se sigue la ubicación | ✅ verificado |
| Permisos mínimos (sin «dibujar sobre otras apps» ni almacenamiento) | ✅ verificado en el manifiesto |
| Cifrado del histórico local en reposo | ✅ **(2026-09-08)** AES-256-GCM nativo (`expo-crypto`) con la clave en Keystore/Keychain (`expo-secure-store`, `AFTER_FIRST_UNLOCK` en iOS para la tarea de fondo). Cubre recorrido en curso, cola de posiciones, última posición del vigía y registro de alertas; el `uid` pasa a SecureStore. AAD = nombre de la clave; migración transparente del legado; **sin fallback a claro**; el borrado de datos destruye la clave. 6 pruebas nuevas. `expo-crypto` ya estaba en el APK a 57.0.0 (vía `expo-auth-session`): debería salir por OTA |
| Flujo de borrado de datos a petición | ✅ en Configuración → Privacidad, doble confirmación |

### A.3 Seguridad técnica

| Requisito | Estado |
|---|---|
| Sin secretos embebidos en el cliente | ✅ verificado |
| Todo el tráfico por HTTPS (sin cleartext) | ✅ verificado |
| Rol de admin verificado **en servidor** (nunca en cliente) | ✅ `/admin/me` → 401 sin token |
| Escapado de datos externos en el mapa (XSS) | ✅ escritorio desde julio · **(2026-09-12)** también la versión web de la app, que insertaba el nombre del lugar (OSM) sin escapar; ahora las dos usan `escapeHtml` de `packages/shared` |
| Rate-limit en escrituras del backend | ✅ **en servidor** (2026-09-08): ventana deslizante por IP en `core/ratelimit.py` sobre escrituras y cómputo, 429 con `Retry-After`; límites por identidad en BD como control primario; el cubo `anon` compartido de reportes corregido con `device_id` |
| Auditoría de dependencias (`npm audit`) | ✅ **revisado (2026-09-08)**: 29 → 28; el único HIGH directo (Clerk, bypass de autorización) parcheado quirúrgicamente; los 28 residuales son tooling de build/dev-server o transitivos sin parche seguro, clasificados y aceptados con motivo en `docs/DEPENDENCIAS.md`. **Nunca `npm audit fix --force`** (degrada expo 57→46). **Revisión 2026-09-12:** 30 (1 crítica en `maplibre-gl`, no explotable en 4.7.1; 1 high nueva en `nanoid`), ver `DEPENDENCIAS.md` |
| Auditoría de dependencias backend (`pip-audit`) | ✅ **22 → 0** (2026-09-08): `pyjwt` 2.13.0 (12 avisos, incl. cabecera `crit`), `starlette` 1.6.0 vía `fastapi` 0.141.1 (9 avisos: validación de Host y ruta), `pyarrow` 23.0.1 (use-after-free). Verificado con la suite completa con lifespan sobre la malla real. **Sigue en 0 el 2026-09-12** |

### A.4 Calidad y buenas prácticas

| Requisito | Estado |
|---|---|
| Tipos sin errores en móvil, web y compartido | ✅ |
| Lógica común en `packages/shared`, sin duplicar | ✅ paletas, protección, ayuda, API |
| Contrato de diseño en tokens (radios, colores) | ✅ un solo sitio por plataforma |
| Reglas de R8 para lo que se carga por reflexión | ✅ (su ausencia rompía el segundo plano) |
| Errores que no se tragan en silencio | ✅ corregido en fondo y notificaciones |
| `map.tsx` partido en hooks | ✅ **(2026-09-10)** 1.294 → 744 líneas con `use-trip`, `use-city`, `use-banner`, `use-health`, `use-ota`; `BaseSheet` común a las nueve hojas |
| Pruebas automatizadas | ✅ **104/104** en el cliente móvil (11 suites) + **16/16** invariantes de `/route/build` en Tumaco y Cali + humo del backend en proceso (supresión 18, identidad 24, errores 3, riesgo por ciudad 13) (2026-09-16) |

### A.5 Funcionalidad verificada ejecutando

| Función | Android | iOS |
|---|---|---|
| Arranque e instalación limpia | ✅ | ✅ |
| Mapa, capa de riesgo y ubicación | ✅ | ✅ |
| Recorrido con servicio en primer plano | ✅ | ✅ |
| Segundo plano con la app cerrada | ✅ | ✅ |
| Reanudar el viaje al reabrir | ✅ | ✅ |
| Reenganche del servicio al reabrir | ✅ **resuelto 2026-08-03** | ✅ |
| Protección automática con la app cerrada | ✅ | ⚠️ sin probar |
| Cambio de ciudad | ✅ | ⚠️ sin probar |
| Canal de alertas con vibración | ✅ | ⚠️ sin probar |
| Inicio de sesión con Google | ✅ (probado manualmente) | ⚠️ sin probar |
| Rendimiento: 60 fps, arranque <400 ms | ✅ medido | ⚠️ sin medir |

---

## B. Pendientes por prioridad

### B.1 Bloqueantes para publicar
~~1. Términos y política de privacidad~~ — **RESUELTO** (v1.0.0, aceptación verificada).
~~2. Flujo de borrado de datos~~ — **RESUELTO** (Configuración → Privacidad y opinión).

**No quedan bloqueantes legales.**

### B.2 Funcionalidad prometida que falta
~~2b. Endpoint propio de opiniones~~ — **RESUELTO (2026-09-08).** `POST /feedback`
   guarda las cuatro respuestas y el comentario en Postgres con rate-limit por
   persona; el panel admin (pestaña «Opiniones») muestra promedios por pregunta y
   comentarios recientes. El correo queda solo como respaldo si el servidor no
   acepta. Además, responder el formulario es ahora **obligatorio para borrar los
   datos** (el comentario sigue siendo opcional), como se pidió.
3. **Fotos en los reportes** (selector + almacenamiento de objetos + endpoint).
   Postgres no es sitio para archivos: aquí sí aplica un almacenamiento tipo
   Supabase Storage o R2.
~~4. Onboarding de valor~~ — **RESUELTO (2026-09-10)**: cinco páginas, con Círculos «próximamente».
~~5. Modal de ciudad por país~~ — **RESUELTO (2026-09-10)**: estados dichos por el servidor y buscador.
   Desde 2026-09-12 las ciudades que se pueden buscar vienen del catálogo del servidor.

### B.3 Bugs abiertos
6. ~~Android: el servicio de fondo no se reengancha~~ — **RESUELTO**.
   Causa: `hasStartedLocationUpdatesAsync` informa del REGISTRO de la tarea, que
   sobrevive a que el sistema mate la app, no de que el servicio esté vivo. El
   código preguntaba «¿ya corre?», recibía sí y no arrancaba nada (sin error y sin
   aviso). En iOS no se veía porque allí el seguimiento sí sobrevive. Ahora al
   reanudar se fuerza un ciclo limpio de parada y arranque. Verificado matando la
   app y reabriendo: servicio en primer plano con tipo 0x8 (ubicación).
~~7. Animación de arranque decorativa~~ — **RESUELTO (2026-09-10)**: espera ajustes, ubicación y
   capa de riesgo, con tope de 4 s, y dice qué está cargando.

### B.4 Calidad
~~8. Refactor de `map.tsx`~~ — **RESUELTO (2026-09-10)**, ver A.4.
~~9. Pruebas automatizadas de lo crítico~~ — **RESUELTO (2026-08-10): 29/29.**
   21 en el cliente móvil (alertas por zona, recálculo por desvío, reanudación en
   segundo plano) + 8 invariantes sobre `/route/build` en el backend, que es donde
   vive el manejo de rutas seguras del indicador. Reproducir:
   `npm test` en `apps/mobile` y `python services/api/scripts/c5_humo_route_build.py`.
~~10. Cifrado del histórico local y revisión de `npm audit`~~ — **RESUELTO (2026-09-08)**, ver filas A.2 y A.3.

### B.5 Producto futuro (diseñado, no construido)
11. **Círculos** — cuidarnos juntos. Diseño completo en `DISENO_FUTURO.md`.
12. **Cobertura por grados**: navegar solo con modelo de riesgo para abrir ciudades
    nuevas sin esperar a tener datos de predicción. Análisis en `DISENO_FUTURO.md`.
13. **Publicidad sutil y donaciones**.

---

## C. Depende de ti (no del código)

| Tarea | Estado |
|---|---|
| `ADMIN_USER_IDS` en el Space con tu **User ID** (`user_…`, no `app_…`) | ✅ `/health` responde `admin_ready: true` y el panel carga con datos de producción (2026-09-12) |
| Google Cloud Console: crear proyecto y marca en la pantalla de consentimiento | ❌ pendiente |
| Neon: **no hay que cambiar nada**, el nivel gratuito sirve | ✅ sin acción |
| Publicar la primera OTA (`eas update --branch production`) | ✅ canal `production` creado el 2026-09-10; último update «Catálogo de ciudades desde el servidor» (2026-09-12) |
| Instalar el APK del 2026-09-10 en el teléfono (los anteriores no reciben OTA) | ❌ pendiente |
| Decidir almacenamiento para fotos de reportes (Supabase Storage o Cloudflare R2) | ❌ pendiente |
