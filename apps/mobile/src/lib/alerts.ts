// Alertas graduadas por ACCIÓN, no por lugar (decisión de diseño del proyecto):
// 3 niveles — Despejado (sin aviso) / Precaución / Atención. Los mensajes hablan de la
// conducta del usuario, nunca etiquetan barrios. Una sola alerta por zona y por viaje.
import type { Coordinate, GeoJSONFeature, RiskZonesResponse } from '@nomadaai/shared';

export type AlertLevel = 'despejado' | 'precaucion' | 'atencion';

export interface ZoneHit {
  cellId: string;
  riskNorm: number;
  level: AlertLevel;
}

export interface ProximityAlert extends ZoneHit {
  title: string;
  body: string;
}

// Umbrales sobre risk_norm (percentil espacial del índice).
export function levelFor(riskNorm: number): AlertLevel {
  if (riskNorm >= 0.75) return 'atencion';
  if (riskNorm >= 0.45) return 'precaucion';
  return 'despejado';
}

// Mensajes orientados a la acción (nunca "zona peligrosa" ni nombres de barrios).
export const ALERT_MESSAGES: Record<Exclude<AlertLevel, 'despejado'>, { title: string; body: string }> = {
  precaucion: {
    title: 'Precaución en este tramo',
    body: 'Mantén el ritmo y evita detenerte; lleva el teléfono en soporte o guía por voz, no en la mano.',
  },
  atencion: {
    title: 'Atención en este tramo',
    body: 'Sigue la ruta sin paradas, ventanas arriba o casco puesto, y comparte tu recorrido con alguien.',
  },
};

// --- Geometría: punto dentro de polígono (ray casting) ---
function inRing(pt: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(pt: Coordinate, geom: { type: string; coordinates: unknown }): boolean {
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates as Coordinate[][];
    return rings.length > 0 && inRing(pt, rings[0]) && rings.slice(1).every((h) => !inRing(pt, h));
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as Coordinate[][][]).some((poly) =>
      poly.length > 0 && inRing(pt, poly[0]) && poly.slice(1).every((h) => !inRing(pt, h)));
  }
  return false;
}

// Zona de riesgo que contiene el punto (o null si está despejado / fuera de la malla).
export function zoneAt(risk: RiskZonesResponse | null, pos: Coordinate): ZoneHit | null {
  if (!risk?.features) return null;
  for (const f of risk.features as GeoJSONFeature[]) {
    const p = f.properties as { cell_id?: string | number; risk_norm?: number };
    if (p?.risk_norm == null) continue;
    if (inPolygon(pos, f.geometry)) {
      const riskNorm = Number(p.risk_norm);
      return { cellId: String(p.cell_id ?? 'zona'), riskNorm, level: levelFor(riskNorm) };
    }
  }
  return null;
}

// Rastreador de proximidad: UNA alerta por zona y por viaje (regla del proyecto).
export class ProximityTracker {
  private seen = new Set<string>();

  reset() {
    this.seen.clear();
  }

  // Devuelve la alerta a emitir para esta posición, o null (despejado, ya avisada, o fuera).
  check(risk: RiskZonesResponse | null, pos: Coordinate): ProximityAlert | null {
    const hit = zoneAt(risk, pos);
    if (!hit || hit.level === 'despejado' || this.seen.has(hit.cellId)) return null;
    this.seen.add(hit.cellId);
    return { ...hit, ...ALERT_MESSAGES[hit.level] };
  }

  // Dedupe genérico (misma regla una-vez-por-zona) para alertas anticipadas del modelo.
  seenOnce(id: string): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }
}

// ------------------------------------------------------------------ freno de notificaciones
// La regla «una alerta por zona» se cumple por CELDA de la malla, y un corredor de precaución
// cruza muchas celdas seguidas. Verificado en el simulador de iPhone: a 15 m/s llegaron siete
// notificaciones idénticas de «Precaución en este tramo» en un minuto. Eso enseña a ignorar los
// avisos, que es lo peor que le puede pasar a una app de seguridad.
//
// Solución: cada zona se sigue registrando en el historial y en el aviso de pantalla, pero la
// NOTIFICACIÓN (sonido y vibración) solo se repite si el riesgo SUBE o si pasó un rato desde la
// última del mismo nivel o superior. Bajar de nivel nunca interrumpe.

/** Silencio mínimo entre dos notificaciones del mismo nivel. */
export const NOTIFY_QUIET_MS = 3 * 60 * 1000;

const RANGO: Record<AlertLevel, number> = { despejado: 0, precaucion: 1, atencion: 2 };

export class NotificationThrottle {
  private ultimo: { level: AlertLevel; at: number } | null = null;

  reset() {
    this.ultimo = null;
  }

  /** ¿Esta alerta merece notificación (sonido y vibración) ahora? Si sí, la cuenta. */
  shouldNotify(level: AlertLevel, now: number = Date.now()): boolean {
    if (level === 'despejado') return false;
    const u = this.ultimo;
    const sube = !u || RANGO[level] > RANGO[u.level];
    const pasoElRato = !u || now - u.at >= NOTIFY_QUIET_MS;
    if (!sube && !pasoElRato) return false;
    this.ultimo = { level, at: now };
    return true;
  }
}
