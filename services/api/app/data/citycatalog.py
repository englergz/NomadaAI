"""CATÁLOGO DE CIUDADES editable desde el panel admin.

Por qué existe: hasta ahora la lista de ciudades que la app puede ENCONTRAR vivía
en el código del cliente (`constants/map.ts`), así que añadir una exigía publicar
versión de la app. El catálogo la mueve a Postgres y la sirve en `/cities/catalog`,
de modo que dar de alta una ciudad es un formulario, no un despliegue.

Qué NO hace, y conviene tenerlo claro: estar en el catálogo **no da cobertura**.
La cobertura la siguen decidiendo los artefactos del servidor —capa de riesgo, red
vial y modelo de predicción— y se consulta en `/risk/cities` y `/route/cities`. Una
ciudad recién dada de alta aparece en el selector como «no disponible» hasta que
sus artefactos existan. Es deliberado: el catálogo es dónde puede mirar el usuario,
no una promesa de que allí protegemos.

Sin `DATABASE_URL` el catálogo queda vacío y los clientes usan su lista integrada.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from app.core.config import get_settings

_DDL = """
create table if not exists city_catalog (
  key        text primary key,
  label      text not null,
  country    text not null,
  lon        double precision not null,
  lat        double precision not null,
  zoom       smallint not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
"""

_KEY_RE = re.compile(r"^[a-z][a-z0-9-]{1,31}$")
_COUNTRY_RE = re.compile(r"^[A-Z]{2}$")

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


def validate(city: dict[str, Any]) -> str | None:
    """Mensaje de error, o None si la ciudad es válida."""
    key = str(city.get("key", "")).strip().lower()
    if not _KEY_RE.match(key):
        return "La clave debe ser minúsculas, empezar por letra y usar solo letras, números o guion (2 a 32)."
    if not str(city.get("label", "")).strip():
        return "El nombre visible no puede estar vacío."
    if not _COUNTRY_RE.match(str(city.get("country", "")).strip()):
        return "El país debe ser el código ISO de dos letras mayúsculas (CO, EC, PE…)."
    try:
        lon = float(city["lon"])
        lat = float(city["lat"])
        zoom = int(city.get("zoom", 12))
    except (KeyError, TypeError, ValueError):
        return "Longitud, latitud y zoom deben ser números."
    if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
        return "Coordenadas fuera de rango (lon -180..180, lat -90..90)."
    if not (3 <= zoom <= 18):
        return "El zoom debe estar entre 3 y 18."
    return None


def list_all() -> list[dict[str, Any]]:
    """Catálogo completo. Lista vacía si no hay DB: el cliente usa su lista integrada."""
    if not available():
        return []
    try:
        _ensure()
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(
                "select key, label, country, lon, lat, zoom from city_catalog order by country, label"
            )
            rows = cur.fetchall()
        return [
            {"key": r[0], "label": r[1], "country": r[2], "center": [r[3], r[4]], "zoom": r[5]}
            for r in rows
        ]
    except Exception:  # noqa: BLE001 — el catálogo nunca tumba el arranque de la app
        return []


def upsert(city: dict[str, Any], updated_by: str) -> dict[str, Any]:
    """Da de alta o actualiza una ciudad. La clave es el identificador estable."""
    _ensure()
    key = str(city["key"]).strip().lower()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into city_catalog (key, label, country, lon, lat, zoom, updated_by)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (key) do update set
                  label = excluded.label, country = excluded.country,
                  lon = excluded.lon, lat = excluded.lat, zoom = excluded.zoom,
                  updated_at = now(), updated_by = excluded.updated_by
                """,
                (
                    key,
                    str(city["label"]).strip(),
                    str(city["country"]).strip().upper(),
                    float(city["lon"]),
                    float(city["lat"]),
                    int(city.get("zoom", 12)),
                    updated_by,
                ),
            )
        conn.commit()
    return {
        "key": key,
        "label": str(city["label"]).strip(),
        "country": str(city["country"]).strip().upper(),
        "center": [float(city["lon"]), float(city["lat"])],
        "zoom": int(city.get("zoom", 12)),
    }


def delete(key: str) -> bool:
    """Quita una ciudad del catálogo. No toca artefactos: solo deja de listarse."""
    _ensure()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from city_catalog where key = %s", (key.strip().lower(),))
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted
