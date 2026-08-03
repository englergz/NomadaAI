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

```bash
cd apps/mobile
JAVA_HOME=$(/usr/libexec/java_home -v 21) npx expo prebuild --platform ios --no-install
cd ios && LANG=en_US.UTF-8 pod install     # sin LANG, CocoaPods falla por codificación

xcodebuild -workspace NmadaAI.xcworkspace -scheme NmadaAI \
  -configuration Release -sdk iphonesimulator \
  -destination "id=<UDID>" -derivedDataPath build CODE_SIGNING_ALLOWED=NO
```

Instalar y abrir en el simulador:

```bash
xcrun simctl list devices available | grep iPhone      # obtener el UDID
xcrun simctl install <UDID> apps/mobile/ios/build/Build/Products/Release-iphonesimulator/NmadaAI.app
xcrun simctl launch <UDID> ai.nomada.app
```

Instalación **limpia** (como la recibe alguien nuevo):

```bash
xcrun simctl uninstall <UDID> ai.nomada.app     # iOS
adb uninstall ai.nomada.app                      # Android
```

---

## 5. Actualizaciones por aire (OTA)

Corrige JS —pantallas, textos, lógica, diseño— sin publicar APK nuevo.
Lo nativo (permisos, módulos, splash) SÍ exige compilar de nuevo; la política de
huella lo detecta sola e invalida la actualización para esas builds.

```bash
cd apps/mobile
npx eas-cli@latest login                       # una vez
npx eas-cli@latest update --branch production --message "qué cambia"
```

> Si `npm ci` falla en EAS con «lock file out of sync», es que se instaló una
> dependencia sin actualizar el lock: `npm install` en la raíz y commitear
> `package-lock.json`.

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
