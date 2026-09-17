// Punto rojo del botón de Círculos. Lo que importa: que avise cuando OTRA persona pide ayuda y
// que no te avise de tu propio aviso.
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/auth', () => ({ authToken: async () => null, authUserId: () => null }));
jest.mock('@/lib/circle-sharing', () => ({ currentSharing: async () => [] }));

import { avisosAjenos } from '@/lib/circle-alerts';

describe('avisos de otros en mis círculos', () => {
  it('sin avisos abiertos, nada', () => {
    expect(avisosAjenos([{ id: 1, open_events: 0 }], [])).toBe(0);
  });

  it('alguien más pide ayuda: cuenta', () => {
    expect(avisosAjenos([{ id: 1, open_events: 1 }], [])).toBe(1);
  });

  it('tu propio aviso no cuenta', () => {
    expect(avisosAjenos([{ id: 1, open_events: 1 }], [1])).toBe(0);
  });

  it('tu aviso y el de otra persona en el mismo círculo: cuenta solo el ajeno', () => {
    expect(avisosAjenos([{ id: 1, open_events: 2 }], [1])).toBe(1);
  });

  it('suma entre círculos', () => {
    expect(avisosAjenos([{ id: 1, open_events: 1 }, { id: 2, open_events: 2 }], [2])).toBe(2);
  });
});
