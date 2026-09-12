# Nómada.AI · Comandos y despliegue

Todo se ejecuta desde la raíz del repo (`app/`) salvo donde se indique.

---

## 1. Web de escritorio (la de la tesis)

```bash
# Levantar en local → http://localhost:5173
npm run dev:web

# Verificar tipos antes de subir
cd apps/web && npx tsc --noEmit

# Compilar para producción (queda en apps/web/dist)
cd apps/web && npm run build
```

---

## 2. App móvil — desarrollo

```bash
cd apps/mobile

# Verificar tipos (hazlo SIEMPRE antes de compilar)
npx tsc --noEmit

# Regenerar el proyecto nativo tras tocar app.json o plugins
JAVA_HOME=$(/usr/libexec/java_home -v 21) npx expo prebuild --platform android --no-install
```

> **Ojo con Metro en este monorepo**: el build de depuración no levanta con Metro
> porque la app pide `/index.bundle` y Metro sirve desde la raíz del workspace
> (404). Para probar, compila con el bundle EMBEBIDO (abajo).

---

## 3. APK de Android (bundle embebido, es lo que se envía)

```bash
cd apps/mobile
export ANDROID_HOME=~/Library/Android/sdk
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
cd android && ./gradlew :app:assembleRelease
```

Salen cuatro APK, uno por arquitectura, en
`apps/mobile/android/app/build/outputs/apk/release/`:

- `app-arm64-v8a-release.apk` → **este es el que se envía** (cualquier teléfono desde ~2015)
- `app-armeabi-v7a-release.apk` → solo equipos anteriores a 2015

Instalar en emulador o teléfono conectado:

