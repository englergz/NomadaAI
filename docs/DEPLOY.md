# Despliegue en la nube

> **Estado a 2026-09-16.** Comandos del día a día en [COMANDOS.md](COMANDOS.md).

Qué hay desplegado:

- **Hugging Face Space `englergz/nomadaai` (Docker)**: una sola URL,
  `https://englergz-nomadaai.hf.space`, sirve la API y la web de escritorio. Los artefactos de los
  cuatro objetivos van embebidos en la imagen.
- **Neon (Postgres gratuito)**: histórico, reportes, opiniones, configuración de la app y catálogo de
  ciudades.
- **Clerk**: identidad. Iniciar sesión es opcional.
- **EAS Update**: actualizaciones por aire de la app móvil, canal `production`.
- **GitHub `englergz/nomadaai`**: control de versiones.

Supabase **no se usa**. Fue la primera opción de base de datos (`db/migrations/001_init_postgis.sql`)
y se reemplazó por Neon porque el plan gratuito de Supabase se pausa a los 7 días sin actividad.

---

## 1. Remotos

```bash
cd app
git remote -v
# origin  https://github.com/englergz/nomadaai.git
# space   https://huggingface.co/spaces/englergz/nomadaai
```

Publicar en producción:

```bash
git push origin main
git push space main:main
```

El push a `space` reconstruye la imagen. Pide usuario y un *access token* de Hugging Face con permiso
de escritura como contraseña. Los artefactos embebidos pesan poco más de 20 MB: no hace falta Git LFS.

## 2. Qué construye el `Dockerfile`

1. Etapa web: `npm ci` en la raíz del monorepo y `npm run build:web`.
2. Etapa API: instala `services/api/requirements.txt`, copia `services/api/app`, copia
   `services/api/artifacts` a `/research` y el `dist/` de la web a `/app/static`.
3. Arranca en el puerto 7860 (cabecera `app_port` del `README.md`) con `PYTHONHASHSEED=0`, para que
   la evaluación sea reproducible entre reinicios.

## 3. Variables del Space

*Settings → Variables and secrets.* Guardar una variable reconstruye el Space.

| Nombre | Tipo | Valor | Sin ella |
|---|---|---|---|
| `DATABASE_URL` | **secret** | cadena de conexión de Neon | histórico solo en el dispositivo; sin reportes persistentes, opiniones ni catálogo |
| `CLERK_ISSUER` | variable | `https://<slug>.clerk.accounts.dev` (el `Dockerfile` trae el de producción) | no se verifica ningún token; el panel admin nunca aparece |
| `ADMIN_USER_IDS` | variable | User ID de Clerk (`user_…`, no `app_…`), varios separados por coma | nadie es admin |
| `VITE_CLERK_PUBLISHABLE_KEY` | variable (pública) | `pk_…` (el `Dockerfile` trae la de producción) | la web entra solo como invitado |

> ⚠️ `DATABASE_URL` lleva contraseña: **solo** como secret del Space, nunca en el repositorio.

## 4. Verificar

```bash
curl -s https://englergz-nomadaai.hf.space/health
```

Debe responder con `predictor_ready: true`, `corridors_ready: true`, `auth_ready: true`,
`admin_ready: true`, `history_identity: true`, `data_deletion: true` y `circles_ready: true` (este
último solo con `DATABASE_URL`). Si `auth_ready` o `admin_ready`
es `false`, falta `CLERK_ISSUER` o `ADMIN_USER_IDS` (ver `COMANDOS.md` §14). La documentación interactiva está en `/docs`.

## 5. Base de datos (Neon)

No hay que aplicar migraciones: cada módulo de `services/api/app/data/` crea su tabla en el primer uso
(`sim_effectiveness`, `incidents`, `feedback`, `app_config`, `city_catalog`). Neon expone solo la cadena
de conexión privada, así que la alerta de «tabla pública sin RLS» de Supabase no aplica. El nivel
gratuito basta hoy; réplica, restauración larga o IP allowlist exigen plan de pago.

## 6. Login (Clerk)

Sin sesión la app funciona en modo invitado. Con sesión, los viajes nuevos se registran en la cuenta;
lo hecho como invitado sigue atado al dispositivo.

**Identidad en el histórico.** El servidor nunca acepta un `user_id` del cliente, ni en la query ni en
el cuerpo: la identidad sale de una prueba (`services/api/app/core/identity.py`).

- **Con sesión**: el `sub` del token verificado. Si llega un token que no valida, la petición se
  rechaza con 401 y no se prueba otra identidad.
- **Invitado**: una **llave del dispositivo** de 32 bytes del generador criptográfico del sistema,
  guardada en Keystore/Keychain (móvil) o en `localStorage` (escritorio). Viaja solo en la cabecera
  `X-Device-Key`. El servidor guarda `dev_` + SHA-256 de la llave, nunca la llave: ni la base, ni el
  panel admin, ni un log dan con qué suplantar a nadie, y un id de dispositivo nunca coincide con uno
  de cuenta.

