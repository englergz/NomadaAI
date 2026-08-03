# Nómada.AI · Cumplimiento y pendientes

Estado a 2026-08-03. Lo que dice **✅** está verificado ejecutando, no solo escrito.

---

## A. Cumplimiento

### A.1 Legal y protección de datos — ✅ RESUELTO (queda el borrado automatizado)

| Requisito | Estado |
|---|---|
| Términos de uso con fecha de vigencia | ✅ v1.0.0, 2026-08-03 |
| Política de privacidad con fecha de vigencia | ✅ v1.0.0, 2026-08-03 |
| Aceptación explícita en el primer arranque (no premarcada) | ✅ verificado |
| Registro de qué versión aceptó cada usuario | ✅ versión + fecha |
| Ley 1581/2012: finalidad, responsable, derechos del titular | ✅ en la política |
| Canal de contacto y solicitud de borrado | ⚠️ por correo (manual) |
| Declarar que la app es gratuita y las donaciones voluntarias no dan funciones | ✅ en los términos |
| Aviso de que el índice es orientativo y la IA puede equivocarse | ✅ visible en la app |

> **Es lo único que impide publicar.** Para una prueba de funcionalidad con el
> asesor no bloquea; para evaluar cumplimiento, sí.

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
| Cifrado del histórico local en reposo | ❌ pendiente |
| Flujo de borrado de datos a petición | ❌ pendiente |

### A.3 Seguridad técnica

| Requisito | Estado |
|---|---|
| Sin secretos embebidos en el cliente | ✅ verificado |
| Todo el tráfico por HTTPS (sin cleartext) | ✅ verificado |
| Rol de admin verificado **en servidor** (nunca en cliente) | ✅ `/admin/me` → 401 sin token |
| Escapado de datos externos en el mapa (XSS) | ✅ |
| Rate-limit en escrituras del backend | ⚠️ parcial (cooldown en cliente) |
| Auditoría de dependencias (`npm audit`) | ⚠️ hay avisos sin revisar |

### A.4 Calidad y buenas prácticas

| Requisito | Estado |
|---|---|
| Tipos sin errores en móvil, web y compartido | ✅ |
| Lógica común en `packages/shared`, sin duplicar | ✅ paletas, protección, ayuda, API |
| Contrato de diseño en tokens (radios, colores) | ✅ un solo sitio por plataforma |
| Reglas de R8 para lo que se carga por reflexión | ✅ (su ausencia rompía el segundo plano) |
| Errores que no se tragan en silencio | ✅ corregido en fondo y notificaciones |
| `map.tsx` con más de 2.000 líneas | ❌ refactor pendiente |
| Pruebas automatizadas | ❌ no hay |

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
| Inicio de sesión con Google | ✅ (confirmado por el usuario) | ⚠️ sin probar |
| Rendimiento: 60 fps, arranque <400 ms | ✅ medido | ⚠️ sin medir |

---

## B. Pendientes por prioridad

### B.1 Bloqueantes para publicar
1. **Términos y política de privacidad** con aceptación y versión registrada.
2. **Flujo de borrado de datos** y contacto del responsable (Ley 1581).

### B.2 Funcionalidad prometida que falta
3. **Fotos en los reportes** (selector + almacenamiento de objetos + endpoint).
   Postgres no es sitio para archivos: aquí sí aplica un almacenamiento tipo
   Supabase Storage o R2.
4. **Onboarding de valor**: destacar reportar incidentes, protección automática,
   sesión para el histórico, y Círculos como «próximamente».
5. **Modal de ciudad por país** con estados disponible / próximamente / no disponible.

### B.3 Bugs abiertos
6. ~~Android: el servicio de fondo no se reengancha~~ — **RESUELTO**.
   Causa: `hasStartedLocationUpdatesAsync` informa del REGISTRO de la tarea, que
   sobrevive a que el sistema mate la app, no de que el servicio esté vivo. El
   código preguntaba «¿ya corre?», recibía sí y no arrancaba nada (sin error y sin
   aviso). En iOS no se veía porque allí el seguimiento sí sobrevive. Ahora al
   reanudar se fuerza un ciclo limpio de parada y arranque. Verificado matando la
   app y reabriendo: servicio en primer plano con tipo 0x8 (ubicación).
7. **Animación de arranque decorativa**: tiene tope de 4 s pero no refleja la
   carga real (fuente, ajustes, ubicación, capa de riesgo).

### B.4 Calidad
8. **Refactor de `map.tsx`** (>2.000 líneas) en hooks: useTrip, useCity, useBanner.
9. **Pruebas automatizadas** de lo crítico: alertas por zona, recálculo, reanudación.
10. **Cifrado del histórico local** y revisión de `npm audit`.

### B.5 Producto futuro (diseñado, no construido)
11. **Círculos** — cuidarnos juntos. Diseño completo en `DISENO_FUTURO.md`.
12. **Cobertura por grados**: navegar solo con modelo de riesgo para abrir ciudades
    nuevas sin esperar a tener datos de predicción. Análisis en `DISENO_FUTURO.md`.
13. **Publicidad sutil y donaciones** (U7-BIZ).

---

## C. Depende de ti (no del código)

| Tarea | Estado |
|---|---|
| `ADMIN_USER_IDS` en el Space con tu **User ID** (`user_…`, no `app_…`) | ⚠️ pendiente de confirmar |
| Google Cloud Console: crear proyecto y marca en la pantalla de consentimiento | ❌ pendiente |
| Neon: **no hay que cambiar nada**, el nivel gratuito sirve | ✅ sin acción |
| Publicar la primera OTA (`eas update --branch production`) | ⚠️ tras commitear el lock |
