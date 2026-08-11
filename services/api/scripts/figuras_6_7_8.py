#!/usr/bin/env python3
"""Regenera las Figuras 6, 7 y 8 sobre el SISTEMA ENTREGADO.

Por qué existe: las tres figuras originales salen del prototipo (malla de 425 celdas a
250 m, curva ×1,79, umbrales en escala cruda) y contradicen al texto ya corregido:

  Fig. 6  risk_hour_curve.png         mostraba amplitud ×1,79; el texto dice ×1,17
  Fig. 7  sweep_alerta.png            umbrales 60/80/100 sobre riesgo crudo; el punto de
                                      operación real umbraliza el percentil en 0,70
  Fig. 8  eval_alerta_anticipada.png  mostraba el 88,7 %, cifra retirada del texto

CONVENCIÓN IEEE — SIN TÍTULO INTERNO. Una figura no lleva título dentro del gráfico: el
pie del documento ES el título. Rotularlo dos veces lo duplica y, peor, con dos
redacciones distintas: el pie de la Fig. 6 dice «supuesto de modulación sin calibrar»,
matiz que costó tres rondas conseguir y que un título interno perdería.

Por la misma razón no se nombran archivos de código dentro de las figuras: eso es
lenguaje de repositorio, va en el cuerpo o en un anexo.

Todos los rótulos llevan tildes: el documento está en español.

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


def limpia(ax) -> None:
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.25, linewidth=0.7)
    ax.set_axisbelow(True)


def fig6() -> None:
    """Curva horaria: factor del artefacto frente a la modulación efectiva."""
    rz = pd.read_csv(RISK)
    hm = rz.groupby("hora")["riesgo_dyn"].mean()
    tf = (hm / hm.max()).to_dict()
    horas = list(range(24))
    servida = [tf[h] for h in horas]
    efectiva = [0.5 + 0.5 * tf[h] for h in horas]
    ef_norm = [e / max(efectiva) for e in efectiva]

    # coma decimal: el documento esta en espanol
    def dec(v: float) -> str:
        return f"{v:.3f}".replace(".", ",")

    fig, ax = plt.subplots(figsize=(9, 4.2))
    ax.plot(horas, servida, marker="o", ms=4, lw=2, color=GRIS,
            label=f"Factor temporal del artefacto  (amplitud ×{dec(max(servida)/min(servida))})")
    ax.plot(horas, ef_norm, marker="o", ms=4.5, lw=2.4, color=AZUL,
            label=f"Modulación efectiva del riesgo  (amplitud ×{dec(max(efectiva)/min(efectiva))})")
    pico = max(horas, key=lambda h: tf[h])
    ax.axvline(pico, color=AMBAR, ls="--", lw=1.2, alpha=0.8)
    ax.annotate(f"pico {pico}:00", (pico, 1.035), textcoords="offset points",
                xytext=(-6, 0), fontsize=9, color=AMBAR, fontweight="bold",
                ha="right", va="center")
    limpia(ax)
    ax.set_xlabel("Hora del día")
    ax.set_ylabel("Factor relativo (pico = 1,0)")
    ax.set_xticks(range(0, 24, 2))
    ax.set_ylim(0, 1.10)
    ax.legend(frameon=False, fontsize=8.5, loc="lower center")
    fig.tight_layout()
    fig.savefig(OUT / "fig6_curva_horaria.png", dpi=160)
    plt.close(fig)
    print(f"  fig6 · artefacto ×{max(servida)/min(servida):.3f} · "
          f"efectiva ×{max(efectiva)/min(efectiva):.3f}")


def fig7() -> None:
    """Cobertura de cada umbral sobre el territorio, por hora."""
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

    fig, ax = plt.subplots(figsize=(9, 4.2))
    ax.fill_between(horas, prec, color=AMBAR, alpha=0.22)
    ax.plot(horas, prec, marker="o", ms=4, lw=2.2, color=AMBAR,
            label="Zonas sobre el umbral de precaución (≥ 0,70)")
    ax.fill_between(horas, alto, color=CORAL, alpha=0.28)
    ax.plot(horas, alto, marker="o", ms=4, lw=2.2, color=CORAL,
            label="Zonas de nivel alto (≥ 0,90)")
    limpia(ax)
    ax.set_xlabel("Hora del día")
    ax.set_ylabel("% de las 475 zonas")
    ax.set_xticks(range(0, 24, 2))
    ax.set_ylim(0, max(prec) * 1.30)
    ax.legend(frameon=False, fontsize=9, loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "fig7_umbral_cobertura.png", dpi=160)
    plt.close(fig)
    print(f"  fig7 · precaución 06:00 {prec[6]:.1f}% / 20:00 {prec[20]:.1f}% · "
          f"alto 06:00 {alto[6]:.1f}% / 20:00 {alto[20]:.1f}%")


def fig8() -> None:
    """Alerta anticipada en el punto de operación: cobertura y anticipación."""
    op = {int(r["hora_inicio"]): r
          for r in csv.DictReader(open(EVAL / "oe3_alerta_punto_operacion.csv"))}
    al = {int(r["hora_inicio"]): r
          for r in csv.DictReader(open(EVAL / "oe3_alerta_nivel_alto.csv"))}
    horas = sorted(op)
    x = list(range(len(horas)))
    w = 0.26

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11.5, 4.4))

    a1.bar([i - w for i in x], [float(op[h]["pct_con_alerta"]) for h in horas], w,
           color=AMBAR, label="Recibe aviso de precaución")
    a1.bar(x, [float(al[h]["pct_con_alerta"]) for h in horas], w,
           color=CORAL, label="Atraviesa zona de nivel alto")
    a1.bar([i + w for i in x], [float(op[h]["pct_anticipados"]) for h in horas], w,
           color=AZUL, label="El aviso precede a la entrada")
    a1.set_xticks(x)
    a1.set_xticklabels([f"{h:02d}:00" for h in horas])
    a1.set_ylabel("% de los 4.032 recorridos")
    a1.set_xlabel("Hora de inicio del recorrido")
    a1.set_ylim(0, 128)
    limpia(a1)
    a1.legend(frameon=False, fontsize=8.5, loc="upper center")
    a1.text(0.5, -0.22, "(a) Cobertura", transform=a1.transAxes, ha="center", fontsize=9.5)

    # Sin avisos a esa hora no hay anticipación que medir: se deja HUECO, no un cero.
    # Un 0 diría «avisa con 0 m de margen»; lo cierto es que no hay ningún aviso.
    def serie(d):
        return [float(d[h]["antic_mediana_m"]) if int(d[h]["con_alerta"]) > 0
                else float("nan") for h in horas]

    a2.plot(x, serie(op), marker="o", ms=6, lw=2.2, color=AZUL,
            label="Precaución (≥ 0,70)")
    a2.plot(x, serie(al), marker="s", ms=6, lw=2.2, color=CORAL,
            label="Nivel alto (≥ 0,90)")
    a2.text(0.015, 0.62, "a las 06:00 no hay avisos\nde nivel alto que medir",
            transform=a2.transAxes, fontsize=8, color=CORAL, style="italic", va="top")
    a2.set_xticks(x)
    a2.set_xticklabels([f"{h:02d}:00" for h in horas])
    a2.set_ylabel("Anticipación mediana (m)")
    a2.set_xlabel("Hora de inicio del recorrido")
    limpia(a2)
    a2.legend(frameon=False, fontsize=8.5)
    a2.text(0.5, -0.22, "(b) Anticipación, solo avisos que preceden",
            transform=a2.transAxes, ha="center", fontsize=9.5)

    fig.tight_layout()
    fig.savefig(OUT / "fig8_alerta_operacion.png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    print(f"  fig8 · 20:00 → aviso {op[20]['pct_con_alerta']}% · "
          f"alto {al[20]['pct_con_alerta']}% · anticipados {op[20]['pct_anticipados']}%")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    print("Regenerando figuras sobre el sistema entregado (sin título interno, IEEE):")
    fig6()
    fig7()
    fig8()
    print(f"\nEscritas en {OUT}")