```bash
~/Library/Android/sdk/platform-tools/adb install -r apps/mobile/android/app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

---

## 4. iOS (simulador)

**Un solo comando**, desde la raíz del repo (`app/`). Compila, instala LIMPIO y abre:

```bash
npm run ios
```

Resuelve el simulador solo (usa el que esté arrancado o arranca un iPhone),
compila, desinstala la versión anterior, instala, concede ubicación y abre la app.

> Si `pod install` avisa `Cannot find module 'expo-dev-client/package.json'`, es
> inofensivo: expo-updates lo busca para el flujo de development build, que este
> proyecto no usa. Los pods se instalan igual.

Solo si necesitas regenerar el proyecto nativo (tras tocar app.json o plugins):

```bash
cd apps/mobile && npx expo prebuild --platform ios --no-install && cd ios && LANG=en_US.UTF-8 pod install
```

## 5. Actualizaciones por aire (OTA)

Corrige JS —pantallas, textos, lógica, diseño— sin publicar APK nuevo.
Lo nativo (permisos, módulos, splash) SÍ exige compilar de nuevo; la política de
huella lo detecta sola e invalida la actualización para esas builds.

> **Verificado el 2026-09-08: hasta esa fecha NINGÚN update había llegado a un teléfono.**
> Un cliente `expo-updates` pide updates por *channel*; EAS resuelve channel → branch →
> update. `eas update --branch production` crea el **branch**, pero no existía ningún
> **channel** (`eas channel:list` → 0), y el APK —compilado en local con gradle, no con
> EAS Build— no enviaba `expo-channel-name`. Dos fallos independientes; cualquiera de los
> dos bastaba para que el manifiesto respondiera 403.
>
> **2026-09-09, tercer fallo:** la huella que expo-updates graba en el APK al compilar
> (`assets/fingerprint`) NO coincidía con la que calcula `eas update` (4e563f16… frente a
> be94deb1…). Kotlin 2 deja archivos de sesión transitorios en
> `node_modules/expo-updates/expo-updates-gradle-plugin/.kotlin/` mientras gradle compila,
> y @expo/fingerprint 0.20 no los ignora: cada build grababa una huella distinta y ningún
> update la habría apuntado. Lo arregla `apps/mobile/.fingerprintignore`; con él, gradle y
> la CLI dan la misma huella (verificado con la tarea `createReleaseUpdatesResources`).

Requisitos, en orden — cada uno se verifica, no se supone:

```bash
cd apps/mobile
npx eas-cli@latest login                                   # una vez
npx eas-cli@latest channel:create production               # una vez: channel → branch del mismo nombre
npx eas-cli@latest channel:list                            # debe listar production → production
```

`app.json` ya fija `updates.requestHeaders["expo-channel-name"] = "production"`. Eso se
**hornea en el manifiesto nativo**, así que cambia la huella: tras tocarlo hay que
`prebuild` + compilar APK/IPA + instalar, y publicar el update **después** del build
(`eas update` calcula la huella del árbol en ese momento; publicado antes, queda huérfano).

```bash
npx eas-cli@latest update --branch production --message "qué cambia"
```

Verificar que el teléfono lo recibe (con el dispositivo conectado):

```bash
# runtime que lleva la app instalada — debe coincidir con el `runtimeVersion` del update.
# OJO: en el AndroidManifest solo aparece el marcador `file:fingerprint`; el valor real
# va en el asset `assets/fingerprint` del APK.
adb shell pm path ai.nomada.app | sed 's/package://' | xargs -I{} adb pull {} /tmp/app.apk
unzip -p /tmp/app.apk assets/fingerprint; echo
# lo que publicará eas update (debe ser idéntico al anterior)
npx expo-updates runtimeversion:resolve --platform android | python3 -c "import json,sys; print(json.load(sys.stdin)['runtimeVersion'])"
npx eas-cli@latest update:list --branch production --limit 2
```

> **La huella depende del estado de `node_modules`, incluidos los restos de compilación.**
> Verificado el 2026-09-10: con `node_modules` recién salido de `npm ci` la huella Android es
> `a11983300cae…`; en cuanto gradle compila, deja `android/build/` dentro de paquetes como
> `@react-native-masked-view/masked-view` y la huella pasa a `be94deb1…` (@expo/fingerprint
> 0.20 cambia el hash del directorio aunque ignore los ficheros de `build/`). El APK siempre
> se graba en el estado «después de compilar», así que **`eas update` se publica justo
> después de compilar y con esta comprobación, que debe dar dos valores iguales:**
>
> ```bash
> cd apps/mobile && unzip -p android/app/build/outputs/apk/release/app-arm64-v8a-release.apk assets/fingerprint; echo
> npx expo-updates runtimeversion:resolve --platform android | python3 -c "import json,sys; print(json.load(sys.stdin)['runtimeVersion'])"
> ```
>
> Si difieren, no publicar: el update quedaría huérfano. Y la tarea de gradle
> `createReleaseUpdatesResources` cachea la huella entre builds: ante la duda,
> `./gradlew :app:createReleaseUpdatesResources --rerun-tasks`.

Antes de compilar un APK, la comprobación equivalente sin teléfono:

```bash
cd apps/mobile/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew :app:createReleaseUpdatesResources --rerun-tasks -q >/dev/null; cat app/build/generated/assets/createReleaseUpdatesResources/fingerprint
```

**Novedades y iconos de Lugares (al publicar un update con cambios visibles):**

```bash
# 1) añadir la entrada [0] en apps/mobile/src/constants/changelog.ts (es/en): la app
#    la muestra UNA vez, en el primer arranque con la versión nueva.
# 2) si cambió POI_ICON_DEFS (risk-map.types.ts), regenerar los PNG del mapa nativo:
cd apps/mobile && python3 scripts/gen_poi_icons.py
```

> Si `npm ci` falla en EAS con «lock file out of sync», es que se instaló una
> dependencia sin actualizar el lock: `npm install` en la raíz y commitear
> `package-lock.json`.

---

## 5a. ¿Por qué no aparece el panel admin?

Son DOS requisitos independientes en el Space (Settings → Variables) y fallar cualquiera
da el mismo 401, así que hay que mirar los dos:

| Variable | Para qué | Si falta |
|---|---|---|
| `CLERK_ISSUER` | el backend verifica la firma del token | ningún token vale: `/admin/me` responde 401 siempre |
| `ADMIN_USER_IDS` | allowlist de administradores (id de Clerk, empieza por `user_`, **no** `app_`) | token válido pero 403 |

Comprobación en un comando (solo booleanos, no expone ni el emisor ni los ids):

```bash
curl -s https://englergz-nomadaai.hf.space/health | python3 -c "import json,sys; d=json.load(sys.stdin); print('CLERK_ISSUER:', d['auth_ready'], '· ADMIN_USER_IDS:', d['admin_ready'])"
```

Con los dos en `True`, entra al escritorio con tu cuenta y el ítem «Panel admin» aparece
en el menú. El rol se decide SIEMPRE en el servidor; el cliente solo pregunta.

---

## 5b. Base cartográfica (sin claves)

La base vive en `packages/shared/src/basemap.ts` y la usan escritorio, app web y app nativa:
**OpenFreeMap** (estilos vectoriales `positron` y `dark`, datos de OpenStreetMap, sin clave ni
registro) y **Esri World Imagery** para el satelital. Cambiar de tema es `setStyle` con
`keepOwnLayers`, que conserva las capas propias (riesgo, rutas, lugares: fuentes GeoJSON).

> Por qué no CARTO ni los lienzos de Esri: el 2026-09-10 CARTO empezó a exigir API key y
> pintaba «API KEY REQUIRED» sobre todo el mapa; los lienzos de Esri se sirven sin clave pero
> no tienen calles de Tumaco a zoom de ciudad («Map data not yet available»). Comprobación
> rápida de que un proveedor cubre Tumaco: pedir la tesela z16 de (-78.785, 1.806) y mirar
> el tamaño — una tesela con calles pesa 5–9 KB; un placeholder, 2 KB.

---

## 6. Backend (Hugging Face Space)

- URL: `https://englergz-nomadaai.hf.space`
- Comprobar que vive: `curl -s https://englergz-nomadaai.hf.space/health`
- **Redesplegar**: al guardar una variable en Settings → Variables, el Space se
  reconstruye solo. Si no, Settings → *Factory rebuild*.

### Activar el panel admin
1. Panel de Clerk → Users → tu usuario → copiar el **User ID** (empieza por
   `user_`, **no** el `app_...`, que es el id de la aplicación).
2. Space → Settings → Variables → `ADMIN_USER_IDS = user_xxx` (varios separados
   por coma).
3. Esperar el redespliegue.
4. En la web de escritorio: iniciar sesión con esa cuenta → **Configuración** →
   aparece **«Panel admin»** al final del menú, junto a «¿Cómo funciona?».

El botón **solo se muestra si el servidor confirma el rol** (`GET /admin/me` con
el token de Clerk). Si no aparece, es que la variable no tiene tu id o el Space
no se ha redesplegado; no es un problema de la interfaz.

---

## 7. Comprobaciones rápidas de estado

```bash
# Endpoints del backend
curl -s -o /dev/null -w "%{http_code}\n" https://englergz-nomadaai.hf.space/health
curl -s https://englergz-nomadaai.hf.space/config/app

# Permisos reales del APK instalado
adb shell dumpsys package ai.nomada.app | grep -A 20 "requested permissions"

# Servicios en primer plano (segundo plano del viaje)
adb shell dumpsys activity services ai.nomada.app | grep -E "nomadaai-|isForeground"

# Fluidez (fotogramas perdidos)
adb shell dumpsys gfxinfo ai.nomada.app reset && \
  adb shell dumpsys gfxinfo ai.nomada.app | grep -A 6 "Total frames"
```
