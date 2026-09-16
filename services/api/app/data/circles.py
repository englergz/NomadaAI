"""CÍRCULOS: grupos privados de cuidado, con ubicación **por excepción**.

Regla rectora, y también lo que exige la Ley 1581 (minimización): por defecto NADIE comparte
ubicación. Un círculo solo recibe posiciones mientras hay un **evento abierto** —riesgo alto,
precaución, inactividad, pánico o desvío— y al cerrarlo esas posiciones **se borran**. No se construye
historial de por dónde anduvo nadie: `circle_positions` es un buffer vivo, no un archivo.

Otras decisiones que importan:

- **Solo cuentas.** Un círculo es una relación entre personas y debe sobrevivir al cambio de
  teléfono; la llave de dispositivo del modo invitado no identifica a una persona. Quien no ha
  iniciado sesión no puede crear ni unirse (el router lo traduce a un 403 explicado).
- **Nombre que se elige.** Cada quien decide con qué nombre aparece en cada círculo (`alias`).
  No se copian nombre ni correo de la cuenta: el servidor no los necesita y no los guarda.
- **El identificador de cuenta no se publica.** Hacia fuera cada miembro es su alias y un
  seudónimo corto, estable dentro del círculo y distinto en otro, como en el panel de reportes.
- **Unirse es por código**, no buscando personas: no hay directorio de usuarios que espiar.

Sin `DATABASE_URL` el módulo responde `available() == False` y la app muestra Círculos como no
disponible, igual que el resto de funciones que dependen de la base.
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
from typing import Any, Optional

from app.core.config import get_settings

# Alfabeto sin caracteres que se confunden al dictar un código en voz alta (0/O, 1/I/L).
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_LARGO_CODIGO = 8
_CODIGO_RE = re.compile(rf"^[{_ALFABETO}]{{{_LARGO_CODIGO}}}$")

#: Tipos de evento que abren el paso de la ubicación. Los decide el diseño, no el cliente.
CLASES_EVENTO = ("riesgo", "precaucion", "inactividad", "panico", "desvio")
#: Cómo comparte cada persona EN CADA círculo. El valor inicial nunca es «siempre».
MODOS = ("never", "on_trigger", "always")
#: Un evento no puede quedar abierto para siempre: tope duro, aunque el teléfono se apague.
MAX_EVENTO_HORAS = 6
#: Tope de posiciones que se devuelven de un evento (lo vivo, no el rastro completo).
MAX_POSICIONES = 200
#: Sólo las cuentas tienen círculos (ver cabecera).
PREFIJO_CUENTA = "user_"

_DDL = """
create table if not exists circles (
  id         bigserial primary key,
  code       text not null unique,
  name       text not null,
  kind       text not null default 'familia',
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists circle_members (
  circle_id bigint not null references circles(id) on delete cascade,
  user_id   text not null,
  alias     text not null,
  role      text not null default 'member',
  joined_at timestamptz not null default now(),
  muted     boolean not null default false,
  primary key (circle_id, user_id)
);

create table if not exists circle_prefs (
  circle_id  bigint not null references circles(id) on delete cascade,
  user_id    text not null,
  triggers   jsonb not null default '{}'::jsonb,
  share_mode text not null default 'on_trigger',
  updated_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists circle_events (
  id          bigserial primary key,
  circle_id   bigint not null references circles(id) on delete cascade,
  user_id     text not null,
  kind        text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  resolved_by text
);

create table if not exists circle_positions (
  event_id bigint not null references circle_events(id) on delete cascade,
  user_id  text not null,
  lon      double precision not null,
  lat      double precision not null,
  acc      double precision,
  t        timestamptz not null default now()
);

create index if not exists circle_events_abiertos on circle_events (circle_id, ended_at);
create index if not exists circle_positions_evento on circle_positions (event_id, t desc);
"""

_ready = False


def _dsn() -> Optional[str]:
    return get_settings().database_url


def available() -> bool:
    return bool(_dsn())


def _connect():
    import psycopg  # perezoso: la app arranca aunque falte la credencial

    return psycopg.connect(_dsn(), connect_timeout=6)


def _ensure() -> None:
    global _ready
    if _ready:
        return
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(_DDL)
        conn.commit()
    _ready = True


def es_cuenta(uid: str) -> bool:
    """¿Es una identidad de cuenta? El modo invitado no puede tener círculos."""
    return isinstance(uid, str) and uid.startswith(PREFIJO_CUENTA)


def seudonimo(circle_id: int, uid: str) -> str:
    """Nombre corto y estable DENTRO de un círculo; en otro círculo es distinto.

    Así el panel de un círculo puede distinguir a dos miembros sin publicar su identificador
    de cuenta, y cruzar dos círculos no revela que se trata de la misma persona.
    """
    semilla = f"nomadaai/circle/{circle_id}:{uid}".encode("utf-8")
    return hashlib.sha256(semilla).hexdigest()[:10]


def _codigo_nuevo() -> str:
    return "".join(secrets.choice(_ALFABETO) for _ in range(_LARGO_CODIGO))


def codigo_valido(codigo: object) -> bool:
    return isinstance(codigo, str) and _CODIGO_RE.fullmatch(codigo.strip().upper()) is not None


def _alias_limpio(alias: object, por_defecto: str = "Alguien") -> str:
    texto = (alias or "").strip() if isinstance(alias, str) else ""
    return texto[:40] or por_defecto


# ------------------------------------------------------------------ círculos y miembros


def crear(uid: str, nombre: str, clase: str, alias: str) -> dict[str, Any]:
    """Crea el círculo y mete a quien lo crea como dueño. Devuelve el círculo con su código."""
    _ensure()
    nombre_limpio = _alias_limpio(nombre, "Mi círculo")
    clase_limpia = _alias_limpio(clase, "familia")[:20]
    with _connect() as conn:
        with conn.cursor() as cur:
            # El código es aleatorio: si choca con uno existente, se reintenta.
            for _ in range(5):
                codigo = _codigo_nuevo()
                cur.execute(
                    "insert into circles (code, name, kind, created_by) values (%s, %s, %s, %s) "
                    "on conflict (code) do nothing returning id",
                    (codigo, nombre_limpio, clase_limpia, uid),
                )
                fila = cur.fetchone()
                if fila:
                    circle_id = int(fila[0])
                    break
            else:  # pragma: no cover — cinco colisiones seguidas es imposible en la práctica
                raise RuntimeError("No se pudo generar un código de círculo")
            cur.execute(
                "insert into circle_members (circle_id, user_id, alias, role) values (%s, %s, %s, 'owner')",
                (circle_id, uid, _alias_limpio(alias)),
            )
            cur.execute(
                "insert into circle_prefs (circle_id, user_id, triggers, share_mode) "
                "values (%s, %s, %s::jsonb, 'on_trigger')",
                (circle_id, uid, json.dumps(DISPARADORES_POR_DEFECTO)),
            )
        conn.commit()
    return {"id": circle_id, "code": codigo, "name": nombre_limpio, "kind": clase_limpia, "role": "owner"}


#: Lo que viene activado de fábrica: solo el riesgo alto. Todo lo demás lo enciende la persona.
DISPARADORES_POR_DEFECTO = {"riesgo": True, "precaucion": False, "inactividad": False, "desvio": False}


def unirse(uid: str, codigo: str, alias: str) -> Optional[dict[str, Any]]:
    """Mete a alguien en el círculo del código. `None` si el código no existe."""
    _ensure()
    codigo = codigo.strip().upper()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("select id, name, kind from circles where code = %s", (codigo,))
            fila = cur.fetchone()
            if not fila:
                return None
            circle_id, nombre, clase = int(fila[0]), fila[1], fila[2]
            cur.execute(
                "insert into circle_members (circle_id, user_id, alias) values (%s, %s, %s) "
                "on conflict (circle_id, user_id) do update set alias = excluded.alias",
                (circle_id, uid, _alias_limpio(alias)),
            )
            cur.execute(
                "insert into circle_prefs (circle_id, user_id, triggers, share_mode) "
                "values (%s, %s, %s::jsonb, 'on_trigger') on conflict (circle_id, user_id) do nothing",
                (circle_id, uid, json.dumps(DISPARADORES_POR_DEFECTO)),
            )
        conn.commit()
    return {"id": circle_id, "code": codigo, "name": nombre, "kind": clase, "role": "member"}


def salir(uid: str, circle_id: int) -> bool:
    """Sale del círculo. Si era la última persona, el círculo se borra entero."""
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from circle_members where circle_id = %s and user_id = %s", (circle_id, uid))
            salio = cur.rowcount > 0
            cur.execute("delete from circle_prefs where circle_id = %s and user_id = %s", (circle_id, uid))
            # Eventos propios abiertos: se cierran y sus posiciones desaparecen con ellos.
            cur.execute(
                "delete from circle_events where circle_id = %s and user_id = %s and ended_at is null",
                (circle_id, uid),
            )
            cur.execute("select count(*) from circle_members where circle_id = %s", (circle_id,))
            if int(cur.fetchone()[0]) == 0:
                cur.execute("delete from circles where id = %s", (circle_id,))
        conn.commit()
    return salio


def borrar_de(uid: str) -> int:
    """«Borrar mis datos»: fuera de todos sus círculos, con sus eventos, rastros y disparadores.

    Los círculos que se quedan sin nadie se borran enteros. Devuelve de cuántos círculos salió.
    Es idempotente: repetirlo tras un fallo a medias termina el trabajo.
    """
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            # Las posiciones caen con sus eventos (on delete cascade).
            cur.execute("delete from circle_events where user_id = %s", (uid,))
            cur.execute("delete from circle_prefs where user_id = %s", (uid,))
            cur.execute("delete from circle_members where user_id = %s", (uid,))
            salidas = cur.rowcount
            cur.execute(
                "delete from circles c where not exists (select 1 from circle_members m where m.circle_id = c.id)"
            )
        conn.commit()
    return salidas


def es_miembro(circle_id: int, uid: str) -> bool:
    _ensure()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute("select 1 from circle_members where circle_id = %s and user_id = %s", (circle_id, uid))
        return cur.fetchone() is not None


def mios(uid: str) -> list[dict[str, Any]]:
    """Círculos de una persona, con cuánta gente hay y cuántos eventos abiertos."""
    _ensure()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select c.id, c.code, c.name, c.kind, m.role, m.alias,
                   (select count(*) from circle_members mm where mm.circle_id = c.id),
                   (select count(*) from circle_events e where e.circle_id = c.id and e.ended_at is null)
              from circles c
              join circle_members m on m.circle_id = c.id
             where m.user_id = %s
             order by c.created_at
            """,
            (uid,),
        )
        return [
            {
                "id": int(r[0]), "code": r[1], "name": r[2], "kind": r[3], "role": r[4], "alias": r[5],
                "members": int(r[6]), "open_events": int(r[7]),
            }
            for r in cur.fetchall()
        ]


def miembros(circle_id: int) -> list[dict[str, Any]]:
    """Quiénes están, con su alias y su seudónimo. NUNCA el identificador de cuenta."""
    _ensure()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select user_id, alias, role, joined_at from circle_members where circle_id = %s order by joined_at",
            (circle_id,),
        )
        return [
            {
                "alias": r[1], "role": r[2], "joined_at": r[3].isoformat(),
                "pseudonym": seudonimo(circle_id, r[0]),
            }
            for r in cur.fetchall()
        ]


