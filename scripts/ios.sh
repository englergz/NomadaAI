#!/usr/bin/env bash
# Compila, instala y abre la app en el simulador de iPhone. UN solo comando.
#
# Existe porque las instrucciones sueltas fallaban: los marcadores <UDID> se
# pegaban literalmente y las rutas dependían de en qué carpeta estuvieras. Aquí
# el UDID se resuelve solo y las rutas son absolutas.
set -euo pipefail

MOBILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps/mobile" && pwd)"
APP_ID="ai.nomada.app"
SCHEME="NmadaAI"

# 1. Simulador: el que ya esté arrancado; si no hay ninguno, se arranca un iPhone.
UDID="$(xcrun simctl list devices booted -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for runtime in d.values():
    for dev in runtime:
        print(dev['udid']); raise SystemExit
" 2>/dev/null || true)"

if [ -z "${UDID}" ]; then
  UDID="$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
best=None
for runtime,devs in d.items():
    for dev in devs:
        if 'iPhone' in dev['name']:
            best=dev['udid']
print(best or '')
")"
  [ -z "${UDID}" ] && { echo 'No hay ningún simulador de iPhone instalado (Xcode → Settings → Components).'; exit 1; }
  echo "Arrancando simulador ${UDID}…"
  xcrun simctl boot "${UDID}" || true
  open -a Simulator
fi
echo "Simulador: ${UDID}"

# 2. Compilar. CODE_SIGNING_ALLOWED=NO porque el simulador no necesita firma.
cd "${MOBILE}/ios"
echo "Compilando (esto tarda varios minutos la primera vez)…"
xcodebuild -workspace "${SCHEME}.xcworkspace" -scheme "${SCHEME}" \
  -configuration Release -sdk iphonesimulator \
  -destination "id=${UDID}" -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO | tail -5

APP="${MOBILE}/ios/build/Build/Products/Release-iphonesimulator/${SCHEME}.app"
[ -d "${APP}" ] || { echo "La compilación no produjo ${APP}"; exit 1; }

# 3. Instalación LIMPIA: como la vería alguien que la instala por primera vez.
xcrun simctl uninstall "${UDID}" "${APP_ID}" 2>/dev/null || true
xcrun simctl install "${UDID}" "${APP}"
xcrun simctl privacy "${UDID}" grant location-always "${APP_ID}" 2>/dev/null || true
xcrun simctl location "${UDID}" set 1.7950,-78.7850 2>/dev/null || true
xcrun simctl launch "${UDID}" "${APP_ID}"
echo "Listo: la app está abierta en el simulador."
