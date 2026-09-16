// GPS por escalones: lo que importa es que corte en cuanto haya posición, que insista
// con más precisión cuando no la hay, y que no se quede colgado si el sistema no responde.
import { fixEscalonado, type IntentoGps } from '@/lib/gps';

const ESCALONES: IntentoGps<string>[] = [
  { accuracy: 'baja', timeoutMs: 40 },
  { accuracy: 'alta', timeoutMs: 40 },
  { accuracy: 'navegacion', timeoutMs: 40 },
];

function nunca<T>(): Promise<T> {
  return new Promise<T>(() => { /* el sistema no contesta */ });
}

describe('posición por escalones', () => {
  it('devuelve el primer resultado y no gasta los demás escalones', async () => {
    const pedidas: string[] = [];
    const pos = await fixEscalonado(async (a) => { pedidas.push(a); return { a }; }, ESCALONES, { esperaMs: 0 });
    expect(pos).toEqual({ a: 'baja' });
    expect(pedidas).toEqual(['baja']);
  });

  it('sube de escalón cuando el sistema no responde a tiempo', async () => {
    const pedidas: string[] = [];
    const pos = await fixEscalonado(
      (a) => { pedidas.push(a); return a === 'baja' ? nunca<{ a: string }>() : Promise.resolve({ a }); },
      ESCALONES,
      { esperaMs: 0 },
    );
    expect(pos).toEqual({ a: 'alta' });
    expect(pedidas).toEqual(['baja', 'alta']);
  });

  it('también sube de escalón si el intento falla al instante', async () => {
    const pedidas: string[] = [];
    const pos = await fixEscalonado(
      async (a) => { pedidas.push(a); if (a !== 'navegacion') throw new Error('sin señal'); return { a }; },
      ESCALONES,
      { esperaMs: 0 },
    );
    expect(pos).toEqual({ a: 'navegacion' });
    expect(pedidas).toEqual(['baja', 'alta', 'navegacion']);
  });

  it('si fallan todos, lanza: el aviso al usuario lo decide quien llama', async () => {
    await expect(
      fixEscalonado(async () => { throw new Error('sin señal'); }, ESCALONES, { esperaMs: 0 }),
    ).rejects.toThrow('sin señal');
  });

  it('avisa de cada fallo con su número de escalón', async () => {
    const fallos: number[] = [];
    await fixEscalonado(
      async (a) => { if (a === 'baja') throw new Error('x'); return { a }; },
      ESCALONES,
      { esperaMs: 0, alFallar: (i) => fallos.push(i) },
    );
    expect(fallos).toEqual([0]);
  });

  it('sin escalones configurados no se queda callado: lanza', async () => {
    await expect(fixEscalonado(async () => ({}), [], { esperaMs: 0 })).rejects.toThrow('sin intentos');
  });
});
