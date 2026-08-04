# Nómada.AI · Diseño de trabajo futuro

Documento de arquitectura y producto para lo que NO entra en la tesis pero cuyos
cimientos se dejan puestos. Fecha: 2026-08-03.

---

## 1. Qué hace falta para que una ciudad esté disponible

> **CORRECCIÓN (2026-08-04).** La versión anterior de esta sección planteaba DOS
> piezas (riesgo y predicción) y afirmaba que con solo riesgo ya había ruta segura.
> **Era incorrecto**: el ruteo necesita el GRAFO VIAL, que es un tercer ingrediente
> independiente. Verificado contra el backend: Cali tiene 4.268 celdas de riesgo
> pero `/route/build` falla con «muy lejos de la red», mientras Tumaco responde con
> ruta y comparación de exposición.

Son **tres ingredientes independientes**, y cada uno habilita cosas distintas:

| # | Ingrediente | Qué es | Qué habilita |
|---|---|---|---|
| 1 | **Capa de riesgo** | Malla de celdas con riesgo por zona y hora | Mapa de calor · alertas **en zona** · recorrido libre protegido |
| 2 | **Grafo vial** | Red de calles navegable (OSM) con el riesgo pesando las aristas | **Ruta segura vs directa** · recálculo al desviarse · alertas **de tramo** · comparativa de exposición evitada |
| 3 | **Modelo de predicción** | Entrenado con trayectorias reales de esa ciudad | Alerta **anticipada sin destino declarado** · «vas hacia X» en recorrido libre |

### Matriz real de capacidades

| Capacidad | Solo 1 | 1 + 2 | 1 + 2 + 3 |
|---|---|---|---|
| Mapa de calor por hora | ✅ | ✅ | ✅ |
| Alerta **en zona** (entras/estás dentro) | ✅ | ✅ | ✅ |
| Recorrido libre protegido | ✅ | ✅ | ✅ |
| Notificaciones | ✅ | ✅ | ✅ |
| Buscar destino y **ruta segura** | ❌ | ✅ | ✅ |
| Recálculo al desviarse | ❌ | ✅ | ✅ |
| Comparativa de exposición evitada | ❌ | ✅ | ✅ |
| Alerta **anticipada** sin destino declarado | ❌ | ❌ | ✅ |

**Conclusiones que importan:**

- El ingrediente 1 **por sí solo ya es un producto útil**: protege durante el
  recorrido y avisa al entrar en zona. Es lo que hoy tiene Cali.
- El 3 **no sirve solo**: sabría a dónde vas pero no tendría nada que advertirte.
  Es un multiplicador del 1, no un sustituto.
- El 2 es el que más valor añade sobre el 1, y **es el más barato de conseguir**:
  el grafo vial se descarga de OpenStreetMap, no hay que entrenar nada ni recoger
  trayectorias. **Para abrir una ciudad nueva, el orden correcto es 1 → 2 → 3.**

### Estado por ciudad (verificado 2026-08-04)

| Ciudad | 1 Riesgo | 2 Grafo vial | 3 Predicción |
|---|---|---|---|
| Tumaco | ✅ | ✅ | ✅ |
| Cali | ✅ (4.268 celdas) | ❌ | ❌ |

### Cómo lo refleja la app (ya implementado)

`map.tsx` evalúa `canRoute` y `canPredict` por separado en vez de un booleano
«ciudad completa». En una ciudad con solo riesgo se ofrece **recorrido libre** con
avisos en zona, y el copy dice la verdad: «ya te protegemos… las rutas seguras
llegan cuando la red vial de esta ciudad esté cargada».

**Pendiente para que Cali quede completa:** cargar su grafo vial en el backend
(paso 2). La predicción (paso 3) exige además recoger trayectorias de la ciudad.

## 2. «Círculos» — cuidarnos juntos (trabajo futuro, con cimientos ya)

Grupos privados (familia, pareja, amigos, trabajo, evento) donde la ubicación se
comparte **por excepción**, no por defecto. Es probablemente el mayor diferencial
de mercado del producto: convierte una app de navegación en una red de cuidado.

### Principio rector (y de privacidad)
> **Por defecto NO se comparte ubicación.** El círculo solo empieza a recibir tu
> posición cuando se cumple un disparador que tú configuraste. Compartir siempre
> es una opción, nunca el estado inicial.

Esto también es lo correcto legalmente (minimización de datos, Ley 1581) y lo que
hace que la gente acepte usarlo.

### Disparadores (configurables por usuario, no por grupo)
- Entro en zona de **riesgo alto** (por defecto: activado).
- Entro en zona de **precaución** (por defecto: desactivado).
- **Inactividad**: iba hacia X y llevo N minutos sin moverme (N configurable, por
  defecto 15) fuera de un destino conocido.