# ------------------------------------------------------------------ preferencias por persona


def preferencias(circle_id: int, uid: str) -> dict[str, Any]:
    _ensure()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select triggers, share_mode from circle_prefs where circle_id = %s and user_id = %s",
            (circle_id, uid),
        )
        fila = cur.fetchone()
    if not fila:
        return {"triggers": dict(DISPARADORES_POR_DEFECTO), "share_mode": "on_trigger"}
    disparadores = fila[0] if isinstance(fila[0], dict) else json.loads(fila[0] or "{}")
    return {"triggers": disparadores, "share_mode": fila[1]}


def guardar_preferencias(circle_id: int, uid: str, disparadores: dict[str, bool], modo: str) -> dict[str, Any]:
    """Los disparadores son de la PERSONA en ese círculo; nadie más puede cambiárselos."""
    _ensure()
    if modo not in MODOS:
        modo = "on_trigger"
    limpios = {k: bool(v) for k, v in (disparadores or {}).items() if k in DISPARADORES_POR_DEFECTO}
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "insert into circle_prefs (circle_id, user_id, triggers, share_mode, updated_at) "
                "values (%s, %s, %s::jsonb, %s, now()) "
                "on conflict (circle_id, user_id) do update set triggers = excluded.triggers, "
                "share_mode = excluded.share_mode, updated_at = now()",
                (circle_id, uid, json.dumps(limpios), modo),
            )
        conn.commit()
    return {"triggers": limpios, "share_mode": modo}


