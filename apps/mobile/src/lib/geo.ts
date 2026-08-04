// Geometría pura: distancia entre puntos, distancia a una polilínea y rumbo.
// Vive aparte de geocode.ts (que habla con la red) para poder probarse sin
// levantar nada: son las funciones que deciden si te desviaste de la ruta.
import type { Coordinate } from '@nomadaai/shared';

// Distancia (m) de un punto a una polilínea (mínima a todos sus segmentos).
// Se usa para detectar desvío de la ruta segura y recalcular.
export function distToPath(pos: Coordinate, path: Coordinate[]): number {
  if (path.length < 2) return Infinity;
  // Proyección local plana (suficiente a escala de calle): grados → metros.
  const latRad = (pos[1] * Math.PI) / 180;
  const mx = 111320 * Math.cos(latRad), my = 110540;
  const px = pos[0] * mx, py = pos[1] * my;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1][0] * mx, ay = path[i - 1][1] * my;
    const bx = path[i][0] * mx, by = path[i][1] * my;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    best = Math.min(best, Math.hypot(px - cx, py - cy));
  }
  return best;
}

// Rumbo geográfico a→b en grados (0 = norte, horario).
export function bearingDeg(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLon = (b[0] - a[0]) * rad;
  const y = Math.sin(dLon) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad)
    - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dLon);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

// Distancia haversine (m).
export function distM(a: Coordinate, b: Coordinate): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
