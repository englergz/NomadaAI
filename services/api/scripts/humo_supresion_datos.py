#!/usr/bin/env python3
"""Pruebas de humo de «Borrar mis datos»: alcanza lo propio en todas las tablas y nada ajeno.

Por qué existe: el borrado de datos de la app solo llegaba al histórico. Los reportes ciudadanos
(con ubicación y hora) y las opiniones quedaban en el servidor, firmados con un identificador que
mandaba el propio cliente, y el panel admin veía ese identificador crudo. Cada prueba fija una
propiedad del arreglo para que no se pierda sin que nadie lo note.

Cómo corre, y por qué así:
- **En proceso**, llamando a la app ASGI directamente: sin servidor y sin red. Nunca contra el
  Space: estas pruebas mandan DELETE.
- **Base de datos simulada** que interpreta las sentencias de `app/data/history.py`,
  `incidents.py` y `feedback.py` y falla ante cualquier otra: un borrado sin filtro por `user_id`
  no pasa desapercibido. No sustituye a Postgres: no valida la sintaxis.
- **Tokens simulados**: `verify_bearer` se sustituye por un mapa fijo. La verificación real de la
  firma es la de `app/core/auth.py`, que no cambia.

Uso:  cd services/api && .venv/bin/python scripts/humo_supresion_datos.py
Código de salida 1 si alguna prueba falla.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Antes de importar la app: sin base real, sin límite por IP (se prueba aparte), emisor ficticio
# y un único admin de pruebas. `psycopg` bloqueado: ninguna conexión real es posible.
os.environ.pop("DATABASE_URL", None)
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["CLERK_ISSUER"] = "https://emisor-de-pruebas.invalid"
os.environ["ADMIN_USER_IDS"] = "user_admin"
sys.modules["psycopg"] = None
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from _asgi_en_proceso import pedir  # noqa: E402
from app.core import identity  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.data import feedback as datos_opinion  # noqa: E402
from app.data import history as datos_historial  # noqa: E402
from app.data import incidents as datos_reportes  # noqa: E402
from app.main import create_app  # noqa: E402
from app.routers import admin as router_admin  # noqa: E402

# ----------------------------------------------------------------- base de datos simulada
TABLAS = ("sim_effectiveness", "incidents", "feedback")
SQL_EMITIDO: list[str] = []

_BORRA = re.compile(r"delete from (\w+) where user_id = %\((\w+)\)s")
_MUEVE = re.compile(r"update (\w+) set user_id = %\((\w+)\)s where user_id = %\((\w+)\)s")
_CUENTA = re.compile(r"select count\(\*\) from (\w+) where user_id=%s and created_at > now\(\) - interval '1 hour'")
_INSERTA = re.compile(r"insert into (incidents|feedback) \(([^)]*)\) values .* returning id")
_LISTA = re.compile(r"select (.+) from (incidents|feedback) order by created_at desc limit %s")


class BaseSimulada:
    def __init__(self) -> None:
        self.t: dict[str, list[dict]] = {n: [] for n in TABLAS}
        self._id = 1

    def vaciar(self) -> None:
        self.t = {n: [] for n in TABLAS}
        self._id = 1

    def add(self, tabla: str, user_id: str, **extra) -> dict:
        fila = {
            "id": self._id, "user_id": user_id, "city": "tumaco",
            "created_at": datetime(2026, 9, 1, tzinfo=timezone.utc) + timedelta(minutes=self._id),
        }
        if tabla == "incidents":
            fila |= {"category": "robo", "description": None, "lon": -78.79, "lat": 1.80, "hour": 21}
        elif tabla == "feedback":
            fila |= {"useful": 4, "on_time": 4, "trust": 4, "recommend": 4, "comment": "bien", "platform": "android"}
        elif tabla == "sim_effectiveness":
            fila |= {"n_pred": 10, "alerts": 1}
        fila |= extra
        self._id += 1
        self.t[tabla].append(fila)
        return fila

    def de(self, tabla: str, user_id: str) -> int:
        return sum(1 for f in self.t[tabla] if f["user_id"] == user_id)

    def total(self) -> dict[str, int]:
        return {n: len(v) for n, v in self.t.items()}


class _Cursor:
    def __init__(self, db: BaseSimulada) -> None:
        self.db, self.rowcount, self._una, self._todas = db, -1, None, []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params=None) -> None:
        s = " ".join(sql.split()).lower()
        SQL_EMITIDO.append(s)
        db = self.db
        if m := _BORRA.fullmatch(s):
            tabla, clave = m.groups()
            antes = len(db.t[tabla])
            db.t[tabla] = [f for f in db.t[tabla] if f["user_id"] != params[clave]]
            self.rowcount = antes - len(db.t[tabla])
        elif m := _MUEVE.fullmatch(s):
            tabla, nuevo, viejo = m.groups()
            mueve = [f for f in db.t[tabla] if f["user_id"] == params[viejo]]
            for f in mueve:
                f["user_id"] = params[nuevo]
            self.rowcount = len(mueve)
        elif m := _CUENTA.fullmatch(s):
            hace_una_hora = datetime.now(timezone.utc) - timedelta(hours=1)
            self._una = (sum(1 for f in db.t[m.group(1)] if f["user_id"] == params[0] and f["created_at"] > hace_una_hora),)
        elif m := _INSERTA.fullmatch(s):
            columnas = [c.strip() for c in m.group(2).split(",")]
            fila = db.add(m.group(1), params["user_id"], created_at=datetime.now(timezone.utc),
                          **{c: params[c] for c in columnas if c != "user_id"})
            self._una = (fila["id"],)
        elif m := _LISTA.fullmatch(s):
            columnas = [c.strip() for c in m.group(1).split(",")]
            filas = sorted(db.t[m.group(2)], key=lambda f: f["created_at"], reverse=True)[: params[0]]
            self._todas = [tuple(f.get(c) for c in columnas) for f in filas]
        else:
            raise AssertionError(f"sentencia que la base simulada no entiende: {s[:100]!r}")

    def fetchone(self):
        return self._una

    def fetchall(self):
        return self._todas


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
MODULOS = (datos_historial, datos_reportes, datos_opinion)
for _m in MODULOS:
    _m._dsn = lambda: "base-simulada"
    _m._connect = lambda: _Conexion(DB)
    _m._ready = True

# Círculos: aquí nadie tiene ninguno, así que su parte del borrado responde 0 sin tocar la base
# simulada. Que «Borrar mis datos» los alcance de verdad se prueba contra Postgres real en
# `humo_circulos.py` (salir de cada círculo, con sus eventos y rastros).
from app.data import circles as datos_circulos  # noqa: E402
datos_circulos._dsn = lambda: "base-simulada"
datos_circulos.borrar_de = lambda uid: 0

TOKENS = {"tok-ana": "user_ana", "tok-beto": "user_beto", "tok-admin": "user_admin"}


def _verify_simulado(authorization):
    partes = (authorization or "").split(" ", 1)
    return TOKENS.get(partes[1]) if len(partes) == 2 and partes[0].lower() == "bearer" else None


identity.verify_bearer = _verify_simulado
router_admin.verify_bearer = _verify_simulado

LLAVE_1 = base64.urlsafe_b64encode(bytes(range(32))).rstrip(b"=").decode()
LLAVE_2 = base64.urlsafe_b64encode(bytes(range(32, 64))).rstrip(b"=").decode()
DEV_1, DEV_2 = identity.device_user_id(LLAVE_1), identity.device_user_id(LLAVE_2)
LEGADO = "3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b"   # uid anónimo anterior a la llave
AUTORES = ("user_ana", "user_beto", DEV_1, DEV_2, LEGADO, "anon")
TOTAL = {"sim_effectiveness": 6, "incidents": 12, "feedback": 6}

ANA = {"Authorization": "Bearer tok-ana"}
ADMIN = {"Authorization": "Bearer tok-admin"}
REPORTE = {"lon": -78.79, "lat": 1.80, "category": "robo", "hour": 21}
OPINION = {"useful": 4, "on_time": 5, "trust": 4, "recommend": 5, "platform": "android"}


def sembrar() -> None:
    """Cada autor: 1 viaje, 2 reportes y 1 opinión."""
    DB.vaciar()
    for uid in AUTORES:
        DB.add("sim_effectiveness", uid)
        DB.add("incidents", uid)
        DB.add("incidents", uid)
        DB.add("feedback", uid)


APP = create_app()


def igual(obtenido, esperado, que: str) -> None:
    if obtenido != esperado:
        raise AssertionError(f"{que}: se esperaba {esperado!r} y llegó {obtenido!r}")


def filas_de(uid: str) -> list[int]:
    return [DB.de(t, uid) for t in TABLAS]


def escribir(cabeceras: dict, extra: dict, esperado: str) -> None:
    for ruta, cuerpo, tabla in (("/incidents/report", REPORTE, "incidents"), ("/feedback", OPINION, "feedback")):
        st, body = pedir(APP, "POST", ruta, cabeceras, {**cuerpo, **extra})
        guardado = DB.t[tabla][-1]["user_id"]
        igual((st, body.get("accepted"), guardado), (200, True, esperado), f"{ruta} con {sorted(cabeceras)} y {extra}")


# ---------------------------------------------------------------------------- escritura
def t_escritura_atribuida_por_la_prueba():
    escribir(ANA, {"device_id": LEGADO}, "user_ana")
    escribir({"X-Device-Key": LLAVE_1}, {"device_id": LEGADO}, DEV_1)
    escribir({"Authorization": "Bearer caducado", "X-Device-Key": LLAVE_1}, {}, "anon")


def t_escritura_version_anterior():
    escribir({}, {"device_id": LEGADO}, LEGADO)


def t_escritura_no_acepta_ids_del_cuerpo():
    for ajeno in ("user_beto", DEV_2, "anon"):
        escribir({}, {"device_id": ajeno}, "anon")


# ------------------------------------------------------------------------------ borrado
def t_borrar_sin_prueba():
    for q in ("", "?user_id=user_ana", f"?user_id={DEV_1}"):
        igual(pedir(APP, "DELETE", f"/me/data{q}")[0], 401, f"status de DELETE /me/data{q}")
    igual(DB.total(), TOTAL, "filas")


def t_token_invalido_no_cae_a_la_llave():
    st, _ = pedir(APP, "DELETE", "/me/data", {"Authorization": "Bearer caducado", "X-Device-Key": LLAVE_1})
    igual((st, DB.total()), (401, TOTAL), "status y filas")


def t_borrar_con_token_solo_lo_propio():
    st, body = pedir(APP, "DELETE", "/me/data?user_id=user_beto", ANA)
    igual((st, body.get("ok"), body.get("deleted"), body.get("unlinked")),
          (200, True, {"history": 1, "reports": 2, "circles": 0}, {"feedback": 1}), "respuesta")
    igual(filas_de("user_ana"), [0, 0, 0], "filas de Ana")
    for otro in ("user_beto", DEV_1, LEGADO):
        igual(filas_de(otro), [1, 2, 1], f"filas de {otro}")
    igual(DB.total(), {"sim_effectiveness": 5, "incidents": 10, "feedback": 6}, "total: la opinión se conserva")
    igual(DB.de("feedback", "anon"), 2, "la opinión de Ana pasó a anon")


def t_borrar_con_llave_solo_el_dispositivo():
    st, body = pedir(APP, "DELETE", "/me/data", {"X-Device-Key": LLAVE_1})
    igual((st, body.get("deleted"), body.get("unlinked")), (200, {"history": 1, "reports": 2, "circles": 0}, {"feedback": 1}), "respuesta")
    igual((filas_de(DEV_1), filas_de(DEV_2), filas_de("user_ana")), ([0, 0, 0], [1, 2, 1], [1, 2, 1]), "filas")


def t_reclamo_y_borrado_alcanzan_el_uid_anterior():
    st, body = pedir(APP, "POST", "/history/claim", {"X-Device-Key": LLAVE_1}, {"legacy_id": LEGADO})
    igual((st, body.get("moved"), body.get("moved_reports"), body.get("moved_feedback")), (200, 1, 2, 1), "reclamo")
    igual(filas_de(LEGADO), [0, 0, 0], "filas del uid anterior tras el reclamo")
    st, body = pedir(APP, "DELETE", "/me/data", {"X-Device-Key": LLAVE_1})
    igual((st, body.get("deleted"), body.get("unlinked")), (200, {"history": 2, "reports": 4, "circles": 0}, {"feedback": 2}), "borrado")
    igual(filas_de(DEV_1), [0, 0, 0], "filas del dispositivo")


def t_anon_nunca_se_borra():
    for cab in (ANA, {"X-Device-Key": LLAVE_1}, {"X-Device-Key": LLAVE_2}):
        igual(pedir(APP, "DELETE", "/me/data", cab)[0], 200, f"status con {sorted(cab)}")
    igual(filas_de("anon"), [1, 2, 4], "filas anon: intactas, más las tres opiniones desvinculadas")


def t_repetir_es_seguro():
    for _ in range(2):
        st, body = pedir(APP, "DELETE", "/me/data", ANA)
        igual((st, body.get("ok")), (200, True), "status y ok")
    igual((body.get("deleted"), body.get("unlinked")), ({"history": 0, "reports": 0, "circles": 0}, {"feedback": 0}), "segunda vez")


# --------------------------------------------------------------------------- sin confirmar
def t_sin_base_no_confirma():
    original = datos_opinion._dsn
    datos_opinion._dsn = lambda: None
    try:
        st, body = pedir(APP, "DELETE", "/me/data", {"X-Device-Key": LLAVE_1})
    finally:
        datos_opinion._dsn = original
    igual((st, body.get("ok")), (200, False), "respuesta")
    igual(DB.total(), TOTAL, "filas: no se empezó a borrar")


def t_error_de_base_no_filtra_ni_confirma():
    original, log = datos_reportes._connect, logging.getLogger("nomadaai.privacy")

    def rota():
        raise RuntimeError('connection to server at "ep-secreto-123.neon.tech" (10.0.0.1) failed')

    datos_reportes._connect, log.disabled = rota, True
    try:
        st, body = pedir(APP, "DELETE", "/me/data", {"X-Device-Key": LLAVE_1})
    finally:
        datos_reportes._connect, log.disabled = original, False
    igual((st, body.get("ok")), (200, False), "respuesta")
    igual(any(s in json.dumps(body) for s in ("neon", "10.0.0.1")), False, f"la respuesta filtra el error ({body})")


# ------------------------------------------------------------------------------ panel admin
def t_admin_ve_seudonimos():
    st, body = pedir(APP, "GET", "/admin/reports", ADMIN)
    igual(st, 200, "status de /admin/reports")
    reportes = body["reports"]
    igual((len(reportes), [r for r in reportes if "user_id" in r]), (12, []), "reportes y reportes con user_id")
    texto = json.dumps(body)
    igual([u for u in AUTORES[:-1] if u in texto], [], "identificadores crudos en la respuesta")
    autores = {r["autor"] for r in reportes}
    igual(len(autores), 6, "un seudónimo por autor, igual en todos sus reportes")
    igual(sorted(a.split("·")[0] for a in autores),
          sorted(["cuenta", "cuenta", "dispositivo", "dispositivo", "dispositivo", "sin atribuir"]), "tipos de autor")
    opiniones = datos_opinion.list_recent()
    igual((len(opiniones), [o for o in opiniones if "user_id" in o]), (6, []), "opiniones y opiniones con user_id")


def t_admin_sin_rol():
    for cab in ({}, ANA):
        igual(pedir(APP, "GET", "/admin/reports", cab)[0] in (401, 403), True, f"status con {sorted(cab)}")


# ---------------------------------------------------------------------------- invariantes
def t_capa_de_datos_exige_identidad():
    for fn in (datos_reportes.delete_for_user, datos_opinion.unlink_user):
        for malo in ("", None, "anon"):
            try:
                fn(malo)
            except ValueError:
                continue
            raise AssertionError(f"{fn.__module__}.{fn.__name__}({malo!r}) no lanzó")
    for fn in (datos_reportes.claim, datos_opinion.claim):
        for malo in (("user_ana", DEV_1), (LEGADO, "user_ana"), ("anon", DEV_1)):
            try:
                fn(*malo)
            except ValueError:
                continue
            raise AssertionError(f"{fn.__module__}.claim{malo} no lanzó")
    igual(DB.total(), TOTAL, "filas")


def t_health_anuncia():
    st, body = pedir(APP, "GET", "/health")
    igual((st, body.get("data_deletion"), body.get("history_identity")), (200, True, True), "status y banderas")


def t_limite_por_ip():
    os.environ["RATE_LIMIT_ENABLED"] = "true"
    get_settings.cache_clear()
    try:
        con_limite = create_app()
    finally:
        os.environ["RATE_LIMIT_ENABLED"] = "false"
        get_settings.cache_clear()
    codigos = [pedir(con_limite, "DELETE", "/me/data", ip="198.51.100.20")[0] for _ in range(11)]
    igual((codigos[:10], codigos[10]), ([401] * 10, 429), "los 10 primeros y el 11.º")


def t_todo_borrado_filtra_por_user_id():
    mutan = [s for s in SQL_EMITIDO if s.startswith(("delete", "update"))]
    if not mutan:
        raise AssertionError("ninguna prueba llegó a borrar ni a mover filas")
    igual([s for s in mutan if not re.search(r" where user_id = %\(\w+\)s$", s)], [], "DELETE/UPDATE sin filtro por user_id")


PRUEBAS = [
    ("Escritura · reportes y opiniones se atribuyen por token o llave; token inválido → anon", t_escritura_atribuida_por_la_prueba),
    ("Escritura · sin prueba, el uid de una versión anterior de la app sigue atribuyendo", t_escritura_version_anterior),
    ("Escritura · un id de cuenta, de llave o anon en el cuerpo no se acepta → anon", t_escritura_no_acepta_ids_del_cuerpo),
    ("Borrado · sin prueba → 401, nada borrado (?user_id no cuenta)", t_borrar_sin_prueba),
    ("Borrado · token inválido → 401, sin caer a la llave", t_token_invalido_no_cae_a_la_llave),
    ("Borrado · con token: histórico y reportes propios; la opinión se desvincula", t_borrar_con_token_solo_lo_propio),
    ("Borrado · con llave: solo lo del dispositivo", t_borrar_con_llave_solo_el_dispositivo),
    ("Borrado · el reclamo pasa reportes y opiniones del uid anterior y el borrado los alcanza", t_reclamo_y_borrado_alcanzan_el_uid_anterior),
    ("Borrado · lo que quedó anon no se toca", t_anon_nunca_se_borra),
    ("Borrado · repetirlo es seguro", t_repetir_es_seguro),
    ("Sin confirmar · sin base de datos → ok false y nada borrado", t_sin_base_no_confirma),
    ("Sin confirmar · un error de base → ok false, sin detalles del error", t_error_de_base_no_filtra_ni_confirma),
    ("Panel admin · reportes y opiniones llegan con seudónimo, nunca con el identificador", t_admin_ve_seudonimos),
    ("Panel admin · sin rol → 401/403", t_admin_sin_rol),
    ("Invariante · la capa de datos no borra, desvincula ni reclama sin identidad", t_capa_de_datos_exige_identidad),
    ("Contrato · /health anuncia data_deletion", t_health_anuncia),
    ("Invariante · DELETE /me/data tiene límite por IP (11.º → 429)", t_limite_por_ip),
    ("Invariante · todo DELETE/UPDATE emitido filtra por user_id", t_todo_borrado_filtra_por_user_id),
]


def main() -> None:
    instalada = sys.modules.get("psycopg", "") is None and all(
        getattr(m._connect, "__module__", "") == __name__ for m in MODULOS
    )
    if not instalada:
        raise SystemExit("La base simulada no quedó instalada: no se corre nada.")
    print("PRUEBAS DE HUMO — «Borrar mis datos» (en proceso, base simulada, sin red)\n")
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