# ------------------------------------------------------------------ eventos y posiciones


def abrir_evento(circle_id: int, uid: str, clase: str) -> dict[str, Any]:
    """Abre (o reutiliza) el evento por el que esta persona comparte ubicación ahora."""
    _ensure()
    if clase not in CLASES_EVENTO:
        clase = "panico"
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select id, kind, started_at from circle_events "
                "where circle_id = %s and user_id = %s and ended_at is null "
                "  and started_at > now() - (%s * interval '1 hour') order by started_at desc limit 1",
                (circle_id, uid, MAX_EVENTO_HORAS),
            )
            fila = cur.fetchone()
            if fila:
                return {"id": int(fila[0]), "kind": fila[1], "started_at": fila[2].isoformat(), "reused": True}
            cur.execute(
                "insert into circle_events (circle_id, user_id, kind) values (%s, %s, %s) "
                "returning id, started_at",
                (circle_id, uid, clase),
            )
            nuevo = cur.fetchone()
        conn.commit()
    return {"id": int(nuevo[0]), "kind": clase, "started_at": nuevo[1].isoformat(), "reused": False}


def cerrar_evento(event_id: int, uid: str) -> bool:
    """Cierra el evento y BORRA sus posiciones: el cuidado se acaba, el rastro también."""
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update circle_events set ended_at = now(), resolved_by = %s "
                "where id = %s and ended_at is null returning circle_id",
                (uid, event_id),
            )
            cerrado = cur.fetchone() is not None
            cur.execute("delete from circle_positions where event_id = %s", (event_id,))
        conn.commit()
    return cerrado


