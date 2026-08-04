// Pruebas de las ALERTAS: es lo que justifica que la app exista. Si esto se
// rompe, el usuario cree estar protegido y no lo está.
import { levelFor, ProximityTracker, zoneAt } from '@/lib/alerts';
import type { RiskZonesResponse } from '@nomadaai/shared';

/** Malla mínima: una celda cuadrada alrededor de [0,0] con el riesgo dado. */
function celda(riskNorm: number, cellId = 'z1'): RiskZonesResponse {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { cell_id: cellId, risk_norm: riskNorm },
      geometry: { type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]] },
    }],
  } as unknown as RiskZonesResponse;
}

describe('umbrales de nivel', () => {
  it('clasifica según los cortes acordados (0.45 precaución, 0.75 atención)', () => {
    expect(levelFor(0)).toBe('despejado');
    expect(levelFor(0.44)).toBe('despejado');
    expect(levelFor(0.45)).toBe('precaucion');   // límite inferior INCLUIDO
    expect(levelFor(0.74)).toBe('precaucion');
    expect(levelFor(0.75)).toBe('atencion');     // límite inferior INCLUIDO
    expect(levelFor(1)).toBe('atencion');
  });
});

describe('zona bajo la posición', () => {
  it('detecta que el punto cae dentro de la celda', () => {
    expect(zoneAt(celda(0.8), [0, 0])?.level).toBe('atencion');
  });

  it('devuelve null fuera de la malla', () => {
    expect(zoneAt(celda(0.8), [50, 50])).toBeNull();
  });

  it('devuelve null si no hay capa de riesgo cargada', () => {
    expect(zoneAt(null, [0, 0])).toBeNull();
  });
});

describe('una alerta por zona y por viaje', () => {
  it('avisa la primera vez y calla las siguientes en la MISMA zona', () => {
    const t = new ProximityTracker();
    const risk = celda(0.8);
    expect(t.check(risk, [0, 0])).not.toBeNull();   // primera: avisa
    expect(t.check(risk, [0.1, 0.1])).toBeNull();   // sigue dentro: NO repite
    expect(t.check(risk, [0.2, 0])).toBeNull();
  });

  it('no avisa en zona despejada', () => {
    expect(new ProximityTracker().check(celda(0.2), [0, 0])).toBeNull();
  });

  it('vuelve a avisar tras reset (nuevo viaje)', () => {
    const t = new ProximityTracker();
    const risk = celda(0.8);
    expect(t.check(risk, [0, 0])).not.toBeNull();
    t.reset();
    expect(t.check(risk, [0, 0])).not.toBeNull();   // viaje nuevo: vuelve a avisar
  });

  it('el mensaje corresponde al nivel', () => {
    const a = new ProximityTracker().check(celda(0.8), [0, 0]);
    expect(a?.level).toBe('atencion');
    expect(a?.title).toMatch(/Atención/i);
  });

  it('seenOnce deduplica las anticipadas del modelo', () => {
    const t = new ProximityTracker();
    expect(t.seenOnce('celda-9')).toBe(true);
    expect(t.seenOnce('celda-9')).toBe(false);
  });
});
