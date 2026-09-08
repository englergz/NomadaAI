"""Rate-limit por IP en el servidor — el respaldo que faltaba.

Por qué existe: el único freno a las escrituras era un cooldown EN EL CLIENTE, que se
salta con `curl`. En servidor había límites por identidad en `incidents` y `feedback`,
pero (1) `POST /history/trip` no tenía ninguno, (2) los endpoints de cómputo
(`route/build` tarda ~3 s en Cali) tampoco, y (3) la identidad anónima es un dato que
manda el cliente, así que por sí sola no frena a quien la cambie en cada petición.

Diseño, y sus límites declarados:
- **Ventana deslizante en memoria**, por (regla, IP). Vale porque el Space es UNA réplica;
  con varias haría falta Redis. Memoria acotada: se podan marcas viejas al consultar y
  se descartan las claves más antiguas al pasar de `_MAX_KEYS`.
- **La IP sale de `X-Forwarded-For`** (último salto) y, si no viene, de `client.host`.
  Uvicorn corre sin `--proxy-headers`, así que detrás del proxy de Hugging Face
  `client.host` sería el proxy para TODOS: sin leer la cabecera, un límite por IP metería
  a todos los usuarios en un mismo cubo.
- **Umbrales generosos a propósito.** Esto es el respaldo contra abuso, no el control
  fino: el control primario sigue siendo por identidad en base de datos. Si un usuario
  real llega a estos números, algo va mal en el cliente, no en el usuario.
- Solo métodos que escriben o cuestan (POST/PUT/DELETE). GET/HEAD/OPTIONS, `/health` y
  `/admin/*` (ya protegido por rol en servidor) quedan fuera.
- Responde **429** con `Retry-After` y un mensaje en español que la app puede mostrar.
"""
from __future__ import annotations

import threading
import time
from collections import OrderedDict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# (método, prefijo de ruta) → (máx. peticiones, ventana en segundos)
REGLAS: list[tuple[str, str, int, int]] = [
    ("POST",   "/history/trip",        180, 3600),   # un viaje cada 20 s, sostenido
    ("DELETE", "/history",              10, 3600),
    ("POST",   "/incidents/report",     30, 3600),   # el límite fino (5/h) es por identidad
    ("POST",   "/feedback",             10, 3600),   # ídem (3/h por identidad)
    ("POST",   "/route/build",         600, 3600),   # cómputo: 10/min de media, con ráfagas
    ("POST",   "/route/safe",          600, 3600),
    ("POST",   "/predict/destination", 600, 3600),
    ("POST",   "/predict/online",      600, 3600),
]
_EXENTOS = ("/health", "/admin/")
_MAX_KEYS = 20_000


def _regla(method: str, path: str) -> tuple[str, int, int] | None:
    if method not in ("POST", "PUT", "DELETE") or path.startswith(_EXENTOS):
        return None
    for m, pref, n, win in REGLAS:
        if m == method and (path == pref or path.startswith(pref.rstrip("/") + "/")):
            return pref, n, win
    return None


def client_ip(request: Request) -> str:
    """Último salto de X-Forwarded-For (lo que añade el proxy de confianza); si no, client.host."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        ultimo = xff.split(",")[-1].strip()
        if ultimo:
            return ultimo
    return request.client.host if request.client else "desconocido"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool = True) -> None:
        super().__init__(app)
        self.enabled = enabled
        self._hits: "OrderedDict[tuple[str, str], deque[float]]" = OrderedDict()
        self._lock = threading.Lock()

    def _consulta(self, key: tuple[str, str], n: int, win: int) -> tuple[bool, int]:
        """Devuelve (permitido, segundos_para_reintentar)."""
        ahora = time.monotonic()
        with self._lock:
            d = self._hits.get(key)
            if d is None:
                if len(self._hits) >= _MAX_KEYS:
                    self._hits.popitem(last=False)   # la clave más antigua
                d = deque()
                self._hits[key] = d
            else:
                self._hits.move_to_end(key)
            while d and ahora - d[0] >= win:
                d.popleft()
            if len(d) >= n:
                return False, max(1, int(win - (ahora - d[0])) + 1)
            d.append(ahora)
            return True, 0

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        r = _regla(request.method, request.url.path)
        if r is None:
            return await call_next(request)
        pref, n, win = r
        ok, espera = self._consulta((pref, client_ip(request)), n, win)
        if not ok:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(espera)},
                content={"detail": "Demasiadas peticiones desde esta conexión. "
                                   f"Vuelve a intentarlo en {espera} segundos."},
            )
        return await call_next(request)
