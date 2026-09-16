# Nómada.AI · Cumplimiento del producto y trabajo pendiente

Estado a 2026-09-16. Este documento responde a dos preguntas sobre el producto (la app y el servicio):
qué de lo prometido ya está hecho y comprobado, y qué falta. Lo que aparece como «verificado» se comprobó
ejecutando la app o el servicio, no solo leyendo el código. El cumplimiento de los objetivos de la
tesis está aparte, en `CUMPLIMIENTO.md`.

---

## A. Lo que está cumplido

### A.1 Legal y protección de datos

| Requisito | Estado |
|---|---|
| Términos de uso con fecha de vigencia | Sí: v1.1.0, vigente desde 2026-09-15 (antes v1.0.0, del 2026-08-03) |
| Política de privacidad con fecha de vigencia | Sí: v1.1.0, vigente desde 2026-09-15. Corrige dos frases de la v1.0.0 que no eran exactas («de forma anónima» y «sin cuenta, tus datos se quedan en tu teléfono») y añade qué guarda el servidor, a quién se asocia, qué proveedores intervienen, cómo se modera con seudónimos y qué hace «Borrar mis datos». La app pide aceptarla de nuevo |
| Aceptación explícita en el primer arranque, sin casilla premarcada | Verificado |
| Registro de qué versión aceptó cada persona | Sí: versión y fecha |
| Ley 1581 de 2012: finalidad, responsable y derechos del titular | En la política |
| Canal de contacto y solicitud de borrado | Borrado desde la app y correo de contacto |
| La app es gratuita y las donaciones voluntarias no dan funciones | En los términos |
| Aviso de que el índice es orientativo y puede equivocarse | Visible en la app |

El borrado ejecuta en el dispositivo y en el servidor. En el servidor lo hace `DELETE /me/data`, que
borra el histórico y los reportes de quien prueba su identidad, desvincula sus opiniones y lo saca de
sus círculos; la app lo pide con doble confirmación (casilla no premarcada y diálogo del sistema). Se
conserva únicamente la constancia de aceptación legal, que es la prueba de un acto de la persona y no
un dato que ella aportó.

### A.2 Privacidad en el producto

| Requisito | Estado |
|---|---|
| Funciona sin cuenta; iniciar sesión es opcional | Sí |
| Las coordenadas no se escriben en los registros del servidor | Verificado buscando en el código |
| El rastro del viaje se borra al terminarlo | Sí |
| Solo se retiene un prefijo de 120 puntos, nunca el viaje entero | Sí |
| Reportes ciudadanos | Se atribuyen a la cuenta o a la llave del dispositivo; el panel de moderación ve seudónimos; al público solo llegan agregados; el autor puede retirarlos con «Borrar mis datos» |
| Notificación persistente mientras se sigue la ubicación | Verificado |
| Permisos mínimos: sin «dibujar sobre otras apps» ni almacenamiento | Verificado en el manifiesto |
| Cifrado del histórico local en reposo | Sí, desde el 2026-09-08: AES-256-GCM nativo con la clave en Keystore o Keychain. Cubre el recorrido en curso, la cola de posiciones, la última posición del vigía y el registro de alertas. Sin retroceso a texto claro; el borrado de datos destruye la clave |
| Flujo de borrado de datos a petición | En Configuración → Privacidad, con doble confirmación |

### A.3 Seguridad técnica

| Requisito | Estado |
|---|---|
| Sin secretos embebidos en el cliente | Verificado |
| Todo el tráfico por HTTPS | Verificado |
| Rol de administrador verificado en el servidor, nunca en el cliente | Sí: `/admin/me` responde 401 sin token |
| Escapado de datos externos en el mapa | Sí, en el escritorio y en la versión web de la app, con la misma función compartida |
| Identidad en el histórico por prueba, no por identificador enviado | Sí: token de sesión o llave del dispositivo; el servidor nunca acepta un `user_id` del cliente (`DEPLOY.md` §6) |
| Límite de peticiones en las escrituras del servidor | Sí: ventana deslizante por IP y límites por identidad en la base; responde 429 con `Retry-After` |
| Validación de entrada en los reportes | Sí: coordenadas fuera de rango y textos vacíos o demasiado largos se rechazan con 422 antes de tocar la base |
| Auditoría de dependencias del cliente (`npm audit`) | Revisada el 2026-09-12: lo que queda es herramienta de compilación o transitivo sin parche seguro, clasificado y aceptado con motivo en `DEPENDENCIAS.md`. Nunca se usa `npm audit fix --force`, porque degrada Expo |
| Auditoría de dependencias del servidor (`pip-audit`) | Cero avisos desde el 2026-09-08, confirmado el 2026-09-12 |

### A.4 Calidad

