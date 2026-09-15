"""Petición HTTP a una app ASGI dentro del mismo proceso: sin servidor, sin red y sin httpx.

Módulo auxiliar de las pruebas de humo de esta carpeta; no se ejecuta solo.
"""
from __future__ import annotations

import asyncio
import json


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