def anotar_posicion(event_id: int, uid: str, lon: float, lat: float, acc: Optional[float]) -> bool:
    """Guarda una posición SOLO si el evento sigue abierto y es de quien la manda."""
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select 1 from circle_events where id = %s and user_id = %s and ended_at is null",
                (event_id, uid),
            )
            if cur.fetchone() is None:
                return False
            cur.execute(
                "insert into circle_positions (event_id, user_id, lon, lat, acc) values (%s, %s, %s, %s, %s)",
                (event_id, uid, float(lon), float(lat), None if acc is None else float(acc)),
            )
        conn.commit()
    return True


def eventos_abiertos(circle_id: int) -> list[dict[str, Any]]:
    """Lo que el círculo puede ver ahora mismo: quién pidió ayuda y su última posición."""
    _ensure()
    _purgar()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select e.id, e.user_id, e.kind, e.started_at,
                   p.lon, p.lat, p.acc, p.t
              from circle_events e
              left join lateral (
                    select lon, lat, acc, t from circle_positions
                     where event_id = e.id order by t desc limit 1
              ) p on true
             where e.circle_id = %s and e.ended_at is null
             order by e.started_at
            """,
            (circle_id,),
        )
        salida = []
        for r in cur.fetchall():
            ultima = None
            if r[4] is not None:
                ultima = {"lon": float(r[4]), "lat": float(r[5]),
                          "acc": None if r[6] is None else float(r[6]), "t": r[7].isoformat()}
            salida.append({
                "id": int(r[0]), "pseudonym": seudonimo(circle_id, r[1]), "kind": r[2],
                "started_at": r[3].isoformat(), "last": ultima,
            })
        return salida


def rastro(event_id: int) -> list[dict[str, Any]]:
    """Posiciones vivas de un evento (para dibujar hacia dónde va quien pidió ayuda)."""
    _ensure()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            "select lon, lat, acc, t from circle_positions where event_id = %s order by t desc limit %s",
            (event_id, MAX_POSICIONES),
        )
        filas = cur.fetchall()
    return [
        {"lon": float(r[0]), "lat": float(r[1]), "acc": None if r[2] is None else float(r[2]), "t": r[3].isoformat()}
        for r in reversed(filas)
    ]


def _purgar() -> None:
    """Higiene: cierra eventos olvidados y borra posiciones que ya no sostiene ningún evento.

    Un teléfono que se queda sin batería con un evento abierto no puede dejar la ubicación
    fluyendo para siempre: pasadas las horas del tope, el evento se cierra solo y su rastro
    desaparece.
    """
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update circle_events set ended_at = now() "
                "where ended_at is null and started_at < now() - (%s * interval '1 hour')",
                (MAX_EVENTO_HORAS,),
            )
            cur.execute(
                "delete from circle_positions p using circle_events e "
                "where p.event_id = e.id and e.ended_at is not null"
            )
        conn.commit()
