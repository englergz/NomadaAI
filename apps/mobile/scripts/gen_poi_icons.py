#!/usr/bin/env python3
"""Genera los PNG de los iconos de Lugares (POI) para el mapa NATIVO.

Por qué existe: en web los iconos se rasterizan en un canvas al vuelo (glyph de
MaterialCommunityIcons con halo blanco). En Android/iOS MapLibre Native no tiene
canvas: las imágenes de una capa `symbol` deben registrarse con `<Images/>` desde
assets. Este script produce esos assets a partir de LA MISMA definición que usa la
web (`POI_ICON_DEFS` en risk-map.types.ts), para que no haya dos fuentes de verdad.

Uso:  python3 scripts/gen_poi_icons.py      (desde apps/mobile)
Salida: assets/images/poi/<categoria-sin-tilde>.png  (112 px = 56 pt @2x)
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TYPES = ROOT / "src" / "components" / "risk-map.types.ts"
VI = ROOT / "node_modules" / "@expo" / "vector-icons" / "build" / "vendor" / "react-native-vector-icons"
FONT = VI / "Fonts" / "MaterialCommunityIcons.ttf"
GLYPHS = VI / "glyphmaps" / "MaterialCommunityIcons.json"
OUT = ROOT / "assets" / "images" / "poi"

SIZE = 112          # 56 pt @2x (misma escala que `pixelRatio: 2` en web)
FONT_PX = 88        # 44 px @2x
HALO = 9            # 4.5 px @2x


def slug(s: str) -> str:
    """'educación' → 'educacion': el nombre de imagen y del fichero no llevan tildes."""
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def parse_defs() -> dict[str, tuple[str, str]]:
    src = TYPES.read_text(encoding="utf-8")
    block = re.search(r"POI_ICON_DEFS[^{]*\{(.*?)\n\};", src, re.S)
    if not block:
        raise SystemExit("No encuentro POI_ICON_DEFS en risk-map.types.ts")
    defs = {}
    for m in re.finditer(r"(\w+|[^\s:]+):\s*\{\s*glyph:\s*'([^']+)',\s*color:\s*'(#[0-9a-fA-F]{6})'", block.group(1)):
        defs[m.group(1)] = (m.group(2), m.group(3))
    return defs


def main() -> None:
    defs = parse_defs()
    glyphs = json.loads(GLYPHS.read_text(encoding="utf-8"))
    font = ImageFont.truetype(str(FONT), FONT_PX)
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (glyph, color) in defs.items():
        code = glyphs.get(glyph) or glyphs["map-marker"]
        ch = chr(code)
        img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # anchor "mm" = centrado horizontal y vertical, como textAlign/textBaseline en web
        d.text((SIZE / 2, SIZE / 2), ch, font=font, fill=color, anchor="mm",
               stroke_width=HALO, stroke_fill="#ffffff")
        path = OUT / f"{slug(key)}.png"
        img.save(path, optimize=True)
        print(f"  {path.relative_to(ROOT)}  ({glyph}, {color})")
    print(f"\n{len(defs)} iconos en {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
