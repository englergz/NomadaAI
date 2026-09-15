#!/usr/bin/env python3
"""Pruebas de humo de la IDENTIDAD en `/history`: nadie lee ni borra lo de otra persona.

Por qué existe: `DELETE /history` y `GET /history/summary` tomaban el `user_id` de la query
cuando no llegaba un token válido. Bastaba conocer un identificador ajeno para leer o borrar su
histórico, y `DELETE /history?city=…` sin nada más borraba la ciudad entera. Cada prueba fija una
propiedad que debe cumplirse siempre, para que ese agujero no se reabra sin que nadie lo note.

Cómo corre, y por qué así:
- **En proceso**, llamando a la app ASGI directamente: sin servidor, sin red y sin httpx.
  Nunca contra el Space: estas pruebas mandan DELETE.
- **Base de datos simulada** que interpreta las sentencias que emite `app/data/history.py`, con
  sus WHERE, y falla ante cualquier otra. Una regresión en el SQL (un borrado sin `user_id`) se
  ve como filas ajenas que desaparecen. No sustituye a Postgres: no valida la sintaxis.
- **Tokens simulados**: `verify_bearer` se sustituye por un mapa fijo. La verificación real de la
  firma es la de `app/core/auth.py`, que no cambia.

Uso:  cd services/api && .venv/bin/python scripts/humo_history_identidad.py
Código de salida 1 si alguna prueba falla.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Antes de importar la app: sin base real, sin límite por IP (se prueba aparte) y con un emisor
# ficticio, por si algo llegara a la verificación real de tokens.
os.environ.pop("DATABASE_URL", None)
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["CLERK_ISSUER"] = "https://emisor-de-pruebas.invalid"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import identity  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.data import history as data  # noqa: E402
from app.main import create_app  # noqa: E402

# ----------------------------------------------------------------- base de datos simulada
SQL_EMITIDO: list[str] = []          # todas las sentencias de todas las pruebas
_COND = re.compile(r"(\w+) = %\((\w+)\)s")


def _filtro(sql: str, params: dict):
    m = re.search(r"\bwhere\b(.*)$", sql)
    if not m:
        raise AssertionError(f"sentencia sin WHERE: {sql[:90]!r}")
    conds = []
    for parte in re.split(r"\band\b", m.group(1)):
        c = _COND.fullmatch(parte.strip())
        if not c:
            raise AssertionError(f"condición que la base simulada no entiende: {parte.strip()!r}")
        conds.append((c.group(1), params[c.group(2)]))
    return lambda fila: all(fila[col] == val for col, val in conds)


class BaseSimulada:
    def __init__(self) -> None:
        self.filas: list[dict] = []
        self._id = 1

    def add(self, user_id: str, city: str = "tumaco", n: int = 1) -> None:
        for _ in range(n):
            self.filas.append({
                "id": self._id, "city": city, "user_id": user_id,
                "created_at": datetime(2026, 9, 1, tzinfo=timezone.utc) + timedelta(minutes=self._id),
                "n_pred": 10, "model_err_sum": 500.0, "base_err_sum": 900.0, "model_hit50": 6,
                "base_hit50": 3, "alerts": 1, "exposure_reduction_pct": 20.0,
            })
            self._id += 1

    def count(self, user_id: str, city: str | None = None) -> int:
        return sum(1 for f in self.filas if f["user_id"] == user_id and city in (None, f["city"]))


class _Cursor:
    def __init__(self, db: BaseSimulada) -> None:
        self.db, self.rowcount, self._una = db, -1, None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: dict | None = None) -> None:
        params = params or {}
        s = " ".join(sql.split()).lower()
        SQL_EMITIDO.append(s)
        db = self.db
        if s.startswith("insert into sim_effectiveness"):
            fila = dict(params, id=db._id, created_at=datetime.now(timezone.utc))
            db._id += 1
            db.filas.append(fila)
            self._una = (fila["id"],)
        elif s.startswith("delete from sim_effectiveness "):
            quita = _filtro(s, params)
            antes = len(db.filas)
            db.filas = [f for f in db.filas if not quita(f)]
            self.rowcount = antes - len(db.filas)
        elif s.startswith("update sim_effectiveness set user_id = %(new)s "):
            mueve = [f for f in db.filas if _filtro(s, params)(f)]
            for f in mueve:
                f["user_id"] = params["new"]
            self.rowcount = len(mueve)
        elif s.startswith("select") and " from sim_effectiveness " in s and "group by" not in s:
            fs = [f for f in db.filas if _filtro(s, params)(f)]

            def suma(k: str):
                return sum(f.get(k) or 0 for f in fs)

            reds = [f["exposure_reduction_pct"] for f in fs if f.get("exposure_reduction_pct") is not None]
            fechas = [f["created_at"] for f in fs]
            self._una = (
                len(fs), len({f["user_id"] for f in fs}), suma("n_pred"), suma("model_err_sum"),
                suma("base_err_sum"), suma("model_hit50"), suma("base_hit50"), suma("alerts"),
                len(reds), (sum(reds) / len(reds)) if reds else None,
                min(fechas) if fechas else None, max(fechas) if fechas else None,
            )
        else:
            raise AssertionError(f"sentencia que la base simulada no entiende: {s[:90]!r}")

    def fetchone(self):
        return self._una


class _Conexion:
    def __init__(self, db: BaseSimulada) -> None:
        self.db = db

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return _Cursor(self.db)

    def commit(self) -> None:
        pass


DB = BaseSimulada()
data._dsn = lambda: "base-simulada"
data._connect = lambda: _Conexion(DB)
data._ready = True

TOKENS = {"tok-ana": "user_ana", "tok-beto": "user_beto"}


def _verify_simulado(authorization):
    partes = (authorization or "").split(" ", 1)
    return TOKENS.get(partes[1]) if len(partes) == 2 and partes[0].lower() == "bearer" else None


identity.verify_bearer = _verify_simulado

LLAVE_1 = base64.urlsafe_b64encode(bytes(range(32))).rstrip(b"=").decode()
LLAVE_2 = base64.urlsafe_b64encode(bytes(range(32, 64))).rstrip(b"=").decode()
DEV_1, DEV_2 = identity.device_user_id(LLAVE_1), identity.device_user_id(LLAVE_2)
LEGADO = "3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b"      # uid anterior (crypto.randomUUID)
LEGADO_RESPALDO = "u_1725000000000_k3j4h5g6f7"      # uid anterior (respaldo sin crypto)
TOTAL = 13


def sembrar() -> None:
    DB.filas.clear()
    DB.add("user_ana", "tumaco", 3)
    DB.add("user_ana", "cali", 1)
    DB.add("user_beto", "tumaco", 2)
    DB.add(DEV_1, "tumaco", 2)
    DB.add(DEV_2, "tumaco", 1)
    DB.add(LEGADO, "tumaco", 2)
    DB.add(LEGADO_RESPALDO, "tumaco", 1)
    DB.add("anon", "tumaco", 1)


APP = create_app()


# ------------------------------------------------------------------ petición en proceso
def pedir(app, method: str, path: str, headers: dict | None = None, body=None, ip: str = "203.0.113.7"):
    """Petición contra la app ASGI, sin red. Devuelve (status, json)."""

    async def correr():
        raw = json.dumps(body).encode() if body is not None else b""
        cabeceras = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
        if body is not None:
            cabeceras.append((b"content-type", b"application/json"))
        cabeceras.append((b"content-length", str(len(raw)).encode()))
        ruta, _, query = path.partition("?")
        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method,
            "scheme": "http", "path": ruta, "raw_path": ruta.encode(), "query_string": query.encode(),
            "root_path": "", "headers": cabeceras, "client": (ip, 50000), "server": ("pruebas", 80),
        }
        entregado = False
        fin = asyncio.Event()
        out = {"status": 0, "body": b""}

        async def receive():
            nonlocal entregado
            if not entregado:
                entregado = True
                return {"type": "http.request", "body": raw, "more_body": False}
            await fin.wait()   # como un cliente real: sigue conectado hasta recibir la respuesta
            return {"type": "http.disconnect"}

        async def send(msg):
            if msg["type"] == "http.response.start":
                out["status"] = msg["status"]
            elif msg["type"] == "http.response.body":
                out["body"] += msg.get("body", b"")
                if not msg.get("more_body"):
                    fin.set()

        await app(scope, receive, send)
        fin.set()
        return out["status"], json.loads(out["body"].decode() or "null")

    return asyncio.run(correr())


def igual(obtenido, esperado, que: str) -> None:
    if obtenido != esperado:
        raise AssertionError(f"{que}: se esperaba {esperado!r} y llegó {obtenido!r}")


ANA = {"Authorization": "Bearer tok-ana"}


# ------------------------------------------------------------------------------ borrado
def t_borrar_sin_credenciales():
    igual(pedir(APP, "DELETE", "/history")[0], 401, "status")
    igual(len(DB.filas), TOTAL, "filas")


def t_borrar_ciudad_entera():
    igual(pedir(APP, "DELETE", "/history?city=tumaco")[0], 401, "status de DELETE /history?city=tumaco")
    igual(len(DB.filas), TOTAL, "filas")


def t_borrar_user_id_ajeno_sin_token():
    for victima in ("user_beto", DEV_1, LEGADO, "anon"):
        igual(pedir(APP, "DELETE", f"/history?user_id={victima}")[0], 401, f"status con user_id={victima}")
    igual(len(DB.filas), TOTAL, "filas")


def t_borrar_con_token_ignora_user_id():
    st, body = pedir(APP, "DELETE", "/history?user_id=user_beto", ANA)
    igual((st, body.get("ok"), body.get("deleted")), (200, True, 4), "respuesta")
    igual((DB.count("user_ana"), DB.count("user_beto"), len(DB.filas)), (0, 2, TOTAL - 4), "filas de Ana, Beto y total")


def t_borrar_con_llave_solo_lo_suyo():
    st, body = pedir(APP, "DELETE", "/history?user_id=user_ana", {"X-Device-Key": LLAVE_1})
    igual((st, body.get("deleted")), (200, 2), "respuesta")
    igual((DB.count(DEV_1), len(DB.filas)), (0, TOTAL - 2), "filas del dispositivo 1 y total")


def t_borrar_por_ciudad_acotado():
    st, body = pedir(APP, "DELETE", "/history?city=cali", ANA)
    igual((st, body.get("deleted")), (200, 1), "respuesta")
    igual((DB.count("user_ana", "cali"), DB.count("user_ana", "tumaco")), (0, 3), "Ana en Cali y en Tumaco")


def t_token_invalido_no_cae_a_la_llave():
    st, _ = pedir(APP, "DELETE", "/history", {"Authorization": "Bearer caducado", "X-Device-Key": LLAVE_1})
    igual((st, len(DB.filas)), (401, TOTAL), "status y filas")


def t_llave_mal_formada():
    for mala in (LEGADO, "anon", LLAVE_1[:42], LLAVE_1 + "+/", "x" * 129):
        igual(pedir(APP, "DELETE", "/history", {"X-Device-Key": mala})[0], 401, f"status con llave {mala[:14]!r}")
    igual(len(DB.filas), TOTAL, "filas")


def t_llave_con_forma_de_cuenta():
    # Formato válido de llave, pero su id es dev_…: no puede alcanzar la cuenta que imita.
    st, body = pedir(APP, "DELETE", "/history", {"X-Device-Key": "user_ana" + "x" * 40})
    igual((st, body.get("deleted"), DB.count("user_ana")), (200, 0, 4), "status, borradas y filas de Ana")


# ------------------------------------------------------------------------------ lectura
def t_resumen_ajeno_sin_token():
    for q in ("?user_id=user_beto", f"?user_id={DEV_1}", "?scope=me&user_id=user_beto", ""):
        igual(pedir(APP, "GET", f"/history/summary{q}")[0], 401, f"status de /history/summary{q}")


def t_resumen_con_token_ignora_user_id():
    st, body = pedir(APP, "GET", "/history/summary?user_id=user_beto", ANA)
    igual((st, body.get("scope"), body.get("trips")), (200, "me", 3), "respuesta (Ana en Tumaco)")
    igual("user_id" in body, False, "la respuesta trae user_id")


def t_resumen_con_llave():
    st, body = pedir(APP, "GET", "/history/summary", {"X-Device-Key": LLAVE_1})
    igual((st, body.get("trips"), body.get("users")), (200, 2, 1), "respuesta")


def t_resumen_global_no_mira_identidad():
    st, body = pedir(APP, "GET", "/history/summary?scope=global&user_id=user_ana", {"Authorization": "Bearer caducado"})
    igual((st, body.get("scope"), body.get("trips"), body.get("users")), (200, "global", 12, 7), "respuesta (Tumaco, todos)")


# ---------------------------------------------------------------------------- escritura
VIAJE = {"mode": "test", "vehicle": "car", "hour": 20, "n_pred": 4, "alerts": 1, "user_id": "user_beto"}


def t_viaje_con_user_id_ajeno_y_sin_prueba():
    st, body = pedir(APP, "POST", "/history/trip", body=VIAJE)
    igual((st, body.get("ok"), DB.filas[-1]["user_id"]), (200, True, "anon"), "status, ok y user_id guardado")
    igual(DB.count("user_beto"), 2, "filas de Beto")


def t_viaje_atribuido_por_la_prueba():
    casos = [(ANA, "user_ana"), ({"X-Device-Key": LLAVE_2}, DEV_2),
             ({"Authorization": "Bearer caducado", "X-Device-Key": LLAVE_2}, "anon")]
    for cab, esperado in casos:
        st, _ = pedir(APP, "POST", "/history/trip", cab, VIAJE)
        igual((st, DB.filas[-1]["user_id"]), (200, esperado), f"con cabeceras {sorted(cab)}")


# ---------------------------------------------------------------- reclamo del uid anterior
def t_reclamo_sin_llave():
    st, _ = pedir(APP, "POST", "/history/claim", ANA, {"legacy_id": LEGADO})
    igual((st, DB.count(LEGADO)), (401, 2), "status y filas del uid anterior")


def t_reclamo_nunca_alcanza_cuentas_ni_anon():
    for ajeno in ("user_ana", "anon", DEV_2, "user_ana' or '1'='1", LEGADO.upper()):
        st, _ = pedir(APP, "POST", "/history/claim", {"X-Device-Key": LLAVE_1}, {"legacy_id": ajeno})
        igual(st, 422, f"status con legacy_id={ajeno!r}")
    igual((DB.count("user_ana"), DB.count("anon"), DB.count(DEV_2), len(DB.filas)), (4, 1, 1, TOTAL), "filas")


def t_reclamo_mueve_solo_ese_uid_una_vez():
    st, body = pedir(APP, "POST", "/history/claim", {"X-Device-Key": LLAVE_1}, {"legacy_id": LEGADO})
    igual((st, body.get("ok"), body.get("moved")), (200, True, 2), "primer reclamo")
    igual((DB.count(LEGADO), DB.count(DEV_1), DB.count(LEGADO_RESPALDO)), (0, 4, 1), "filas tras el reclamo")
    st, body = pedir(APP, "POST", "/history/claim", {"X-Device-Key": LLAVE_2}, {"legacy_id": LEGADO})
    igual((st, body.get("moved"), DB.count(DEV_2)), (200, 0, 1), "un segundo reclamante no se lleva nada")
    st, body = pedir(APP, "POST", "/history/claim", {"X-Device-Key": LLAVE_2}, {"legacy_id": LEGADO_RESPALDO})
    igual((st, body.get("moved")), (200, 1), "uid con formato de respaldo")


# ---------------------------------------------------------------------------- invariantes
def t_ids_de_llave():
    igual(identity.device_user_id(LLAVE_1), DEV_1, "determinista")
    igual(len({DEV_1, DEV_2}), 2, "llaves distintas dan ids distintos")
    for i in (DEV_1, DEV_2):
        igual((i.startswith("dev_"), len(i) <= 64), (True, True), f"prefijo y largo de {i}")  # log_trip corta a 64


def t_capa_de_datos_exige_identidad():
    for vacio in ("", None):
        try:
            data.reset(vacio)
        except ValueError:
            continue
        raise AssertionError(f"reset({vacio!r}) no lanzó")
    for malo in (("user_ana", DEV_1), (LEGADO, "user_ana"), ("anon", DEV_1)):
        try:
            data.claim(*malo)
        except ValueError:
            continue
        raise AssertionError(f"claim{malo} no lanzó")
    igual(len(DB.filas), TOTAL, "filas")


def t_error_de_base_no_filtra_detalles():
    original, log = data._connect, logging.getLogger("nomadaai.history")

    def rota():
        raise RuntimeError('connection to server at "ep-secreto-123.neon.tech" (10.0.0.1) failed')

    data._connect, log.disabled = rota, True
    try:
        st, body = pedir(APP, "DELETE", "/history", {"X-Device-Key": LLAVE_1})
    finally:
        data._connect, log.disabled = original, False
    igual((st, body.get("ok")), (200, False), "respuesta")
    igual("neon" in json.dumps(body), False, f"la respuesta filtra el error ({body})")


def t_limite_de_reclamos_por_ip():
    os.environ["RATE_LIMIT_ENABLED"] = "true"
    get_settings.cache_clear()
    try:
        con_limite = create_app()
    finally:
        os.environ["RATE_LIMIT_ENABLED"] = "false"
        get_settings.cache_clear()
    cab, cuerpo = {"X-Device-Key": LLAVE_1}, {"legacy_id": LEGADO}
    codigos = [pedir(con_limite, "POST", "/history/claim", cab, cuerpo, ip="198.51.100.9")[0] for _ in range(21)]
    igual((codigos[:20], codigos[20]), ([200] * 20, 429), "los 20 primeros y el 21")


def t_health_anuncia_identidad():
    st, body = pedir(APP, "GET", "/health")
    igual((st, body.get("history_identity")), (200, True), "status y history_identity")


def t_todo_borrado_filtra_por_user_id():
    mutan = [s for s in SQL_EMITIDO if s.startswith(("delete", "update"))]
    if not mutan:
        raise AssertionError("ninguna prueba llegó a borrar ni a reclamar")
    igual([s for s in mutan if "where user_id = %(" not in s], [], "DELETE/UPDATE sin filtro por user_id")


PRUEBAS = [
    ("Borrado · sin credenciales → 401, nada borrado", t_borrar_sin_credenciales),
    ("Borrado · DELETE /history?city=tumaco sin credenciales → 401 (la ciudad sigue entera)", t_borrar_ciudad_entera),
    ("Borrado · ?user_id=<ajeno> sin token → 401", t_borrar_user_id_ajeno_sin_token),
    ("Borrado · con token manda el token, no ?user_id", t_borrar_con_token_ignora_user_id),
    ("Borrado · con llave solo lo del dispositivo", t_borrar_con_llave_solo_lo_suyo),
    ("Borrado · ?city acota a esa ciudad", t_borrar_por_ciudad_acotado),
    ("Borrado · token inválido → 401, sin caer a la llave", t_token_invalido_no_cae_a_la_llave),
    ("Borrado · llave mal formada (incluido el uid anterior) → 401", t_llave_mal_formada),
    ("Borrado · una llave con forma de id de cuenta no alcanza la cuenta", t_llave_con_forma_de_cuenta),
    ("Lectura · ?user_id=<ajeno> sin token → 401", t_resumen_ajeno_sin_token),
    ("Lectura · con token manda el token y no se devuelve user_id", t_resumen_con_token_ignora_user_id),
    ("Lectura · con llave solo lo del dispositivo", t_resumen_con_llave),
    ("Lectura · scope=global no mira la identidad", t_resumen_global_no_mira_identidad),
    ("Escritura · user_id ajeno sin prueba se guarda como anon", t_viaje_con_user_id_ajeno_y_sin_prueba),
    ("Escritura · se atribuye por token o llave; token inválido → anon", t_viaje_atribuido_por_la_prueba),
    ("Reclamo · sin llave → 401", t_reclamo_sin_llave),
    ("Reclamo · nunca alcanza cuentas, anon ni ids de llave → 422", t_reclamo_nunca_alcanza_cuentas_ni_anon),
    ("Reclamo · mueve solo ese uid y una sola vez", t_reclamo_mueve_solo_ese_uid_una_vez),
    ("Invariante · ids de llave: dev_, deterministas, ≤ 64", t_ids_de_llave),
    ("Invariante · la capa de datos no borra ni reclama sin identidad", t_capa_de_datos_exige_identidad),
    ("Invariante · un error de base no filtra su texto", t_error_de_base_no_filtra_detalles),
    ("Invariante · el reclamo tiene límite por IP (21.º → 429)", t_limite_de_reclamos_por_ip),
    ("Contrato · /health anuncia history_identity (sin él, los clientes no borran)", t_health_anuncia_identidad),
    ("Invariante · todo DELETE/UPDATE emitido filtra por user_id", t_todo_borrado_filtra_por_user_id),
]


def main() -> None:
    if getattr(data._connect, "__module__", "") != __name__:
        raise SystemExit("La base simulada no quedó instalada: no se corre nada.")
    print("PRUEBAS DE HUMO — identidad en /history (en proceso, base simulada, sin red)\n")
    fallos = 0
    for nombre, fn in PRUEBAS:
        sembrar()
        try:
            fn()
            ok, detalle = True, ""
        except AssertionError as e:
            ok, detalle = False, str(e)
        except Exception as e:  # noqa: BLE001
            ok, detalle = False, f"excepción: {type(e).__name__}: {e}"
        fallos += not ok
        print(f"  [{'PASA' if ok else 'FALLA'}] {nombre}" + (f"\n          {detalle}" if detalle else ""))
    print(f"\n{len(PRUEBAS) - fallos}/{len(PRUEBAS)} pasan")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
