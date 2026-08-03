// Personalización de la capa de riesgo en el ESCRITORIO.
// Las paletas y la rampa de color viven en @nomadaai/shared (misma fuente que la
// app móvil); aquí solo queda lo propio del navegador: persistir las preferencias
// del usuario en este equipo.
export {
  DEFAULT_RISK_PREFS, HEAT_PALETTES, paletteGradient, riskFillColor,
  type HeatPaletteKey, type RiskPrefs,
} from '@nomadaai/shared';

import { DEFAULT_RISK_PREFS, type RiskPrefs } from '@nomadaai/shared';

const KEY = 'nomadaai_risk_prefs';

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
