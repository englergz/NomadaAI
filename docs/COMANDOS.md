# Nómada.AI · Comandos, de la A a la Z

Todo lo que se ejecuta en este proyecto, qué hace cada cosa, en qué orden y cómo se comprueba.
Salvo que se indique, los comandos van desde la raíz del repositorio (`app/`).

Variables que se repiten (defínelas una vez por terminal):

```bash
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export ADB=$ANDROID_HOME/platform-tools/adb
```

| Sección | Para qué |
|---|---|
| [0. Mapa rápido](#0-mapa-rápido-qué-comando-para-qué) | encontrar el comando por tarea |
| [1. Requisitos](#1-requisitos-de-la-máquina) | qué hay que tener instalado |
| [2. Backend en local](#2-backend-en-local-fastapi) | correr la API con los artefactos |
| [3. Web de escritorio](#3-web-de-escritorio-la-de-la-tesis) | desarrollo y compilación |
| [4. App móvil, desarrollo](#4-app-móvil-desarrollo) | tipos, pruebas, versión web de la app |
| [5. APK de Android](#5-apk-de-android-bundle-embebido) | compilar lo que se instala |
| [6. iOS](#6-ios-simulador) | simulador |
| [7. Actualizaciones por aire (OTA)](#7-actualizaciones-por-aire-ota) | publicar JS sin reinstalar |
| [8. Emulador Android](#8-emulador-android-probar-como-un-teléfono) | probar como en un teléfono |
| [9. Publicar en producción](#9-publicar-en-producción-github-space-ota) | GitHub, Space y el orden correcto |
| [10. Pruebas](#10-pruebas) | qué prueba cada suite y cómo se corre |
| [11. Datos y ciudades](#11-datos-y-ciudades) | abrir una ciudad nueva, iconos, golden test |
| [12. Scripts de la investigación](#12-scripts-de-la-investigación-cifras-de-la-tesis) | reproducir las cifras |
| [13. Dependencias y auditorías](#13-dependencias-y-auditorías) | npm, pip, qué no hacer |
| [14. Comprobaciones de estado](#14-comprobaciones-de-estado) | producción y dispositivo |
| [15. Incidentes conocidos](#15-incidentes-conocidos-y-por-qué-los-comandos-son-así) | por qué los comandos son así |

---

## 0. Mapa rápido: qué comando para qué

| Quiero… | Comando | Sección |
|---|---|---|
| Ver la API en local | `uvicorn app.main:app --reload --port 8000` (en `services/api`, con el venv) | 2 |
| Ver la web de escritorio en local | `npm run dev:web` | 3 |
| Comprobar tipos de la app móvil | `cd apps/mobile && npx tsc --noEmit -p tsconfig.json` | 4 |
| Correr las pruebas de la app móvil | `cd apps/mobile && npx jest` | 10 |
| Correr las pruebas del backend (sin red, sin base) | `cd services/api && .venv/bin/python scripts/humo_*.py` | 10 |
| Compilar el APK | `cd apps/mobile/android && ./gradlew :app:assembleRelease` | 5 |
| Instalarlo en el emulador o el teléfono | `$ADB install -r …/app-arm64-v8a-release.apk` | 5, 8 |
| Publicar cambios de JS a los teléfonos | `cd apps/mobile && npx eas-cli@latest update --branch production --message "…"` | 7 |
| Publicar backend o web | `git push origin main && git push space main:main` | 9 |
| Ver si producción vive | `curl -s https://englergz-nomadaai.hf.space/health` | 14 |
| Abrir una ciudad nueva | `rebuild_risk_city.py` → `fetch_road_graph.py` → commit → push al Space → alta en el panel | 11 |
| Regenerar los iconos de lugares del mapa nativo | `cd apps/mobile && python3 scripts/gen_poi_icons.py` | 11 |
| Reproducir una cifra de la tesis | `services/api/scripts/oe*.py`, `t*.py` | 12 |

---

## 1. Requisitos de la máquina

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 20 | monorepo (`npm` workspaces), web, Expo |
| Python | **3.11** (la misma del `Dockerfile`) | backend y scripts. Con 3.9 no instalan los pines de `requirements.txt` |
| Java | 21 | gradle (APK) |
| Android SDK | platform-tools + un AVD (hoy `Pixel_7a`) | APK y emulador |
| Xcode + simulador de iPhone | actual | iOS |
| Cuenta EAS (`npx eas-cli@latest login`) | — | OTA. Una sola vez por máquina |
| Token de Hugging Face con escritura | — | `git push space` lo pide como contraseña |

Instalar las dependencias del monorepo (siempre `ci`, nunca `install`, para respetar el lock):

```bash
npm ci
```

---

## 2. Backend en local (FastAPI)

Usa los artefactos versionados en `services/api/artifacts` (los mismos que van en la imagen).

```bash
cd services/api
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export RESEARCH_DIR=$PWD/artifacts PYTHONHASHSEED=0
export MAX_TRAJECTORIES=800             # opcional: menos RAM y arranque más rápido
uvicorn app.main:app --reload --port 8000
```

- Documentación interactiva: `http://localhost:8000/docs`.
- `PYTHONHASHSEED=0` es obligatorio para que `/trajectories/sample` y el ruido GPS de la demo sean
  reproducibles entre arranques (ver §15).
- Variables que lee `app/core/config.py` (todas opcionales en local):

| Variable | Qué hace | Por defecto |
|---|---|---|
| `RESEARCH_DIR` | carpeta de artefactos | `../../../Research` |
| `MAX_TRAJECTORIES` | cuántas trayectorias cargar (0 = todas) | `0` |
| `CORS_ORIGINS` | orígenes permitidos, separados por coma | `http://localhost:5173,http://localhost:3000` |
| `DATABASE_URL` | Postgres (Neon). Sin ella: histórico solo en el dispositivo, sin reportes ni opiniones persistentes ni catálogo | vacío |
| `CLERK_ISSUER` | emisor de Clerk para verificar tokens. Sin él, todo es invitado y el panel admin no existe | vacío (la imagen trae el de producción) |
| `ADMIN_USER_IDS` | ids de Clerk (`user_…`) con rol admin, separados por coma | vacío |
| `RATE_LIMIT_ENABLED` | límite por IP en escrituras y cómputo | `true` |
| `ENVIRONMENT` | etiqueta que devuelve `/health` | `development` |
| `STATIC_DIR` | carpeta de la web compilada que sirve la API (solo en la imagen) | vacío |

Probar de punta a punta con base de datos, en local y nunca contra producción:

```bash
# Postgres desechable en Docker
docker run --rm -d --name nomadaai-pg -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:pg@localhost:5432/postgres
uvicorn app.main:app --reload --port 8000
# La web de escritorio y la app web apuntan aquí con VITE_API_URL / EXPO_PUBLIC_API_URL=http://localhost:8000
```

Las tablas se crean solas en el primer uso (`sim_effectiveness`, `incidents`, `feedback`,
`app_config`, `city_catalog`); no hay migraciones que aplicar.

---

## 3. Web de escritorio (la de la tesis)

```bash
npm run dev:web                       # http://localhost:5173 (Vite, recarga en caliente)
cd apps/web && npx tsc --noEmit -p tsconfig.json   # tipos
npm run build:web                     # producción → apps/web/dist (es lo que empaqueta el Dockerfile)
cd apps/web && npm run preview        # sirve dist/ en http://localhost:4173 para verla compilada
```

`apps/web/.env` (copiar de `apps/web/.env.example`): `VITE_API_URL=http://localhost:8000` en local;
en la imagen del Space va vacío para que llame al mismo origen. `VITE_CLERK_PUBLISHABLE_KEY` es
pública y viaja en el bundle.

---

## 4. App móvil, desarrollo

```bash
cd apps/mobile
npx tsc --noEmit -p tsconfig.json     # tipos: SIEMPRE antes de compilar o publicar
npx jest                              # pruebas (§10)
npx expo start --web                  # versión web de la app (react-native-web) en el navegador
npx expo run:android                  # compilación de desarrollo + Metro con recarga en vivo
```

> **`expo lint` NO se usa.** La primera vez instala `eslint` y `eslint-config-expo`, modifica
> `package.json` y `package-lock.json` y crea `eslint.config.js`. Si se ejecutó por error:
> `git checkout -- package-lock.json apps/mobile/package.json && rm apps/mobile/eslint.config.js && npm ci`.

Regenerar el proyecto nativo (solo tras tocar `app.json`, plugins o dependencias nativas):

```bash
cd apps/mobile
JAVA_HOME=$(/usr/libexec/java_home -v 21) npx expo prebuild --platform android --no-install
npx expo prebuild --platform ios --no-install && cd ios && LANG=en_US.UTF-8 pod install
```

`android/` e `ios/` no se versionan: se regeneran. `--no-install` evita que `prebuild` toque
`node_modules` (ver §15, la huella OTA).

> **Metro en este monorepo**: la compilación de depuración pide `/index.bundle` y Metro sirve desde
> la raíz del workspace (404). Para verificar comportamiento real, compila con el bundle embebido (§5).

---

## 5. APK de Android (bundle embebido)

Es lo que se instala en los teléfonos. No se usa EAS Build: se compila en local con gradle.

```bash
npm ci                                  # 1) node_modules exactamente como el lock
cd apps/mobile/android
./gradlew :app:assembleRelease          # 2) compila (usa ANDROID_HOME y JAVA_HOME del inicio)
```

Salen cuatro APK, uno por arquitectura, en `apps/mobile/android/app/build/outputs/apk/release/`:

| Archivo | Cuándo |
|---|---|
| `app-arm64-v8a-release.apk` | **el que se envía**: cualquier teléfono desde ~2015 |
| `app-armeabi-v7a-release.apk` | equipos anteriores a 2015 |
| `app-x86-release.apk`, `app-x86_64-release.apk` | emuladores de Intel |

Justo después de compilar, y ANTES de publicar ninguna OTA, la comprobación que no se salta:

```bash
cd apps/mobile
unzip -p android/app/build/outputs/apk/release/app-arm64-v8a-release.apk assets/fingerprint; echo
npx expo-updates runtimeversion:resolve --platform android | python3 -c "import json,sys; print(json.load(sys.stdin)['runtimeVersion'])"
```

Las dos líneas deben ser **idénticas**: es la huella que el APK lleva grabada y la que `eas update`
va a apuntar. Si difieren, la OTA quedaría huérfana (§15). Si la tarea de gradle vino de caché:

```bash
cd apps/mobile/android && ./gradlew :app:createReleaseUpdatesResources --rerun-tasks -q >/dev/null
cat app/build/generated/assets/createReleaseUpdatesResources/fingerprint
```

Instalar (emulador o teléfono con depuración USB):

```bash
$ADB install -r apps/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

Los APK anteriores al 2026-09-10 no envían el canal de OTA: hay que instalar uno nuevo para recibir
actualizaciones.

---

## 6. iOS (simulador)

Un solo comando desde `app/`: resuelve el simulador (el arrancado, o arranca un iPhone), compila sin
firma, desinstala la versión anterior, instala, concede ubicación y abre la app.

```bash
npm run ios          # → scripts/ios.sh
```

Si `pod install` avisa `Cannot find module 'expo-dev-client/package.json'`, es inofensivo: lo busca el
flujo de development build, que este proyecto no usa.

Verificado en simulador: arranque, mapa, recorrido, segundo plano y reanudación. Sin verificar en iOS:
protección automática, cambio de ciudad, canal de alertas, login con Google y rendimiento.

---

## 7. Actualizaciones por aire (OTA)

Corrige todo lo que es JavaScript y assets —pantallas, textos, lógica, iconos, diseño— sin publicar
APK nuevo. Lo nativo (permisos, módulos, splash, `app.json`) exige compilar y reinstalar; la política
de huella (`runtimeVersion: fingerprint`) lo detecta sola: un update solo llega a los APK con la misma
huella.

### 7.1 Una sola vez por máquina y por proyecto

```bash
cd apps/mobile
npx eas-cli@latest login                        # cuenta de Expo
npx eas-cli@latest whoami                       # comprueba la sesión
npx eas-cli@latest channel:list                 # debe existir `production` (creado el 2026-09-10)
npx eas-cli@latest channel:create production    # solo si no existe: channel → branch del mismo nombre
```

`app.json` fija `updates.requestHeaders["expo-channel-name"] = "production"`: el APK pide updates de
ese canal. Cambiar ese valor cambia la huella (exige APK nuevo).

### 7.2 Publicar

Orden obligatorio: **si el cambio toca el backend, primero `git push space` y esperar el
redespliegue** (§9); después la OTA. Al revés, una app nueva hablaría con un servidor viejo.

```bash
cd apps/mobile
npx tsc --noEmit -p tsconfig.json && npx jest    # 1) verde
# 2) si hay cambios visibles: nueva entrada [0] en src/constants/changelog.ts (es/en);
#    la app la muestra UNA vez en el primer arranque con la versión nueva («Novedades»).
npx eas-cli@latest update --branch production --message "qué cambia, en una frase"   # 3)
```

`eas update` empaqueta el árbol de trabajo tal cual (también lo no commiteado): se publica con el
árbol limpio y commiteado, y justo después de haber compilado (§15, la huella). Imprime dos grupos,
uno por plataforma, cada uno con su `Runtime Version` y su `Update ID`.

### 7.3 Verificar que de verdad llega

```bash
cd apps/mobile
npx eas-cli@latest update:list --branch production --limit 2     # lo último publicado por plataforma
npx eas-cli@latest update:view <Group ID>                        # detalle de un grupo
```

Manifiesto que descargan los teléfonos, para la huella del APK (sin teléfono, solo lectura):

```bash
U="https://u.expo.dev/1b72d408-48c0-4af8-b4a6-cf6c5491b4a1"
HUELLA=$(unzip -p apps/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk assets/fingerprint)
curl -s -o /tmp/m.txt -w "HTTP %{http_code}\n" "$U?channel-name=production&platform=android&runtime-version=$HUELLA" \
  -H "accept: multipart/mixed" -H "expo-protocol-version: 1"
grep -o '"id":"[^"]\{36\}"\|"createdAt":"[^"]*"' /tmp/m.txt | head -2
```

- `200` con el `id` del update recién publicado → los teléfonos con ese APK lo reciben.
- `204` → no hay update para esa huella (lo normal para una huella vieja).
- `403` o `400` → falta el canal o la cabecera: revisar 7.1.

En el teléfono (o emulador) la comprobación es abrir la app dos veces: la primera descarga en
segundo plano y muestra la tarjeta «Hay una actualización lista» (nunca se aplica durante un
recorrido); la segunda ya corre la nueva y muestra «Novedades». Huella real del APK instalado:

```bash
$ADB shell pm path ai.nomada.app | sed 's/package://' | head -1 | xargs -I{} $ADB pull {} /tmp/app.apk
unzip -p /tmp/app.apk assets/fingerprint; echo
```

### 7.4 Iconos de lugares

Si cambia `POI_ICON_DEFS` en `apps/mobile/src/components/risk-map.types.ts`, los PNG del mapa nativo
se regeneran desde la misma tabla (van en la OTA como assets):

```bash
cd apps/mobile && python3 scripts/gen_poi_icons.py     # → assets/images/poi/*.png (necesita Pillow)
```

---

## 8. Emulador Android: probar como un teléfono

```bash
$ANDROID_HOME/emulator/emulator -list-avds                                   # AVD disponibles
$ANDROID_HOME/emulator/emulator -avd Pixel_7a -no-snapshot-load -no-boot-anim &   # arrancar
$ADB wait-for-device && until [ "$($ADB shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 3; done
```

Instalar limpio y conceder los permisos que en un teléfono se piden en contexto:

```bash
$ADB install -r apps/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
$ADB shell pm clear ai.nomada.app                        # estado de primera instalación
for p in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION POST_NOTIFICATIONS; do
  $ADB shell pm grant ai.nomada.app android.permission.$p; done
$ADB shell am start -n ai.nomada.app/.MainActivity
```

Simular ubicación y movimiento (Tumaco), capturar pantalla, leer el log:

```bash
$ADB emu geo fix -78.785 1.806            # lon lat; repetir con otros puntos para «moverse»
$ADB exec-out screencap -p > /tmp/pantalla.png
$ADB logcat -d | grep -i "ReactNativeJS\|dev.expo.updates\|nomadaai"   # errores JS, estados de OTA, tarea de fondo
$ADB shell input tap 540 2236             # toque (coordenadas de 1080×2400)
$ADB shell input keyevent 4               # «atrás»: cierra la hoja abierta; sin hoja, saca la app
```

Para probar el **bundle embebido del APK** y no una OTA ya descargada: `pm clear` y arrancar **sin red**
(el emulador aplica en el siguiente arranque cualquier OTA que haya descargado). No alternes el modo
avión por adb: deja la red del emulador inservible y hay que reiniciar el AVD.

---

## 9. Publicar en producción (GitHub, Space, OTA)

Remotos del repositorio `app/`:

```bash
git remote -v
# origin  https://github.com/englergz/NomadaAI.git      (código)
# space   https://huggingface.co/spaces/englergz/nomadaai (producción: API + web, Docker)
```

Antes de cada commit: `git status`, `git diff --cached`, mensaje sin firmas ni menciones a
herramientas. Los hooks de `.git/hooks` (`pre-commit`, `commit-msg`, `pre-push`) lo comprueban y no
se saltan.

```bash
git push origin main            # GitHub
git push space main:main        # Hugging Face: reconstruye la imagen (pide usuario y token de HF)
```

Qué construye el Space (`Dockerfile` de la raíz): `npm ci` + `npm run build:web`; luego la imagen
Python 3.11 con `requirements.txt`, `services/api/app`, los artefactos en `/research` y la web en
`/app/static`; arranca `uvicorn` en el 7860 con `PYTHONHASHSEED=0`.

Esperar y comprobar el redespliegue (dura unos minutos):

```bash
curl -s https://huggingface.co/api/spaces/englergz/nomadaai | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['runtime']['stage'], d['sha'][:7])"
# RUNNING <commit>  → el commit debe ser el que acabas de subir
curl -s https://englergz-nomadaai.hf.space/health
```

Orden cuando un cambio toca backend y app a la vez: **Space primero, OTA después**, y entre medias
la comprobación que exija ese cambio (p. ej. `GET /history/summary` sin credenciales → `401`).
Variables y secretos del Space, y el detalle de Clerk y Neon: [DEPLOY.md](DEPLOY.md).

Si el Space no reconstruye: *Settings → Factory rebuild*. Guardar una variable también lo reconstruye.

**Nunca** ejecutar escrituras ni `DELETE` contra `https://englergz-nomadaai.hf.space` para probar: las
pruebas con base de datos van en local (§2) o en proceso (§10).

---

## 10. Pruebas

### 10.1 App móvil (Jest, sin dispositivo)

```bash
cd apps/mobile && npx jest            # 104 pruebas en 11 suites
npx jest src/__tests__/alerts.test.ts # una suite
```

| Suite | Qué garantiza |
|---|---|
| `alerts` | umbrales de nivel y una sola alerta por zona |
| `desvio` | recálculo al desviarse de la ruta segura |
| `reanudacion` | el recorrido se retoma tras cerrar la app |
| `cifrado` | cifrado en reposo, migración y sobre hexadecimal |
| `arranque` | el splash espera la carga real; «Novedades» una vez por versión |
| `ciudades` | estado por ciudad dicho por el servidor; sugerencia solo de ciudades servidas |
| `historial-identidad` | token o llave en todas las escrituras; reclamo del uid anterior |
| `sin-conexion` | copia local de lecturas; cola de escrituras: orden, 4xx se descarta, 5xx y sin red se conservan |
| `teclado` | la hoja no queda bajo el teclado |
| `avisos` | cola de avisos por importancia |
| `gps` | GPS por escalones |

### 10.2 Backend en proceso (sin servidor, sin red, sin base)

Cada script arranca la app ASGI dentro del mismo proceso (`scripts/_asgi_en_proceso.py`) y sale con
código 1 si algo falla:

```bash
cd services/api
.venv/bin/python scripts/humo_history_identidad.py   # 24: nadie lee ni borra lo de otra persona; sin borrado por ciudad
.venv/bin/python scripts/humo_supresion_datos.py     # 18: «Borrar mis datos» alcanza lo propio en todas las tablas y nada ajeno
.venv/bin/python scripts/humo_errores_de_base.py     #  3: con la base caída, al cliente no llega el texto del error
.venv/bin/python scripts/humo_riesgo_ciudades.py     # 13: /risk/zones solo responde con la malla de la ciudad pedida (404 si no hay)
```

### 10.3 Contra un servidor (solo lecturas)

```bash
cd services/api
python scripts/c5_humo_route_build.py                # 16 invariantes de /route/build por cada ciudad que rutea (Tumaco y Cali)
python scripts/c5_humo_route_build.py http://localhost:8000   # contra el backend local
python scripts/huella_backend.py --check scripts/huella_backend.json   # la superficie del backend no cambió
```

### 10.4 Integridad de los artefactos (golden test)

```bash
cd services/api && shasum -a 256 -c scripts/golden.sha256
```

Debe dar `OK` en las cuatro mallas (Tumaco y Cali, horaria y zonas). Si un hash cambia sin haber
cambiado la configuración de riesgo, algo se rompió: los detalles en `scripts/GOLDEN.md`.

---

## 11. Datos y ciudades

### 11.1 Abrir una ciudad nueva

Tres ingredientes independientes (`DISENO_FUTURO.md` §1): **1** capa de riesgo → mapa, alertas en
zona y recorrido libre; **2** red vial → rutas seguras y recálculo; **3** modelo de predicción →
alerta anticipada sin destino (exige trayectorias reales; hoy solo Tumaco).

```bash
cd services/api && source .venv/bin/activate
# 1) Malla de riesgo (descarga DANE y OpenStreetMap; minutos)
python scripts/rebuild_risk_city.py --city pasto --mpio PASTO --bbox "1.15,-77.33,1.27,-77.22"
# 2) Red vial desde OpenStreetMap (bbox deducido de la malla anterior)
python scripts/fetch_road_graph.py --city pasto
# 3) Anotar los hashes nuevos en scripts/GOLDEN.md y golden.sha256, commit y push al Space (§9)
# 4) Panel admin → Ciudades → alta en el catálogo (nombre oficial, país, centro, zoom):
#    la app la muestra sin publicar versión.
```

`/risk/cities` y `/route/cities` publican lo que el servidor tiene cargado; la app deduce con eso el
estado de cada ciudad (disponible / próximamente / no disponible). Ingesta de trayectorias y
entrenamiento no caben en el Space: se hacen aquí, en local, y se versionan los artefactos.

### 11.2 Reconstruir el riesgo de una ciudad existente

```bash
python scripts/rebuild_risk_full.py --config artifacts/risk/risk_config.tumaco.json
shasum -a 256 -c scripts/golden.sha256      # con la MISMA configuración, los hashes no cambian
```

`rebuild_risk.py` es la versión anterior (solo Tumaco, DANE por manzana); se conserva por trazabilidad.

### 11.3 Iconos de lugares

`cd apps/mobile && python3 scripts/gen_poi_icons.py` (§7.4).

---

## 12. Scripts de la investigación (cifras de la tesis)

Todos en `services/api/scripts/`, corren contra `https://englergz-nomadaai.hf.space` salvo que se pase
otra URL, y solo hacen lecturas. Los CSV que producen están versionados en `artifacts/eval/` con sus
hashes en `scripts/GOLDEN.md`; los detalles de cada recómputo en `RECOMPUTO_2026-08.md`.

| Script | Cifra | Uso |
|---|---|---|
| `oe4_lambda_canonico.py` | curva λ de reducción de exposición (4,84 % a λ=2,5) con bootstrap por clúster | `python oe4_lambda_canonico.py [URL] [N_PARES]` |
| `oe4_od_sweep.py` | barrido origen-destino histórico (λ=5) | `python oe4_od_sweep.py` |
| `oe4_busqueda_maximo.py` | barrido amplio a protección máxima | `python oe4_busqueda_maximo.py` |
| `oe3_alerta_punto_operacion.py` | alerta anticipada en el punto de operación real (99,1 % / 58,7 %) | `python oe3_alerta_punto_operacion.py [--start-hours …] [--threshold 0.9]` |
| `oe3_alerta_malla_entregada.py` | alerta sobre la malla entregada por hora y umbral | `python oe3_alerta_malla_entregada.py [--hours …] [--thr …]` |
| `oe2_valida_riesgo.py` | validación del modelo de riesgo | `python oe2_valida_riesgo.py` |
| `t2_destino_direccion.py` | dirección ≤30°, FDE por tipo | `python t2_destino_direccion.py [URL] [N]` |
| `t6b_socioeconomico.py` | ¿el factor socioeconómico reordena el mapa? (Tumaco vs Cali) | `python t6b_socioeconomico.py` |
| `t8_contribuciones.py` | contribución de cada factor sobre las 475 celdas | `python t8_contribuciones.py` |
| `figuras_6_7_8.py` | regenera las figuras 6, 7 y 8 | `python figuras_6_7_8.py` |
| `huella_backend.py` | huella de la superficie del backend para fusionar corridas | `python huella_backend.py --check scripts/huella_backend.json` |

Regla: correr un script nunca sobrescribe un artefacto versionado sin decidirlo; si lo hace,
`git checkout -- artifacts/eval/<archivo>` y anotar la corrida aparte.

---

## 13. Dependencias y auditorías

```bash
npm ci                                  # instalar EXACTAMENTE el lock (raíz del monorepo)
npm audit                               # 30 avisos conocidos, clasificados en DEPENDENCIAS.md
cd services/api && .venv/bin/python -m pip_audit -r requirements.txt --no-deps --disable-pip   # backend: 0
```

- **Nunca `npm audit fix --force`**: degrada Expo 57 → 46 y rompe la app.
- Cambios de dependencias: `npm install <paquete>` en el workspace correcto, revisar que el lock solo
  añade lo esperado (comparar el conjunto de nombres, no las líneas), commitear `package-lock.json`.
- Si `npm ci` falla con «lock file out of sync», alguien instaló sin actualizar el lock: `npm install`
  en la raíz y commitear el lock.
- Tras cualquier cambio en `node_modules`, la huella OTA puede cambiar (§15).

---

## 14. Comprobaciones de estado

Producción:

```bash
curl -s https://englergz-nomadaai.hf.space/health | python3 -m json.tool
# predictor_ready, corridors_ready, auth_ready (CLERK_ISSUER), admin_ready (ADMIN_USER_IDS),
# history_identity, data_deletion: todos true
curl -s https://englergz-nomadaai.hf.space/config/app                 # niveles de protección, ads
curl -s https://englergz-nomadaai.hf.space/risk/cities                # ciudades con mapa
curl -s https://englergz-nomadaai.hf.space/route/cities               # ciudades que rutean
curl -s -o /dev/null -w '%{http_code}\n' https://englergz-nomadaai.hf.space/history/summary   # 401 = exige identidad
curl -s -o /dev/null -w '%{http_code}\n' "https://englergz-nomadaai.hf.space/risk/zones?city=bogota"   # 404 = ciudad sin mapa
```

Panel admin: si no aparece, son dos variables independientes del Space y fallar cualquiera da el
mismo 401. `auth_ready` mira `CLERK_ISSUER`; `admin_ready` mira `ADMIN_USER_IDS` (User ID de Clerk,
`user_…`, no `app_…`). El rol se decide siempre en el servidor; el botón solo aparece si
`GET /admin/me` responde 200 con el token.

Dispositivo:

```bash
$ADB shell dumpsys package ai.nomada.app | grep -A 20 "requested permissions"     # permisos reales
$ADB shell dumpsys activity services ai.nomada.app | grep -E "nomadaai-|isForeground"   # servicio del recorrido
$ADB shell dumpsys notification --noredact | grep -A3 "ai.nomada.app"           # notificaciones y su canal
$ADB shell dumpsys gfxinfo ai.nomada.app reset && $ADB shell dumpsys gfxinfo ai.nomada.app | grep -A 6 "Total frames"   # fluidez
```

---

## 15. Incidentes conocidos, y por qué los comandos son así

**La OTA nunca había llegado a un teléfono (2026-09-08).** Un cliente `expo-updates` pide updates por
canal; `eas update --branch production` crea el branch, pero no existía ningún canal
(`channel:list` → 0) y el APK compilado en local no enviaba `expo-channel-name`. Cualquiera de los dos
fallos bastaba para un 403. Por eso 7.1 y la cabecera fija en `app.json`.

**La huella cambiaba en cada compilación (2026-09-09).** Kotlin 2 deja archivos de sesión en
`node_modules/expo-updates/expo-updates-gradle-plugin/.kotlin/` mientras gradle compila y
@expo/fingerprint no los ignoraba: cada APK grababa una huella distinta. Lo arregla
`apps/mobile/.fingerprintignore`.

**La huella depende de `node_modules`, incluidos los restos de compilación (2026-09-10).** Con
`node_modules` recién salido de `npm ci` la huella Android era una; en cuanto gradle compila deja
`android/build/` dentro de paquetes como `@react-native-masked-view/masked-view` y pasa a otra. El APK
se graba siempre en el estado «después de compilar»: por eso la OTA se publica justo después de
compilar y con la comprobación de §5 (dos valores iguales o no se publica).

**CARTO exigió API key (2026-09-10)** y pintaba «API KEY REQUIRED» sobre todo el mapa; los lienzos de
Esri se sirven sin clave pero no tienen calles de Tumaco a zoom de ciudad. La base es hoy OpenFreeMap
(estilos vectoriales, datos de OpenStreetMap) y Esri solo para el satelital, desde
`packages/shared/src/basemap.ts`. Comprobación rápida de que un proveedor cubre Tumaco: pedir su
tesela z16 de (−78.785, 1.806) y mirar el tamaño; con calles pesa 5–9 KB, un relleno 2 KB.

**El cifrado en base64 no se podía leer en Android (2026-09-15).** Nada de lo cifrado en reposo se
recuperaba, así que el recorrido nunca quedaba en disco y la protección en segundo plano se apagaba a
los pocos segundos. El sobre es ahora hexadecimal (`enc2:`); lo escrito como `enc1:` se trata como
inexistente. Suite `cifrado`.

**Arranque no reproducible (2026-08-09).** Iterar un `set` de cadenas daba un orden distinto en cada
arranque del contenedor, y con él cambiaban los pares O-D de `/trajectories/sample`. Causa raíz
corregida (`sorted()` + blake2b) y, como defensa, `PYTHONHASHSEED=0` en los dos `Dockerfile` y en el
arranque local (§2).
