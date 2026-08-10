#!/usr/bin/env python3
"""Regenera las Figuras 6, 7 y 8 sobre el SISTEMA ENTREGADO.

Por que existe: las tres figuras actuales salen del prototipo (malla de 425 celdas a 250 m,
curva x1,79, umbrales en escala cruda) y **contradicen al texto ya corregido**:

  Fig. 6  `risk_hour_curve.png`        muestra amplitud x1,79; el texto dice x1,17
  Fig. 7  `sweep_alerta.png`           umbrales 60/80/100 sobre `risk` crudo; el punto de
                                       operacion real es `threshold_norm = 0,70`
  Fig. 8  `eval_alerta_anticipada.png` muestra el 88,7 %, cifra RETIRADA del texto

Mientras no se regeneren, texto e imagenes cuentan cosas distintas — el defecto que toda
esta auditoria ha estado eliminando.

Fuentes: solo artefactos entregados y medidos en este recomputo.
Salida: artifacts/figuras/fig6_curva_horaria.png · fig7_umbral_cobertura.png ·
        fig8_alerta_operacion.png
"""
from __future__ import annotations

import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
RISK = ROOT / "services/api/artifacts/risk/tumaco_riesgo_horario.csv"
EVAL = ROOT / "services/api/artifacts/eval"
OUT = ROOT / "services/api/artifacts/figuras"

AZUL, AMBAR, CORAL, GRIS = "#2f81f7", "#f59e0b", "#f87171", "#9ca3af"


def estilo(ax, titulo: str, sub: str = "") -> None:
    """El subtitulo se envuelve a mano: matplotlib no ajusta texto al ancho del eje y
    una linea larga se sale del lienzo sin avisar."""
    import textwrap
    ax.set_title(titulo, fontsize=12, fontweight="bold", loc="left",
                 pad=10 + 11 * (len(textwrap.wrap(sub, 96)) if sub else 0))
    if sub:
        lineas = textwrap.wrap(sub, 96)
        for i, ln in enumerate(lineas):
            ax.text(0, 1.012 + 0.052 * (len(lineas) - 1 - i), ln, transform=ax.transAxes,
                    fontsize=8.5, color="#6b7280", va="bottom")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.25, linewidth=0.7)
    ax.set_axisbelow(True)


def fig6() -> None:
    """Curva horaria: lo servido frente a lo EFECTIVO (doble piso nocturno)."""
    rz = pd.read_csv(RISK)
    hm = rz.groupby("hora")["riesgo_dyn"].mean()
    tf = (hm / hm.max()).to_dict()
    horas = list(range(24))
    servida = [tf[h] for h in horas]
    efectiva = [0.5 + 0.5 * tf[h] for h in horas]
    ef_norm = [e / max(efectiva) for e in efectiva]

    fig, ax = plt.subplots(figsize=(9, 4.4))
    ax.plot(horas, servida, marker="o", ms=4, lw=2, color=GRIS,
            label=f"Factor servido  (amplitud x{max(servida)/min(servida):.3f})")
    ax.plot(horas, ef_norm, marker="o", ms=4.5, lw=2.4, color=AZUL,
            label=f"Modulacion EFECTIVA  (amplitud x{max(efectiva)/min(efectiva):.3f})")
    pico = max(horas, key=lambda h: tf[h])
    ax.axvline(pico, color=AMBAR, ls="--", lw=1.2, alpha=0.8)
    # arriba y a la IZQUIERDA de la linea: a la derecha se sale del lienzo (pico = 19 h)
    ax.annotate(f"pico {pico}:00", (pico, 1.035), textcoords="offset points",
                xytext=(-6, 0), fontsize=9, color=AMBAR, fontweight="bold",
                ha="right", va="center")
    estilo(ax, "Figura 6 · Modulacion horaria del indice de riesgo",
           "Malla entregada (475 celdas, 150 m). La curva EFECTIVA es la que gobierna niveles y "
           "alertas: risk.py aplica un segundo piso nocturno sobre una curva que ya lo traia.")
    ax.set_xlabel("Hora del dia"); ax.set_ylabel("Factor relativo (pico = 1,0)")
    ax.set_xticks(range(0, 24, 2)); ax.set_ylim(0, 1.10)
    ax.legend(frameon=False, fontsize=9, loc="lower center", ncol=2)
    fig.tight_layout(); fig.savefig(OUT / "fig6_curva_horaria.png", dpi=160)
    plt.close(fig)
    print(f"  fig6 · servida x{max(servida)/min(servida):.3f} · efectiva x{max(efectiva)/min(efectiva):.3f}")