| Requisito | Estado |
|---|---|
| Tipos sin errores en móvil, web y código compartido | Sí |
| Lógica común en `packages/shared`, sin duplicar | Sí: paletas, protección, textos de ayuda, cliente de API, base cartográfica |
| Contrato de diseño en tokens | Un solo sitio por plataforma |
| Reglas de R8 para lo que se carga por reflexión | Sí; su ausencia rompía el segundo plano |
| Errores que no se tragan en silencio | Corregido en el segundo plano y en las notificaciones |
| La pantalla del mapa partida en piezas | Sí, desde el 2026-09-10: de 1.294 a 744 líneas, con los hooks de viaje, ciudad, avisos, salud del servicio y actualizaciones, y una hoja base común a las nueve hojas |
| Pruebas automatizadas | 104 de 104 en el cliente móvil (11 suites); 16 de 16 invariantes de `/route/build` en Tumaco y Cali; 67 comprobaciones de humo del servidor que corren en proceso, sin tocar producción (supresión de datos 18, identidad 24, errores de base 3, riesgo por ciudad 13, validación de reportes 9). Cómo correrlas, en `COMANDOS.md` §11 |

### A.5 Funcionalidad verificada ejecutando

| Función | Android | iOS |
|---|---|---|
| Arranque e instalación limpia | Sí | Sí |
| Mapa, capa de riesgo y ubicación | Sí | Sí |
| Recorrido con servicio en primer plano | Sí | Sí |
| Segundo plano con la app cerrada | Sí | Sí |
| Reanudar el viaje al reabrir | Sí | Sí |
| Reenganche del servicio al reabrir | Sí | Sí |
| Protección automática con la app cerrada | Sí | Sin probar |
| Cambio de ciudad | Sí | Sin probar |
| Canal de alertas con vibración | Sí | Sin probar |
| Inicio de sesión con Google | Sí, probado a mano | Sin probar |
| Rendimiento: 60 fps y arranque por debajo de 400 ms | Medido | Sin medir |

Las filas de iOS marcadas «sin probar» son exactamente eso: la app compila y arranca en el simulador,
pero esas funciones no se han ejercitado en un iPhone.

---

## B. Lo que falta

No queda ningún bloqueante legal para publicar. Lo pendiente es funcionalidad y validación:

1. **Fotos en los reportes.** Falta el selector, el almacenamiento de archivos y su endpoint. Postgres
   no es sitio para archivos, así que hace falta decidir un almacenamiento de objetos.
2. **Avisos con la app cerrada.** No hay notificaciones enviadas desde el servidor; todas las alertas se
   calculan en el teléfono. Exige un servicio de push y sigue sin decidirse.
3. **Círculos de cuidado.** El backend está en el repositorio (`DISENO_FUTURO.md` §2); la pantalla de la
   app se está construyendo y no se ha publicado. En la app publicada aparece como «Próximamente».
4. **Editar los pesos del riesgo desde el panel.** El panel los muestra por ciudad con su motivo;
   cambiarlos exige volver a correr el pipeline fuera del servidor.
5. **Vista de usuario en el navegador del teléfono.** El dominio sirve el escritorio; la app de usuario
   en web solo existe como compilación local de Expo.
6. **Publicación en tiendas.** La app se distribuye como APK de prueba y recibe actualizaciones por
   aire; no está en Google Play ni en App Store.
7. **Verificación completa en iOS.** Ver A.5.
8. **Predicción de destino en Cali.** Cali tiene riesgo y rutas; la predicción exige trayectorias de
   la ciudad, que no se descargan de ningún sitio.
9. **Validación con recorridos reales.** Todas las cifras de efectividad son sobre trayectorias
   simuladas. No hay todavía un viaje de una persona real.
10. **Publicidad discreta y donaciones.** Previstas en los términos; no construidas.

La cobertura por grados (abrir una ciudad solo con capa de riesgo y ofrecer recorrido libre con avisos
en zona) ya está construida y es como funciona Cali hoy.

## C. Resuelto recientemente

Se deja constancia de lo cerrado desde agosto, con fecha, para que la lista de arriba se lea con
contexto.

- 2026-08-03: términos y política v1.0.0 con aceptación registrada; flujo de borrado de datos; el
  servicio de fondo en Android vuelve a engancharse al reabrir la app (el sistema informaba del
  registro de la tarea, no de que el servicio estuviera vivo, y por eso no arrancaba).
- 2026-09-08: cifrado del histórico local; límite de peticiones en el servidor; opiniones guardadas en
  Postgres con su pestaña en el panel; auditorías de dependencias revisadas.
- 2026-09-10: onboarding de cinco páginas; selector de ciudad con estados dichos por el servidor;
  pantalla de arranque que espera lo que de verdad hace falta; refactor de la pantalla del mapa.
- 2026-09-12: catálogo de ciudades desde el servidor con alta y baja en el panel; escapado en la
  versión web de la app; panel admin con datos de producción.
- 2026-09-15: identidad en el histórico por prueba; `DELETE /me/data`; política v1.1.0.
- 2026-09-16: la cola sin conexión descarta los envíos que el servidor rechaza por inválidos (antes un
  reporte rechazado bloqueaba a todos los demás); `/risk/zones` responde 404 para una ciudad sin mapa
  en vez de devolver la malla de Tumaco con otra etiqueta; el esquema del reporte acota coordenadas y
  longitudes.

## D. Configuración externa pendiente

Dos cosas no dependen del código:

- La pantalla de consentimiento de Google todavía muestra «Clerk» como nombre de la aplicación. Se
  cambia en Google Cloud Console.
- El almacenamiento de objetos para las fotos de los reportes sigue sin elegirse.
