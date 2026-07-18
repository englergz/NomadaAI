// Personalización del mapa de calor — MISMO sistema y MISMOS defaults que la app
// móvil (apps/mobile/src/constants/map.ts): paletas calor/semáforo/frío, intensidad
// 50% y opacidad 25%. Persistido en este navegador (localStorage).
export const HEAT_PALETTES = {
  calor: {
    label: "Calor",
    colors: ["rgba(34,197,94,0)", "rgba(245,165,36,0.36)", "rgba(249,115,22,0.56)", "rgba(239,68,68,0.76)", "rgba(220,38,38,1)"],
  },
  semaforo: {
    label: "Semáforo",
    colors: ["rgba(22,163,74,0)", "rgba(132,204,22,0.36)", "rgba(250,204,21,0.56)", "rgba(249,115,22,0.76)", "rgba(220,38,38,1)"],
  },
  frio: {
    label: "Frío",
    colors: ["rgba(59,130,246,0)", "rgba(99,102,241,0.36)", "rgba(168,85,247,0.56)", "rgba(217,70,239,0.76)", "rgba(225,29,72,1)"],
  },
} as const;
export type HeatPaletteKey = keyof typeof HEAT_PALETTES;

// Expresión de color del fill: `intensity` desplaza las paradas (más intensidad =
// colores fuertes desde riesgos más bajos). Idéntico al móvil.
export function riskFillColor(palette: HeatPaletteKey, intensity: number) {
  const base = [0.0, 0.35, 0.6, 0.85, 1.0];
  const scale = 2.0 - intensity;
  const stops = base.map((s, i) => Math.min(1, s * scale) + i * 1e-6);
  const colors = HEAT_PALETTES[palette].colors;
  const expr: unknown[] = ["interpolate", ["linear"], ["get", "risk_norm"]];
  stops.forEach((s, i) => expr.push(s, colors[i]));
  return expr;
}

export interface RiskPrefs { palette: HeatPaletteKey; intensity: number; opacity: number }
export const DEFAULT_RISK_PREFS: RiskPrefs = { palette: "semaforo", intensity: 0.5, opacity: 0.25 };

const KEY = "nomadaai_risk_prefs";
export function loadRiskPrefs(): RiskPrefs {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...DEFAULT_RISK_PREFS, ...JSON.parse(s) };
  } catch { /* defaults */ }
  return { ...DEFAULT_RISK_PREFS };
}
export function saveRiskPrefs(p: RiskPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
