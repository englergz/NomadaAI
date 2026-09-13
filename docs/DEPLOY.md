# Despliegue en la nube

> **Estado a 2026-09-12.** Comandos del día a día en [COMANDOS.md](COMANDOS.md).

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
cd /Users/englergonzalez/Downloads/NomadaAI/app
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

Debe responder con `predictor_ready: true`, `corridors_ready: true`, `auth_ready: true` y
`admin_ready: true`. Si una de las dos últimas es `false`, falta `CLERK_ISSUER` o `ADMIN_USER_IDS`
(ver `COMANDOS.md` §5a). La documentación interactiva está en `/docs`.

## 5. Base de datos (Neon)

No hay que aplicar migraciones: cada módulo de `services/api/app/data/` crea su tabla en el primer uso
(`sim_effectiveness`, `incidents`, `feedback`, `app_config`, `city_catalog`). Neon expone solo la cadena
de conexión privada, así que la alerta de «tabla pública sin RLS» de Supabase no aplica. El nivel
gratuito basta hoy; réplica, restauración larga o IP allowlist exigen plan de pago.

## 6. Login (Clerk)

Sin sesión la app funciona en modo invitado con identidad anónima por dispositivo. Al iniciar sesión,
el histórico pasa a la cuenta. En POST y DELETE la identidad la impone el **token verificado**, no el
cliente. Pendiente conocido: `DELETE /history?user_id=` no exige todavía que `user_id` coincida con el
token (riesgo bajo).

La pantalla de consentimiento de Google aún dice «Clerk». Se cambia en Google Cloud Console, no en el
código.

## 7. App móvil

- **APK**: se compila en local con gradle y el bundle embebido (`COMANDOS.md` §3). No se usa EAS Build.
- **OTA**: `eas update --branch production` (`COMANDOS.md` §5). El canal `production` ya existe. Un
  update solo llega a los APK cuya huella (`runtimeVersion` por *fingerprint*) coincide; los APK
  anteriores al 2026-09-10 no envían el canal y no reciben nada.
- **Tiendas**: sin publicar.
