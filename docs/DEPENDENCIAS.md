# Nómada.AI · Auditoría de dependencias (2026-09-08)

Qué se arregló, qué queda y **por qué** se acepta lo que queda. Cada afirmación es
reproducible con el comando que la acompaña.

## Resumen

| | Antes | Después |
|---|---|---|
| Backend (`pip-audit -r services/api/requirements.txt`) | **22** vulns en 3 paquetes | **0** |
| Cliente (`npm audit --json`) | 29 (12 high · 17 moderate) | **28** (11 high · 17 moderate · 0 critical) |

## Backend — 22 → 0

| Paquete | Antes | Después | Qué cerraba |
|---|---|---|---|
| `pyjwt[crypto]` | 2.10.1 | **2.13.0** | 12 avisos; el relevante: no validaba la cabecera `crit` (PYSEC-2026-120/179). Es la verificación de tokens de Clerk en `core/auth.py` |
| `starlette` (transitiva de FastAPI) | 0.41.3 | **1.6.0** (pineada explícita) | 9 avisos: URL reconstruida sin validar `Host`, ruta sin validar, etc. |
| `fastapi` | 0.115.6 | **0.141.1** | necesario para poder subir starlette (`>=0.46`, sin tope) |
| `pyarrow` | 18.1.0 | **23.0.1** | use-after-free en Arrow C++ (PYSEC-2026-113) |

**Verificación:** venv limpio instalado desde `requirements.txt` como lo hace Docker →
`pip-audit` sin hallazgos en dependencias de la app → suite completa **con lifespan**
(carga el corpus real con pyarrow 23, pandas, sklearn) apuntando al layout del
contenedor: `/health` 4032/3226/806, evaluación 86,7 % (n=30), **Tumaco 7,8 % y Cali
19,1 % idénticos a producción**, feedback 422, admin 401, rate-limit 181.ª → 429.

> Al probar sin `RESEARCH_DIR` salió 0 % de reducción. **No era regresión**: sin esa
> variable el lifespan carga la malla prototipo de 425 celdas y no encuentra el riesgo de
> Cali. Con el layout del contenedor, 7,8 % / 19,1 % exactos. Se deja escrito para que
> nadie lo «arregle».

## Cliente — 29 → 28, y por qué no más

### Lo arreglado: `@clerk/clerk-expo` (HIGH, bypass de autorización, GHSA-w24r-5266-9c3c)

Primero se estableció si **nos afectaba**, leyendo el advisory: el bypass solo ocurre al
combinar dimensiones en una sola llamada `has()`/`auth.protect()` (reverificación +
rol/permiso/plan, o *billing* + rol/permiso). Comprobado en el código: la app usa solo
`useUser`/`useAuth`/`useSSO`/`SignedIn`/`UserButton`; **cero llamadas a autorización
combinada** (el backend verifica el JWT con PyJWT, sin SDK de Clerk). Además, la lógica
real vive en `@clerk/shared` (3.47.7 ≥ 3.47.5 parcheado) y `@clerk/clerk-js` (5.127.0
≥ 5.125.10 parcheado); los únicos archivos de `clerk-expo` con esa lógica son
`cache/dummy-data/*` — fixtures. **No explotable en esta app.**

Se parcheó igualmente para no dejar un HIGH «seguro» que tiente a `--force`:
`overrides: {"@clerk/clerk-js": "5.127.0"}` en la raíz + `clerk-expo` **2.19.36**.
Resultado, medido con una guardia por **conjuntos de nombres** (no por líneas del lock):
**0 paquetes nuevos, 0 eliminados, 1 cambio de versión**.

> **Por qué el override.** `clerk-expo` ≥ 2.19.36 pide `clerk-js ^5.125.10`; npm resolvería
> a 5.127.2, que en un *patch* añade `@solana/web3.js`, `jayson`, `rpc-websockets` y addons
> nativos de Node (`bufferutil`, `utf-8-validate` vía `node-gyp-build`): 29 paquetes nuevos y
> riesgo real de romper el bundle de React Native. 5.127.0 está parcheado y no los trae.
> **Revisar el override** cuando se suba a `clerk-expo` 2.20+ o `clerk-js` 6.x.

### Lo que queda (28) y por qué se acepta

| Clase | Paquetes | Dónde corre | Riesgo real | Decisión |
|---|---|---|---|---|
| **Servidor de desarrollo** | `vite` 5.4.21, `esbuild` 0.21.5 | solo `vite dev` en la máquina del desarrollador; el Space sirve `dist/` estático | dos de tres avisos son solo Windows | aceptado; subir a vite 6.4.3+ cuando toque la web |
| **Tooling de build** | `metro*`, `@expo/config-plugins`, `xcode`, `uuid` 7 (vía xcode), `postcss`, `browserslist`, `js-yaml`, `image-size`, `@xmldom/xmldom`, `brace-expansion`, `@expo/prebuild-config` | `expo prebuild` / bundling, en la máquina del desarrollador, sobre archivos propios | DoS con entrada maliciosa en tiempo de build | aceptado |
| **Runtime, sin parche seguro** | `decode-uri-component` 0.2.2 vía `query-string` 7 vía `expo-router` | **sí llega al usuario**: expo-router parsea deep links `nomadaai://` | DoS por decodificación exponencial si el usuario abre un enlace manipulado (moderado, requiere interacción) | **aceptado con seguimiento**: 0.5.0 es ESM-only y `query-string@7` es CJS → un override no es reemplazo directo. Se resuelve cuando expo-router suba `query-string` |
| **Falsos «arreglos»** | `expo`, `expo-router`, `expo-splash-screen`, `maplibre` marcados FORCE | — | — | el «fix» propuesto es **degradar** (expo 57 → 46). Inaplicable |

### ⛔ Nunca `npm audit fix --force` — ni `npm audit fix` a secas sin guardia

Medido el 2026-09-08: `npm audit fix` (sin force) pasó de **29 a 51 vulnerabilidades con 1
crítica**, metió `@solana/*`, `jayson`, `stream-json` y reliquias de Expo SDK ~40
(`@unimodules/react-native-adapter`, `expo-error-recovery`), y cambió el lock en +12.405/−6.361
líneas. Revertido con `git checkout -- package-lock.json && npm ci`. Con `--force` habría
degradado `expo` a 46 y `expo-router` a 5.x.

**Regla:** cambios de dependencias uno a uno, con guardia por nombres:

```bash
git show HEAD:package-lock.json > /tmp/antes.json
npm install <paquete>@<versión> --workspace apps/mobile --no-audit
# comparar el conjunto de NOMBRES del lock antes/después: nuevos, eliminados, cambios de versión
# mantener solo si los nuevos son esperados; si no: git checkout -- package-lock.json && npm ci
```

## Cómo repetir

```bash
npm audit --json | python3 -c "import json,sys; print(json.load(sys.stdin)['metadata']['vulnerabilities'])"
python3.11 -m venv /tmp/v && /tmp/v/bin/pip install -r services/api/requirements.txt pip-audit && /tmp/v/bin/pip-audit
```
