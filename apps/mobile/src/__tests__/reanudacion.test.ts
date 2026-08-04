// Pruebas de la REANUDACIÓN del viaje. Aquí ya nos mordió un bug real: un viaje
// viejo no debe revivir, y uno reciente no debe perderse.
import { isResumable, STALE_MS, type ActiveTrip } from '@/lib/background-trip';

function viaje(updatedAtHaceMs: number): ActiveTrip {
  const now = Date.now();
  return {
    startedAt: now - updatedAtHaceMs,
    updatedAt: now - updatedAtHaceMs,
    city: 'tumaco',
    vehicle: 'car',
    priority: 2,
    alerts: 0,
    dest: null,
    points: [],
  };
}

describe('¿se reanuda el viaje guardado?', () => {
  it('sí, si acaba de ocurrir', () => {
    expect(isResumable(viaje(60_000))).toBe(true);           // hace 1 min
  });

  it('sí, justo por debajo del límite', () => {
    expect(isResumable(viaje(STALE_MS - 60_000))).toBe(true);
  });

  it('NO, si es más viejo que el límite (viaje abandonado)', () => {
    expect(isResumable(viaje(STALE_MS + 60_000))).toBe(false);
  });

  it('NO, si no hay viaje guardado', () => {
    expect(isResumable(null)).toBe(false);
  });

  it('usa startedAt cuando falta updatedAt (dato antiguo o incompleto)', () => {
    const v = { ...viaje(60_000), updatedAt: 0 };
    expect(isResumable(v)).toBe(true);
  });

  it('el límite es de horas, no de minutos: un viaje de hace 2 h se reanuda', () => {
    expect(STALE_MS).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
    expect(isResumable(viaje(2 * 60 * 60 * 1000))).toBe(true);
  });
});