- **Pánico manual**: el usuario pide ayuda explícitamente.
- **Desvío severo** de la ruta segura declarada.
- Ámbito: activable **por ciudad** o siempre.

### Modelo de datos (backend)
```
circles(id, name, kind, created_by, created_at)
circle_members(circle_id, user_id, role[owner|member], joined_at, muted)
circle_prefs(circle_id, user_id, triggers jsonb, share_mode[never|on_trigger|always])
circle_events(id, circle_id, user_id, kind[risk|idle|panic|deviation], started_at,
              ended_at, resolved_by)
circle_positions(event_id, user_id, lon, lat, acc, t)   -- TTL corto, se purga
```
`circle_positions` **solo existe mientras dura un evento** y se borra al cerrarlo:
no hay histórico de ubicaciones de nadie.

### Transporte en tiempo real
- **WebSocket** por círculo (`/ws/circles/{id}`), autenticado con el token de Clerk.
- Al conectarse, el cliente **solo escucha**. Publica únicamente si tiene un evento
  abierto. Esto implementa el «ellos reciben, no envían» del brief.
- Backend: FastAPI ya soporta WebSockets nativamente; el fan-out por círculo puede
  hacerse en memoria al principio y pasar a Redis pub/sub cuando haya >1 réplica.
- Fallback sin WebSocket: **push** (expo-notifications) con la alerta, aunque no
  haya mapa en vivo. La alerta importa más que el mapa.

### Si un miembro se queda SIN INTERNET
Aquí hay que ser honestos sobre qué es posible desde una app:
1. **Buffer local + reenvío**: las posiciones se guardan cifradas y se suben en
   cuanto vuelve la red. Da el rastro *a posteriori*, no en vivo. (Viable ya.)
2. **Última posición conocida + rumbo/velocidad**: el círculo ve «última señal
   hace 4 min, iba hacia el norte a 30 km/h por la vía X». (Viable ya, muy útil.)
3. **GPS sin datos**: el GPS **funciona sin internet** (es recepción satelital).
   Lo que falta es el canal para transmitirlo. Por eso el buffer local sí captura
   el recorrido real aunque no haya señal.
4. **SMS de emergencia como último recurso**: enviar coordenadas por SMS al
   contacto del círculo cuando no hay datos pero sí red celular. Requiere permiso
   de SMS y en iOS solo se puede *preparar* el mensaje, no enviarlo en silencio.
5. **Triangulación por celda (Cell-ID/LTE)**: da posición aproximada (cientos de
   metros a km). **No es accesible para una app de tienda**: la operadora sí puede,
   la app no. Descartarlo como promesa; mencionarlo solo como vía institucional.
6. **Bluetooth/mesh entre miembros cercanos**: útil solo si están a decenas de
   metros. Nicho, no resuelve el caso general.

> **Lo honesto de prometer**: rastro diferido garantizado (1), última posición con
> vector de movimiento (2, 3) y aviso por SMS opcional (4). Todo lo demás (5, 6)
> se documenta como limitación, no como función.

### UI a dejar diseñada (marcada «Próximamente»)
- Entrada en Ajustes → «Círculos» con estado *Próximamente* y explicación real.
- Pantalla de círculo: miembros, estado (en casa / en camino / sin señal), y el
  panel de configuración de disparadores **individual**.
- Botón de pánico accesible en el mapa durante el recorrido.

---

## 3. Legal y confianza (obligatorio antes de publicar)

- **Términos de uso** y **Política de privacidad** con fecha oficial de vigencia,
  aceptación explícita en el primer arranque (no preseleccionada) y registro de
  qué versión aceptó cada usuario (`accepted_terms_version`, `accepted_at`).
- Debe decir explícitamente: la app es **gratuita** y la intención es mantenerla
  así; existirá un canal de **donaciones voluntarias** para sostener operación y
  mejoras; donar **no** habilita funciones (para no convertirlo en pago encubierto).
- Ley 1581 de 2012 (Colombia): finalidad, responsable, derechos del titular
  (conocer, actualizar, rectificar, suprimir), canal de contacto y borrado.
- Debe quedar claro que el índice de riesgo es **orientativo**, no una garantía de
  seguridad, y que la IA puede equivocarse.

---

## 4. Onboarding de valor (no solo permisos)

Destacar, sin obligar, en el primer arranque y luego de forma puntual:
- **Reportar incidentes**: lo que aporta la comunidad mejora el mapa de todos.
- **Protección automática**: se activa sola cuando arrancas.
- **Iniciar sesión**: solo para conservar tu histórico; la app funciona sin cuenta.
