"""Configuración de producto editable desde el panel admin (U6).

Un solo documento JSON versionado en Postgres (tabla app_config). Lo leen las
apps (móvil/escritorio) vía GET /config/app y lo edita el admin vía PUT
/admin/config/app. Sin DATABASE_URL se responde el DEFAULT (la app nunca rompe).

Claves actuales:
- protection_levels: topes de la barra de protección en % (2..7 valores, 0..100,
  ascendentes; el % se mapea a λ = pct/20 en el ruteo). Default 5 topes.
- ads_enabled: publicidad sutil on/off (U7-BIZ; apagada hasta tener tiendas).
"""
from __future__ import annotations

import json
from typing import Any

from app.core.config import get_settings

DEFAULT_CONFIG: dict[str, Any] = {
    "protection_levels": [0, 25, 50, 75, 100],
    "ads_enabled": False,
}

_DDL = """
create table if not exists app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
"""

_ready = False


def _dsn() -> str | None:
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


def get_config() -> dict[str, Any]:
    """Config vigente (DEFAULT si no hay DB o aún no se ha editado)."""
    if not available():
        return dict(DEFAULT_CONFIG)
    try:
        _ensure()
        with _connect() as conn, conn.cursor() as cur:
            cur.execute("select value from app_config where key = 'app'")
            row = cur.fetchone()
        merged = dict(DEFAULT_CONFIG)
        if row:
            merged.update(row[0] if isinstance(row[0], dict) else json.loads(row[0]))
        return merged
    except Exception:  # noqa: BLE001 — la lectura de config jamás tumba la app
        return dict(DEFAULT_CONFIG)


def validate(cfg: dict[str, Any]) -> str | None:
    """Devuelve un mensaje de error o None si la config es válida."""
    levels = cfg.get("protection_levels")
    if levels is not None:
        if (
            not isinstance(levels, list)
            or not (2 <= len(levels) <= 7)
            or any(not isinstance(v, (int, float)) for v in levels)
            or any(not (0 <= v <= 100) for v in levels)
            or any(levels[i] >= levels[i + 1] for i in range(len(levels) - 1))
        ):
            return "protection_levels debe ser una lista ascendente de 2 a 7 valores entre 0 y 100"
    if "ads_enabled" in cfg and not isinstance(cfg["ads_enabled"], bool):
        return "ads_enabled debe ser booleano"
    return None


def set_config(cfg: dict[str, Any], updated_by: str) -> dict[str, Any]:
    """Guarda (merge sobre lo vigente) y devuelve la config resultante."""
    _ensure()
    merged = get_config()
    merged.update({k: v for k, v in cfg.items() if k in DEFAULT_CONFIG})
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into app_config (key, value, updated_by) values ('app', %s, %s)
                on conflict (key) do update
                  set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by
                """,
                (json.dumps(merged), updated_by),
            )
        conn.commit()
    return merged
