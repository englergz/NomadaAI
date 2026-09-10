// Arranque real y actualizaciones por aire: decisiones puras que gobiernan cuándo
// se va el splash y cuándo se muestran las novedades.
import { _resetBootForTests, bootReady, bootStep, markBootReady } from '@/lib/boot';

// expo-updates no existe en Jest: solo se prueba la decisión pura del módulo.
jest.mock('expo-updates', () => ({ isEnabled: false, updateId: null }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));
import { whatsNewDecision } from '@/lib/ota';

describe('arranque real (lib/boot)', () => {
  beforeEach(() => _resetBootForTests());

  it('no está listo hasta que ajustes, ubicación y riesgo han terminado, en ese orden de aviso', () => {
    expect(bootReady()).toBe(false);
    expect(bootStep()).toBe('settings');
    markBootReady('settings');
    expect(bootStep()).toBe('location');
    markBootReady('risk');           // el orden de llegada no importa
    expect(bootReady()).toBe(false);
    expect(bootStep()).toBe('location');
    markBootReady('location');
    expect(bootReady()).toBe(true);
    expect(bootStep()).toBeNull();
  });

  it('marcar dos veces el mismo paso es inocuo', () => {
    markBootReady('settings'); markBootReady('settings');
    expect(bootStep()).toBe('location');
  });
});

describe('novedades tras actualizar (lib/ota)', () => {
  it('en la instalación inicial no hay nada nuevo que mostrar', () => {
    expect(whatsNewDecision(null, 'embedded')).toBe('silent');
    expect(whatsNewDecision(null, 'upd-1')).toBe('silent');
  });
  it('se muestran una vez cuando la versión en ejecución cambió respecto a la última vista', () => {
    expect(whatsNewDecision('embedded', 'upd-1')).toBe('show');
    expect(whatsNewDecision('upd-1', 'upd-2')).toBe('show');
    expect(whatsNewDecision('upd-2', 'upd-2')).toBe('silent');
  });
});
