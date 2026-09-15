"""Opiniones de los usuarios (formulario de Configuración → Privacidad y opinión).

Por qué existe: el formulario abría el correo del usuario con las respuestas redactadas.
Funcionaba, pero (1) si el teléfono no tiene correo configurado la opinión se pierde,
(2) depende de que el usuario complete el envío en otra app, y (3) llegaba como correos
sueltos: nada se guardaba, nada se podía contar, nada aparecía en el panel admin.

Mismo contrato que `incidents.py`, deliberadamente:
- **Anti-abuso:** rate-limit por identidad en servidor (máx. 3 opiniones/hora).
- **Privacidad (Ley 1581/2012):** se guarda el identificador solo para deduplicar y
  moderar. Hacia fuera solo se exponen AGREGADOS (promedios, conteos); los comentarios
  individuales únicamente tras verificar rol admin en servidor.
- **Degradación elegante:** sin `DATABASE_URL` responde `accepted=False` sin romper la
  app, y el cliente cae al correo como antes.
"""
from __future__ import annotations

from typing import Any, Optional

from app.core.config import get_settings
from app.core.identity import ANON, DEVICE_ID_PREFIX, is_legacy_device_id, pseudonym

_DDL = """
create table if not exists feedback (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  city        text not null default 'tumaco',
  user_id     text not null default 'anon',
  useful      smallint not null check (useful between 1 and 5),
  on_time     smallint not null check (on_time between 1 and 5),
  trust       smallint not null check (trust between 1 and 5),
  recommend   smallint not null check (recommend between 1 and 5),
  comment     text,
  platform    text
);
create index if not exists feedback_created_idx on feedback (created_at);
create index if not exists feedback_user_idx    on feedback (user_id, created_at);
"""

_MAX_PER_HOUR = 3
_PREGUNTAS = ("useful", "on_time", "trust", "recommend")

_ready = False


def _dsn() -> Optional[str]:
    return get_settings().database_url


def available() -> bool:
    return bool(_dsn())


def _connect():
    import psycopg  # import perezoso: la app arranca aunque no esté la credencial

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


def submit(rec: dict[str, Any]) -> dict[str, Any]:
    """Guarda una opinión. Devuelve {accepted, id?, note?}."""
    if not available():
        return {"accepted": False, "note": "Sin base de datos configurada (DATABASE_URL)."}
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select count(*) from feedback where user_id=%s and created_at > now() - interval '1 hour'",
                (rec.get("user_id", "anon"),),
            )
            if int(cur.fetchone()[0]) >= _MAX_PER_HOUR:
                return {"accepted": False, "note": "Ya recibimos tu opinión hace poco. Gracias."}
            cur.execute(
                """
                insert into feedback (city, user_id, useful, on_time, trust, recommend, comment, platform)
                values (%(city)s, %(user_id)s, %(useful)s, %(on_time)s, %(trust)s, %(recommend)s,
                        %(comment)s, %(platform)s)
                returning id
                """,
                rec,
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    return {"accepted": True, "id": str(new_id)}


def summary() -> dict[str, Any]:
    """Agregados para el panel: promedios por pregunta y conteos. Nunca filas crudas."""
    if not available():
        return {"available": False, "total": 0}
    _ensure()
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select count(*),
                   avg(useful), avg(on_time), avg(trust), avg(recommend),
                   count(*) filter (where comment is not null and length(trim(comment)) > 0),
                   count(*) filter (where created_at > now() - interval '30 days')
            from feedback
            """
        )
        r = cur.fetchone()
        cur.execute("select platform, count(*) from feedback group by platform")
        por_plat = {(p or "?"): int(n) for (p, n) in cur.fetchall()}
    total = int(r[0])
    prom = {k: (round(float(v), 2) if v is not None else None) for k, v in zip(_PREGUNTAS, r[1:5])}
    return {
        "available": True, "total": total, "promedios": prom,
        "con_comentario": int(r[5]), "ultimos_30_dias": int(r[6]), "por_plataforma": por_plat,
    }


def list_recent(limit: int = 100) -> list[dict[str, Any]]:
    """Opiniones recientes (moderación). El autor llega como seudónimo, nunca su identificador."""
    if not available():
        return []
    _ensure()
    limit = max(1, min(int(limit), 500))
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select id, created_at, city, user_id, useful, on_time, trust, recommend, comment, platform
            from feedback order by created_at desc limit %s
            """,
            (limit,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": int(r[0]), "created_at": r[1].isoformat(), "city": r[2], "autor": pseudonym(r[3]),
            "useful": r[4], "on_time": r[5], "trust": r[6], "recommend": r[7],
            "comment": r[8], "platform": r[9],
        }
        for r in rows
    ]


# --- Derecho de supresión (routers/privacy.py) y reclamo del uid anterior (routers/history.py) ---
def unlink_user(user_id: str) -> int:
    """Desvincula de una identidad TODAS sus opiniones. Devuelve cuántas.

    No se borran: la app pide la opinión justo antes de borrar los datos, para aprender de quien se
    va. Pasan a `anon` y se conservan sin nada que las ate a la persona. Sin identidad, o con
    `anon`, no se hace nada.
    """
    if not user_id or user_id == ANON:
        raise ValueError("unlink_user exige una identidad: no hay desvinculación sin ella")
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update feedback set user_id = %(anon)s where user_id = %(uid)s",
                {"anon": ANON, "uid": user_id},
            )
            n = cur.rowcount
        conn.commit()
    return n


def claim(legacy_id: str, user_id: str) -> int:
    """Pasa a la llave del dispositivo las opiniones firmadas con su uid anterior. Devuelve cuántas."""
    if not is_legacy_device_id(legacy_id) or not str(user_id).startswith(DEVICE_ID_PREFIX):
        raise ValueError("claim solo pasa filas de un uid de dispositivo a una llave")
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update feedback set user_id = %(new)s where user_id = %(old)s",
                {"new": user_id, "old": legacy_id},
            )
            n = cur.rowcount
        conn.commit()
    return n
