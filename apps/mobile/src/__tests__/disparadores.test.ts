// Disparadores automáticos de Círculos. Lo que se protege: que tu gente solo se entere de lo
// que TÚ encendiste, que «no compartir» mande sobre todo, y que un mismo motivo no dispare
// avisos en ráfaga.
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/auth', () => ({ authToken: async () => null, authUserId: () => null }));
jest.mock('@/lib/circle-sharing', () => ({
  currentSharing: async () => [], startSharing: async () => {}, stopSharing: async () => {},
}));

import {
  _resetTriggersForTests, circuloQuiere, dispararCirculos, puedeDisparar, TRIGGER_COOLDOWN_MS,
} from '@/lib/circle-triggers';

beforeEach(() => _resetTriggersForTests());

describe('¿este círculo quiere enterarse?', () => {
  it('de fábrica, solo del riesgo alto', () => {
    const deFabrica = { share_mode: 'on_trigger', triggers: {} };
    expect(circuloQuiere(deFabrica, 'riesgo')).toBe(true);
    expect(circuloQuiere(deFabrica, 'precaucion')).toBe(false);
    expect(circuloQuiere(deFabrica, 'inactividad')).toBe(false);
    expect(circuloQuiere(deFabrica, 'desvio')).toBe(false);
  });

  it('respeta lo que la persona encendió o apagó', () => {
    const prefs = { share_mode: 'on_trigger', triggers: { riesgo: false, desvio: true } };
    expect(circuloQuiere(prefs, 'riesgo')).toBe(false);
    expect(circuloQuiere(prefs, 'desvio')).toBe(true);
  });

  it('«no compartir» manda sobre cualquier disparador', () => {
    const prefs = { share_mode: 'never', triggers: { riesgo: true, inactividad: true } };
    expect(circuloQuiere(prefs, 'riesgo')).toBe(false);
    expect(circuloQuiere(prefs, 'inactividad')).toBe(false);
  });

  it('sin preferencias legibles, no se avisa', () => {
    expect(circuloQuiere(null, 'riesgo')).toBe(false);
  });
});

describe('freno contra avisos en ráfaga', () => {
  it('la primera vez sí se puede disparar', () => {
    expect(puedeDisparar('riesgo', 1_000)).toBe(true);
  });

  it('sin cuenta no se dispara nada ni se consume el freno', async () => {
    expect(await dispararCirculos('riesgo')).toBe(0);
    expect(puedeDisparar('riesgo')).toBe(true);
  });

  it('el freno dura 10 minutos y es por motivo', () => {
    expect(TRIGGER_COOLDOWN_MS).toBe(10 * 60 * 1000);
  });
});