| Petición | Sin prueba | Con prueba |
|---|---|---|
| `GET /history/summary` | 401. Con `scope=global`, agregados de todos, sin identidad | agregados propios |
| `DELETE /history` | 401 | borra lo propio en todas las ciudades, o solo en `city` |
| `POST /history/trip` | se guarda como `anon`: cuenta en la estadística, nadie puede leerlo ni borrarlo | se atribuye a quien prueba |
| `POST /history/claim` | 401 | pasa a la llave lo guardado con el uid anterior del dispositivo: histórico, reportes y opiniones |
| `POST /incidents/report` · `POST /feedback` | se aceptan. Con el uid anónimo de una versión anterior de la app se atribuyen a ese uid; con cualquier otra cosa, a `anon` | se atribuyen a quien prueba |
| `DELETE /me/data` | 401 | borra el histórico y los reportes propios, desvincula las opiniones propias y sale de todos los círculos |

No existe borrado de una ciudad entera en la API pública. Lo comprueba
`services/api/scripts/humo_history_identidad.py`, que corre en proceso y nunca contra el Space.

**Borrar mis datos (Ley 1581).** `DELETE /me/data` borra en una sola petición el histórico y los
reportes de quien prueba su identidad, y desvincula sus opiniones: pasan a `anon` y se conservan sin
nada que las ate a la persona, porque la app pide una opinión justo antes de borrar. La app lo pide con
el token y con la llave, porque cuenta y dispositivo son identidades distintas, y antes reclama lo
guardado con el uid anterior. Los reportes borrados dejan de contar en `GET /incidents/aggregate`, la
entrada del factor de delito reportado. Sin base de datos, o si falla una tabla, responde `ok: false` y
la app conserva la identidad para reintentar; repetirlo es seguro. El panel admin ve a cada autor como
seudónimo (tipo y 10 caracteres de un hash), nunca su identificador. Lo comprueba
`services/api/scripts/humo_supresion_datos.py`.

**Eliminar la cuenta.** Con sesión, «Borrar mis datos» ofrece una casilla para eliminar también la
cuenta de Clerk (nombre, correo, fecha de nacimiento y nacionalidad del perfil). La app la elimina con
el propio SDK de Clerk (`user.delete()`) y SOLO después de que `DELETE /me/data` confirme el borrado
hecho con el token de esa cuenta: eliminarla antes dejaría sus datos en el servidor sin identidad con
que borrarlos. Requiere que la instancia de Clerk permita a los usuarios eliminar su cuenta
(*User & Authentication → Restrictions*); si no, la app lo informa y los datos quedan borrados igual.

**Riesgo residual del modo invitado.**

- La llave es la credencial: quien copie el almacenamiento del dispositivo (el `localStorage` de un
  navegador compartido, un teléfono con root) actúa como ese invitado. Con sesión, no.
- Lo guardado antes de la llave está atado al uid anónimo anterior, que viajó en URLs (logs de acceso)
  y sigue en la base porque firmaba reportes y opiniones. El panel admin ya no lo ve: recibe seudónimos. Quien conozca un uid puede reclamar ese histórico antiguo **antes** que su dispositivo.
  La app lo reclama una sola vez, al volver la señal o al abrir el histórico; después ese uid ya no
  alcanza nada. El reclamo nunca toca filas de cuenta ni `anon`, y tiene límite por IP.
- React Native y Expo no instalan `crypto.randomUUID`, así que en el teléfono ese uid anterior
  probablemente salió de `Date.now()` y `Math.random()`, que no son aleatoriedad criptográfica. Solo
  pesa en ese reclamo; la llave usa `expo-crypto`.
- Sin almacén seguro no hay llave: ese invitado no ve histórico propio, pero nunca cae a un
  identificador compartido.
- Las versiones de la app anteriores a este cambio no envían la llave: sus viajes se guardan sin
  atribuir y no pueden leer ni borrar su histórico hasta actualizarse.

**Orden de publicación: primero el Space, después la OTA.** Contra el backend anterior, el
`DELETE /history` que envía la app nueva (sin `user_id`) borraría la ciudad entera. Por eso los
clientes preguntan antes a `/health` y no borran si no ven `history_identity: true` y `data_deletion: true`, y no muestran
como propio un resumen que no llegue con `scope: "me"`. Tras desplegar, comprobar con una lectura
(nunca con un DELETE) que el servidor ya exige identidad:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://englergz-nomadaai.hf.space/history/summary
```

Debe responder `401`. Solo entonces `eas update`.

La pantalla de consentimiento de Google aún dice «Clerk». Se cambia en Google Cloud Console, no en el
código.

## 7. App móvil

- **APK**: se compila en local con gradle y el bundle embebido (`COMANDOS.md` §5). No se usa EAS Build.
- **OTA**: `eas update --branch production` (`COMANDOS.md` §7). El canal `production` ya existe. Un
  update solo llega a los APK cuya huella (`runtimeVersion` por *fingerprint*) coincide; los APK
  anteriores al 2026-09-10 no envían el canal y no reciben nada.
- **Tiendas**: sin publicar.