def fig7() -> None:
    """Cobertura del umbral sobre el territorio — por que el aviso es casi universal."""
    rz = pd.read_csv(RISK)
    pico = rz.groupby("cell_id")["riesgo_dyn"].max().sort_values()
    n = len(pico)
    sp = {c: (i + 1) / n for i, c in enumerate(pico.index)}
    hm = rz.groupby("hora")["riesgo_dyn"].mean()
    tf = (hm / hm.max()).to_dict()

    horas = list(range(24))
    prec, alto = [], []
    for h in horas:
        f = 0.5 + 0.5 * tf[h]
        vals = [sp[c] * f for c in pico.index]
        prec.append(100 * sum(v >= 0.70 for v in vals) / n)
        alto.append(100 * sum(v >= 0.90 for v in vals) / n)

    fig, ax = plt.subplots(figsize=(9, 4.4))
    ax.fill_between(horas, prec, color=AMBAR, alpha=0.22)
    ax.plot(horas, prec, marker="o", ms=4, lw=2.2, color=AMBAR,
            label="Zonas sobre el umbral de PRECAUCION (>= 0,70)")
    ax.fill_between(horas, alto, color=CORAL, alpha=0.28)
    ax.plot(horas, alto, marker="o", ms=4, lw=2.2, color=CORAL,
            label="Zonas de NIVEL ALTO (>= 0,90)")
    estilo(ax, "Figura 7 · Cobertura de los umbrales de alerta sobre el territorio",
           "Punto de operacion real del sistema (threshold_norm = 0,70). "
           "A las 06:00 NINGUNA celda alcanza el nivel alto; a las 20:00 lo hace el 10,1 %.")
    ax.set_xlabel("Hora del dia"); ax.set_ylabel("% de las 475 celdas")
    ax.set_xticks(range(0, 24, 2)); ax.set_ylim(0, max(prec) * 1.25)
    ax.legend(frameon=False, fontsize=9, loc="upper left")
    fig.tight_layout(); fig.savefig(OUT / "fig7_umbral_cobertura.png", dpi=160)
    plt.close(fig)
    print(f"  fig7 · precaucion 06:00 {prec[6]:.1f}% / 20:00 {prec[20]:.1f}% · "
          f"alto 06:00 {alto[6]:.1f}% / 20:00 {alto[20]:.1f}%")


def fig8() -> None:
    """Alerta anticipada en el punto de operacion — sustituye al 88,7 % retirado."""
    op = {int(r["hora_inicio"]): r for r in csv.DictReader(open(EVAL / "oe3_alerta_punto_operacion.csv"))}
    al = {int(r["hora_inicio"]): r for r in csv.DictReader(open(EVAL / "oe3_alerta_nivel_alto.csv"))}
    horas = sorted(op)
    x = range(len(horas))
    w = 0.26

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11.5, 4.8))

    a1.bar([i - w for i in x], [float(op[h]["pct_con_alerta"]) for h in horas], w,
           color=AMBAR, label="Recibe aviso de precaucion")
    a1.bar([i for i in x], [float(al[h]["pct_con_alerta"]) for h in horas], w,
           color=CORAL, label="Cruza zona de nivel alto")
    a1.bar([i + w for i in x], [float(op[h]["pct_anticipados"]) for h in horas], w,
           color=AZUL, label="El aviso PRECEDE a la entrada")
    a1.set_xticks(list(x)); a1.set_xticklabels([f"{h:02d}:00" for h in horas])
    a1.set_ylabel("% de los 4.032 recorridos"); a1.set_ylim(0, 126)
    estilo(a1, "Figura 8a · Cobertura de la alerta", "")
    a1.legend(frameon=False, fontsize=8.5, loc="upper center", ncol=1,
              bbox_to_anchor=(0.5, 1.0))

    # Sin avisos a esa hora no hay anticipacion que medir: se deja HUECO, no un cero.
    # Dibujar 0 diria «avisa con 0 m de margen» cuando lo cierto es «no hay ningun aviso».
    def serie(d):
        return [float(d[h]["antic_mediana_m"]) if int(d[h]["con_alerta"]) > 0 else float("nan")
                for h in horas]
    a2.plot(list(x), serie(op), marker="o", ms=6, lw=2.2, color=AZUL,
            label="Precaucion (>= 0,70)")
    a2.plot(list(x), serie(al), marker="s", ms=6, lw=2.2, color=CORAL,
            label="Nivel alto (>= 0,90)")
    # en coordenadas del EJE: el eje y no llega a cero, asi que anclarla en datos la saca del lienzo
    a2.text(0.015, 0.60, "a las 06:00 no hay\navisos de nivel alto\nque medir",
            transform=a2.transAxes, fontsize=8, color=CORAL, style="italic", va="top")
    a2.set_xticks(list(x)); a2.set_xticklabels([f"{h:02d}:00" for h in horas])
    a2.set_ylabel("Anticipacion mediana (m)")
    estilo(a2, "Figura 8b · Anticipacion, solo avisos que preceden", "")
    a2.legend(frameon=False, fontsize=8.5)

    fig.suptitle("Figura 8 · Alerta anticipada en el punto de operacion del sistema entregado",
                 fontsize=12, fontweight="bold", x=0.008, ha="left", y=0.985)
    fig.text(0.008, 0.933, "threshold_norm = 0,70 · 8,3 m/s · sin horizonte · riesgo a la hora "
             "estimada de llegada · malla de 475 celdas", fontsize=8.5, color="#6b7280")
    fig.tight_layout(rect=[0, 0, 1, 0.90])
    fig.savefig(OUT / "fig8_alerta_operacion.png", dpi=160)
    plt.close(fig)
    print(f"  fig8 · 20:00 → aviso {op[20]['pct_con_alerta']}% · alto {al[20]['pct_con_alerta']}% · "
          f"anticipados {op[20]['pct_anticipados']}%")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    print("Regenerando figuras sobre el sistema entregado:")
    fig6(); fig7(); fig8()
    print(f"\nEscritas en {OUT}")
