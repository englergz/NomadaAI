"""Reportes ciudadanos de incidentes persistidos en Postgres (Supabase).

Cimiento del "tiempo real" participativo (OE2): el usuario reporta tipo/ubicación/hora y el
dato alimenta la calibración del modelo. Principios aplicados desde ya:

- **Anti-abuso:** rate-limit por usuario en servidor (máx. 5 reportes/hora).
- **Privacidad (Ley 1581/2012):** se guarda el identificador del usuario solo para moderación
  y deduplicación; los reportes NUNCA se exponen crudos — solo agregados al modelo.
- **Degradación elegante:** sin `DATABASE_URL` responde `accepted=False` sin romper la app.
"""
from __future__ import annotations

from typing import Any, Optional

from app.core.config import get_settings

_DDL = """
create table if not exists incidents (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  city        text not null default 'tumaco',
  user_id     text not null default 'anon',
  category    text not null,
  description text,
  lon         double precision not null,
  lat         double precision not null,
  hour        int
);
create index if not exists incidents_city_idx    on incidents (city);
create index if not exists incidents_created_idx on incidents (created_at);
create index if not exists incidents_user_idx    on incidents (user_id, created_at);
"""

_MAX_PER_HOUR = 5

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


def report(rec: dict[str, Any]) -> dict[str, Any]:
    """Inserta un reporte ciudadano. Devuelve {accepted, id?, note?}."""
    if not available():
        return {"accepted": False, "note": "Sin base de datos configurada (DATABASE_URL)."}
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            # Rate-limit por usuario: máx. _MAX_PER_HOUR reportes en la última hora.
            cur.execute(
                "select count(*) from incidents where user_id=%s and created_at > now() - interval '1 hour'",
                (rec.get("user_id", "anon"),),
            )
            n = int(cur.fetchone()[0])
            if n >= _MAX_PER_HOUR:
                return {"accepted": False, "note": "Límite de reportes por hora alcanzado. Intenta más tarde."}
            cur.execute(
                """
                insert into incidents (city, user_id, category, description, lon, lat, hour)
                values (%(city)s, %(user_id)s, %(category)s, %(description)s, %(lon)s, %(lat)s, %(hour)s)
                returning id
                """,
                rec,
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    return {"accepted": True, "id": str(new_id)}


# --- F_report(z,t): agregación ANÓNIMA por celda con decaimiento (MODELO_RIESGO.md §6) ---
# Nunca expone reportes crudos: solo conteos ponderados por celda aproximada (~110 m).
def aggregate(city: str = "tumaco", half_life_days: float = 30.0) -> dict[str, Any]:
    if not available():
        return {"available": False, "cells": []}
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select round(lon::numeric, 3), round(lat::numeric, 3),
                       sum(exp(-ln(2) * extract(epoch from now() - created_at) / (86400 * %s))),
                       count(*)
                from incidents where city = %s
                group by 1, 2
                """,
                (half_life_days, city),
            )
            cells = [
                {"lon": float(r[0]), "lat": float(r[1]), "peso": round(float(r[2]), 4), "n": int(r[3])}
                for r in cur.fetchall()
            ]
    return {"available": True, "half_life_days": half_life_days, "cells": cells}


# --- Moderación (panel admin, U6): SOLO tras verificación de rol en servidor. ---
def list_recent(city: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Reportes recientes para moderación (incluye user_id: uso interno admin)."""
    if not available():
        return []
    _ensure()
    limit = max(1, min(int(limit), 500))
    q = (
        "select id, created_at, city, user_id, category, description, lon, lat, hour "
        "from incidents {} order by created_at desc limit %s"
    )
    with _connect() as conn, conn.cursor() as cur:
        if city:
            cur.execute(q.format("where city = %s"), (city, limit))
        else:
            cur.execute(q.format(""), (limit,))
        rows = cur.fetchall()
    return [
        {
            "id": int(r[0]), "created_at": r[1].isoformat(), "city": r[2], "user_id": r[3],
            "category": r[4], "description": r[5], "lon": float(r[6]), "lat": float(r[7]),
            "hour": r[8],
        }
        for r in rows
    ]


def delete(incident_id: int) -> bool:
    """Elimina un reporte (moderación). True si existía."""
    if not available():
        return False
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from incidents where id = %s returning id", (incident_id,))
            gone = cur.fetchone() is not None
        conn.commit()
    return gone
