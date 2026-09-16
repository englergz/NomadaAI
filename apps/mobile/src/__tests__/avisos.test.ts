// Cola de avisos del mapa. Lo que se protege aquí es concreto: que un aviso trivial no
// borre de la pantalla una alerta de riesgo que el usuario todavía no ha leído.
import { empujar, siguiente, TOPE_COLA, VACIO, type Banner } from '@/lib/banner-queue';

const alerta: Banner = { text: 'Zona de riesgo adelante', tone: 'coral' };
const aviso: Banner = { text: 'Sin señal: usando la última copia', tone: 'warn' };
const info: Banner = { text: 'Recorrido iniciado', tone: 'info' };
const ok: Banner = { text: 'Reporte enviado', tone: 'ok' };

describe('cola de avisos', () => {
  it('el primero se muestra tal cual', () => {
    expect(empujar(VACIO, info).actual).toEqual(info);
  });

  it('una alerta de riesgo NO la tapa un aviso trivial: el trivial espera', () => {
    const conAlerta = empujar(VACIO, alerta);
    const despues = empujar(conAlerta, info);
    expect(despues.actual).toEqual(alerta);
    expect(despues.cola).toEqual([info]);
  });

  it('una alerta sí desplaza a una advertencia, y la advertencia queda para después', () => {
    const conAviso = empujar(VACIO, aviso);
    const despues = empujar(conAviso, alerta);
    expect(despues.actual).toEqual(alerta);
    expect(despues.cola).toEqual([aviso]);
  });

  it('lo trivial desplazado no se guarda: al pasar ya no significa nada', () => {
    const conOk = empujar(VACIO, ok);
    const despues = empujar(conOk, alerta);
    expect(despues.actual).toEqual(alerta);
    expect(despues.cola).toEqual([]);
  });

  it('al cerrarse el de pantalla entra el siguiente, el más importante primero', () => {
    let estado = empujar(VACIO, alerta);
    estado = empujar(estado, info);
    estado = empujar(estado, aviso);
    expect(estado.actual).toEqual(alerta);
    estado = siguiente(estado);
    expect(estado.actual).toEqual(aviso);   // la advertencia antes que la información
    estado = siguiente(estado);
    expect(estado.actual).toEqual(info);
    estado = siguiente(estado);
    expect(estado.actual).toBeNull();
  });

  it('no repite: el mismo texto no entra dos veces', () => {
    let estado = empujar(VACIO, alerta);
    estado = empujar(estado, info);
    estado = empujar(estado, info);
    estado = empujar(estado, alerta);
    expect(estado.cola).toEqual([info]);
  });

  it('la cola tiene tope: lo menos importante y más viejo se cae', () => {
    let estado = empujar(VACIO, alerta);
    for (let i = 0; i < TOPE_COLA + 2; i++) estado = empujar(estado, { text: `dato ${i}`, tone: 'info' });
    expect(estado.cola).toHaveLength(TOPE_COLA);
    expect(estado.cola[0]).toEqual({ text: 'dato 0', tone: 'info' });
  });

  it('`null` limpia la pantalla y pasa al siguiente', () => {
    let estado = empujar(VACIO, alerta);
    estado = empujar(estado, info);
    estado = empujar(estado, null);
    expect(estado.actual).toEqual(info);
  });
});
