// Pruebas del RECÁLCULO: la app retraza la ruta segura cuando te alejas más de
// 45 m de ella. Si el cálculo de distancia falla, o recalcula sin parar (batería
// y ruido) o no recalcula nunca (el usuario queda fuera de su ruta sin saberlo).
import { distToPath } from '@/lib/geo';
import type { Coordinate } from '@nomadaai/shared';

/** Umbral real usado en map.tsx para disparar el recálculo. */
const UMBRAL_M = 45;

// Tramo recto de ~1 km en Tumaco, de oeste a este.
const RUTA: Coordinate[] = [[-78.7900, 1.7950], [-78.7800, 1.7950]];

describe('distancia a la ruta', () => {
  it('es ~0 sobre la propia ruta', () => {
    expect(distToPath([-78.7850, 1.7950], RUTA)).toBeLessThan(1);
  });

  it('mide la separación perpendicular en metros', () => {
    // 0.001° de latitud ≈ 110 m
    const d = distToPath([-78.7850, 1.7960], RUTA);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  it('NO dispara recálculo con desvíos pequeños (ruido de GPS)', () => {
    // ~11 m: dentro del error típico del GPS urbano, no debe recalcular.
    expect(distToPath([-78.7850, 1.79510], RUTA)).toBeLessThan(UMBRAL_M);
  });

  it('SÍ dispara recálculo cuando te sales de verdad', () => {
    // ~110 m fuera: es un desvío real.
    expect(distToPath([-78.7850, 1.7960], RUTA)).toBeGreaterThan(UMBRAL_M);
  });

  it('se apoya en el segmento más cercano, no solo en los extremos', () => {
    const enMedio = distToPath([-78.7850, 1.7950], RUTA);
    const enExtremo = distToPath([-78.7900, 1.7950], RUTA);
    expect(enMedio).toBeLessThan(1);
    expect(enExtremo).toBeLessThan(1);
  });

  it('devuelve infinito si no hay ruta trazada (no puede haber desvío)', () => {
    expect(distToPath([-78.785, 1.795], [])).toBe(Infinity);
    expect(distToPath([-78.785, 1.795], [[-78.79, 1.795]])).toBe(Infinity);
  });
});
