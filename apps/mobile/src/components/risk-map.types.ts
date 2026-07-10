// Interfaz común del mapa (web y nativo comparten estas props).
import type { Coordinate, RiskZonesResponse } from '@nomadaai/shared';

export interface RouteLines {
  safe: Coordinate[];    // ruta segura
  direct: Coordinate[];  // ruta directa (gris, comparación)
  // Nivel de riesgo POR TRAMO de la ruta segura (length = safe.length - 1):
  // la línea se pinta azul → ámbar → coral según el tramo (paleta del proyecto).
  safeLevels?: ('despejado' | 'precaucion' | 'atencion')[];
}

// Colores de ruta por nivel (azul → ámbar → coral; rojo puro solo en el heatmap).
export const ROUTE_LEVEL_COLORS = {
  despejado: '#2f81f7',
  precaucion: '#f5a524',
  atencion: '#ff6b5e',
} as const;

// FeatureCollection de segmentos coloreables (compartido por web y nativo).
export function segmentsFeatureCollection(routes: RouteLines) {
  const levels = routes.safeLevels ?? [];
  return {
    type: 'FeatureCollection' as const,
    features: routes.safe.slice(0, -1).map((p, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [p, routes.safe[i + 1]] },
      properties: { level: levels[i] ?? 'despejado' },
    })),
  };
}

export interface RiskStyle {
  palette: 'calor' | 'semaforo' | 'frio';
  intensity: number; // 0–1
  opacity: number;   // 0–1 (transparencia global de la capa)
}

export interface RiskMapProps {
  dark: boolean;
  riskOn: boolean;
  riskData: RiskZonesResponse | null;
  userLocation: [number, number] | null; // [lon, lat]
  routes?: RouteLines | null;
  destination?: [number, number] | null; // marcador de destino
  riskStyle?: RiskStyle;
  satellite?: boolean;                       // base satelital (Ajustes → Mapa)
  poisData?: RiskZonesResponse | null;       // capa Lugares (FeatureCollection de puntos)
  poisOn?: boolean;
  // Rótulo traducido de la categoría de un POI (para el popup al tocar un icono).
  poiCategoryLabel?: (category: string) => string;
  // Encuadre pedido desde fuera (U3: flyTo al cambiar de ciudad).
  focus?: { center: [number, number]; zoom: number } | null;
  // Modo NAVEGACIÓN (recorrido activo): cámara inclinada orientada al rumbo del
  // teléfono y vehículo cenital en lugar del punto azul.
  nav?: { active: boolean; heading: number | null; vehicle: string | null } | null;
}

// Sprite cenital del vehículo (estilo Uber/Rappi, mismo lenguaje del escritorio).
// Apunta hacia ARRIBA (norte) en rotación 0; el parabrisas claro marca el frente.
export function vehicleTopSvg(t?: string | null): string {
  const ty = (t ?? 'car').toLowerCase();
  const sh = `<defs><filter id="vs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#000" flood-opacity="0.5"/></filter></defs>`;
  if (ty === 'moto' || ty === 'mot') {
    return `<svg width="26" height="26" viewBox="0 0 40 40">${sh}<g filter="url(#vs)"><rect x="16.5" y="10" width="7" height="20" rx="3.5" fill="#f97316" stroke="#fff" stroke-width="1.4"/><circle cx="20" cy="13.5" r="2.8" fill="#111827"/></g></svg>`;
  }
  if (ty === 'bus') {
    return `<svg width="32" height="32" viewBox="0 0 40 40">${sh}<g filter="url(#vs)"><rect x="12.5" y="5" width="15" height="30" rx="3.5" fill="#2563eb" stroke="#fff" stroke-width="1.4"/><rect x="15" y="7" width="10" height="5" rx="1.5" fill="#cfe5ff"/><rect x="15" y="15" width="10" height="3.5" rx="1" fill="#93c5fd"/><rect x="15" y="21" width="10" height="3.5" rx="1" fill="#93c5fd"/></g></svg>`;
  }
  if (ty === 'truck') {
    return `<svg width="32" height="32" viewBox="0 0 40 40">${sh}<g filter="url(#vs)"><rect x="13.5" y="4.5" width="13" height="10" rx="2.5" fill="#374151" stroke="#fff" stroke-width="1.4"/><rect x="15.5" y="6.5" width="9" height="5" rx="1.5" fill="#cbd5e1"/><rect x="13" y="14.5" width="14" height="21" rx="2" fill="#9ca3af" stroke="#fff" stroke-width="1.4"/></g></svg>`;
  }
  return `<svg width="30" height="30" viewBox="0 0 40 40">${sh}<g filter="url(#vs)"><rect x="12.5" y="6" width="15" height="28" rx="6.5" fill="#1f2937" stroke="#fff" stroke-width="1.5"/><path d="M15 13 Q20 9.5 25 13 L25 17 L15 17 Z" fill="#9cd2ff"/><rect x="15" y="25.5" width="10" height="5.5" rx="2.5" fill="#4b5563"/></g></svg>`;
}

// B4: iconos de Lugares por categoría (no puntos, no emojis). En web se rasterizan
// glyphs de MaterialCommunityIcons a imágenes PNG del mapa (canvas, SIN fondo),
// coloreados con la paleta de categorías del escritorio; en nativo, mientras no haya
// assets PNG, se mantiene el círculo de color (Expo Go ni carga MapLibre Native).
// MCI tiene iconos literales por categoría (gas-station, hospital-box, church…).
export const POI_ICON_DEFS: Record<string, { glyph: string; color: string }> = {
  seguridad: { glyph: 'police-badge', color: '#2563eb' },
  salud: { glyph: 'hospital-box', color: '#ef4444' },
  educación: { glyph: 'school', color: '#a855f7' },
  combustible: { glyph: 'gas-station', color: '#f97316' },
  banco: { glyph: 'bank', color: '#16a34a' },
  transporte: { glyph: 'bus', color: '#0ea5e9' },
  comercio: { glyph: 'cart', color: '#b45309' },
  culto: { glyph: 'church', color: '#64748b' },
  default: { glyph: 'map-marker', color: '#94a3b8' },
};

// Colores de POIs por categoría (mismos del panel de escritorio).
export const POI_CIRCLE_COLOR = [
  'match', ['get', 'category'],
  'seguridad', '#2563eb', 'salud', '#ef4444', 'educación', '#a855f7',
  'combustible', '#f97316', 'banco', '#16a34a', 'transporte', '#0ea5e9',
  'comercio', '#b45309', 'culto', '#64748b', '#94a3b8',
] as const;
