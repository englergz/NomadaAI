#!/usr/bin/env python3
"""Humo de CÍRCULOS contra una base de datos LOCAL y la app real, en el mismo proceso.

Qué se comprueba, que es lo que hace confiable la función: que sin cuenta no hay círculos,
que nadie ve lo que pasa en un círculo del que no es miembro, que los disparadores son de
cada persona, que la ubicación solo entra con un evento abierto y propio, y —lo más
importante— que **al cerrar el evento el rastro desaparece**.

Lo único simulado es la verificación del token (la cubre `humo_history_identidad.py`): aquí
la identidad llega por una cabecera de prueba. Todo lo demás es la app y la base de verdad.

Uso:  DATABASE_URL=postgresql://postgres:prueba@127.0.0.1:55432/nomadaai \
      .venv/bin/python scripts/humo_circulos.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(Path(__file__).resolve().parent))

DSN = os.environ.get("DATABASE_URL", "")
if not DSN:
    sys.exit("Hace falta DATABASE_URL (una base LOCAL y desechable).")
if not any(x in DSN for x in ("127.0.0.1", "localhost", "@db:", "host.docker.internal")):
    sys.exit("Esta prueba escribe y borra: solo corre contra una base local.")

from _asgi_en_proceso import pedir            # noqa: E402
from app.main import create_app               # noqa: E402
from app.routers import circles as router_circulos   # noqa: E402

# Identidad de prueba: la cabecera manda. La prueba de que el token se verifica de verdad
# está en `humo_history_identidad.py`; aquí interesa la lógica de los círculos.
def _identidad_de_prueba(authorization, device_key):  # noqa: ANN001
    from fastapi import HTTPException
    uid = (authorization or "").replace("Bearer ", "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Hace falta iniciar sesión")
    return uid


router_circulos._require_identity = _identidad_de_prueba  # noqa: SLF001
from app.routers import privacy as router_privacidad   # noqa: E402
router_privacidad._require_identity = _identidad_de_prueba  # noqa: SLF001

app = create_app()
ANA = {"Authorization": "Bearer user_ana_prueba"}
BETO = {"Authorization": "Bearer user_beto_prueba"}
CARO = {"Authorization": "Bearer user_caro_prueba"}
INVITADO = {"Authorization": "Bearer dev_0123456789abcdef0123456789abcdef01234567"}

RESULTADOS: list[tuple[bool, str]] = []


def comprobar(nombre: str, obtenido, esperado) -> None:
    ok = obtenido == esperado
    RESULTADOS.append((ok, nombre))
    print(f"  [{'PASA' if ok else 'FALLA'}] {nombre}" + ("" if ok else f"\n          se esperaba {esperado!r} y llegó {obtenido!r}"), flush=True)


def main() -> None:
    print("HUMO — Círculos de cuidado\n")

    st, _ = pedir(app, "GET", "/health")
    comprobar("el servidor dice que los círculos están listos",
              (st, _.get("circles_ready")), (200, True))

    st, r = pedir(app, "POST", "/circles", INVITADO, {"name": "Casa", "kind": "familia", "alias": "Yo"})
    comprobar("sin cuenta no hay círculos: 403 explicado, no un error críptico",
              (st, "cuenta" in str(r.get("detail", "")).lower()), (403, True))

    st, circulo = pedir(app, "POST", "/circles", ANA, {"name": "Casa", "kind": "familia", "alias": "Ana"})
    comprobar("Ana crea el círculo y queda como dueña, con código para invitar",
              (st, circulo.get("role"), len(circulo.get("code", "")), circulo.get("name")),
              (200, "owner", 8, "Casa"))
    cid = circulo["id"]

    st, r = pedir(app, "POST", "/circles/join", BETO, {"code": circulo["code"], "alias": "Beto"})
    comprobar("Beto entra con el código", (st, r.get("id"), r.get("role")), (200, cid, "member"))

    st, r = pedir(app, "POST", "/circles/join", CARO, {"code": "ZZZZZZZZ", "alias": "Caro"})
    comprobar("un código que no existe no revela nada: 404", st, 404)

    st, r = pedir(app, "GET", f"/circles/{cid}/members", ANA)
    miembros = r.get("members", [])
    comprobar("los miembros se ven por su alias y un seudónimo; NUNCA el id de cuenta",
              (st, sorted(m["alias"] for m in miembros), any("user_" in str(m) for m in miembros),
               len({m["pseudonym"] for m in miembros})),
              (200, ["Ana", "Beto"], False, 2))

    st, r = pedir(app, "GET", f"/circles/{cid}/members", CARO)
    comprobar("quien no es miembro no distingue si el círculo existe: 404", st, 404)

    st, prefs = pedir(app, "GET", f"/circles/{cid}/prefs", BETO)
    comprobar("de fábrica solo avisa el riesgo alto, y compartir es por excepción",
              (st, prefs.get("triggers", {}).get("riesgo"), prefs.get("triggers", {}).get("inactividad"),
               prefs.get("share_mode")),
              (200, True, False, "on_trigger"))

    st, prefs = pedir(app, "PUT", f"/circles/{cid}/prefs", BETO,
                      {"triggers": {"riesgo": True, "inactividad": True, "inventado": True}, "share_mode": "always"})
    comprobar("cada quien cambia SUS disparadores; lo inventado se descarta",
              (st, prefs["triggers"], prefs["share_mode"]),
              (200, {"riesgo": True, "inactividad": True}, "always"))

    st, deAna = pedir(app, "GET", f"/circles/{cid}/prefs", ANA)
    comprobar("lo de Beto no toca lo de Ana", deAna.get("share_mode"), "on_trigger")

    st, ev = pedir(app, "POST", f"/circles/{cid}/events", BETO, {"kind": "panico"})
    comprobar("Beto pide ayuda: se abre el evento", (st, ev.get("kind"), ev.get("reused")), (200, "panico", False))
    eid = ev["id"]

    st, ev2 = pedir(app, "POST", f"/circles/{cid}/events", BETO, {"kind": "panico"})
    comprobar("pedir ayuda dos veces no abre dos eventos", (st, ev2.get("id"), ev2.get("reused")), (200, eid, True))

    for lon, lat in ((-78.79, 1.80), (-78.788, 1.801), (-78.786, 1.802)):
        st, _ = pedir(app, "POST", f"/circles/{cid}/events/{eid}/positions", BETO, {"lon": lon, "lat": lat, "acc": 8})
    comprobar("las posiciones entran mientras el evento está abierto", st, 200)

    st, r = pedir(app, "POST", f"/circles/{cid}/events/{eid}/positions", ANA, {"lon": -78.7, "lat": 1.7})
    comprobar("nadie puede mandar posiciones en el evento de otro", st, 409)

    st, r = pedir(app, "GET", f"/circles/{cid}/events", ANA)
    abiertos = r.get("events", [])
    ultima = abiertos[0]["last"] if abiertos else None
    comprobar("Ana ve que Beto pidió ayuda y dónde estaba en su última señal",
              (st, len(abiertos), abiertos[0]["kind"] if abiertos else None,
               round(ultima["lon"], 3) if ultima else None),
              (200, 1, "panico", -78.786))

    st, r = pedir(app, "GET", f"/circles/{cid}/events/{eid}/trail", ANA)
    comprobar("el rastro vivo son las tres posiciones, en orden", (st, len(r.get("trail", []))), (200, 3))

    st, r = pedir(app, "POST", f"/circles/{cid}/events/{eid}/close", BETO)
    comprobar("Beto cierra el evento", (st, r.get("closed")), (200, True))

    st, r = pedir(app, "GET", f"/circles/{cid}/events/{eid}/trail", ANA)
    comprobar("AL CERRAR, EL RASTRO DESAPARECE: no queda historial de por dónde anduvo",
              (st, r.get("trail")), (200, []))

    st, r = pedir(app, "GET", f"/circles/{cid}/events", ANA)
    comprobar("y el círculo deja de ver nada en curso", (st, r.get("events")), (200, []))

    st, r = pedir(app, "POST", f"/circles/{cid}/events/{eid}/positions", BETO, {"lon": -78.7, "lat": 1.7})
    comprobar("con el evento cerrado ya no se aceptan posiciones", st, 409)

    st, r = pedir(app, "DELETE", f"/circles/{cid}/me", BETO)
    comprobar("Beto se sale", (st, r.get("left")), (200, True))
    st, r = pedir(app, "GET", f"/circles/{cid}/members", BETO)
    comprobar("y deja de ver el círculo", st, 404)

    st, r = pedir(app, "GET", "/circles", ANA)
    comprobar("Ana sigue teniendo su círculo, ahora con una sola persona",
              (st, len(r.get("circles", [])), r["circles"][0]["members"]), (200, 1, 1))

    st, r = pedir(app, "DELETE", f"/circles/{cid}/me", ANA)
    st, r = pedir(app, "GET", "/circles", ANA)
    comprobar("al salir la última persona, el círculo se borra entero", (st, r.get("circles")), (200, []))

    # ---- «Borrar mis datos» también alcanza los círculos (Ley 1581: derecho de supresión)
    st, otro = pedir(app, "POST", "/circles", ANA, {"name": "Trabajo", "kind": "trabajo", "alias": "Ana"})
    cid2 = otro["id"]
    pedir(app, "POST", "/circles/join", CARO, {"code": otro["code"], "alias": "Caro"})
    st, ev = pedir(app, "POST", f"/circles/{cid2}/events", CARO, {"kind": "riesgo"})
    pedir(app, "POST", f"/circles/{cid2}/events/{ev['id']}/positions", CARO, {"lon": -78.78, "lat": 1.81})
    st, r = pedir(app, "DELETE", "/me/data", CARO)
    comprobar("«Borrar mis datos» saca a Caro de sus círculos y lo dice en la respuesta",
              (st, r.get("ok"), (r.get("deleted") or {}).get("circles")), (200, True, 1))
    st, r = pedir(app, "GET", f"/circles/{cid2}/members", ANA)
    comprobar("Caro ya no aparece entre los miembros", [m["alias"] for m in r.get("members", [])], ["Ana"])
    st, r = pedir(app, "GET", f"/circles/{cid2}/events", ANA)
    comprobar("y su evento abierto, con su rastro, desapareció", r.get("events"), [])
    st, r = pedir(app, "DELETE", "/me/data", CARO)
    comprobar("repetir el borrado es seguro", (st, (r.get("deleted") or {}).get("circles")), (200, 0))
    pedir(app, "DELETE", f"/circles/{cid2}/me", ANA)

    fallos = sum(1 for ok, _ in RESULTADOS if not ok)
    print(f"\n{len(RESULTADOS) - fallos}/{len(RESULTADOS)} pasan")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
