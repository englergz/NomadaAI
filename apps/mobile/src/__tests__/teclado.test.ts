// Alto del teclado medido en la ventana principal. Bug real: en Android el evento del
// teclado llega con altura 0 y las hojas viven en un Modal que no se encoge, así que el
// botón de enviar del reporte quedaba tapado mientras se escribía.
import { _resetKeyboardInsetForTests, keyboardInset, reportVisibleHeight } from '@/lib/keyboard-inset';

beforeEach(() => _resetKeyboardInsetForTests());

describe('alto del teclado medido', () => {
  it('sin medidas todavía, no inventa nada', () => {
    expect(keyboardInset()).toBe(0);
  });

  it('con la pantalla entera (sin teclado) es cero', () => {
    reportVisibleHeight(2000);
    expect(keyboardInset()).toBe(0);
  });

  it('al encogerse la ventana, el teclado ocupa la diferencia', () => {
    reportVisibleHeight(2000);
    reportVisibleHeight(1200);
    expect(keyboardInset()).toBe(800);
  });

  it('al cerrarse el teclado vuelve a cero', () => {
    reportVisibleHeight(2000);
    reportVisibleHeight(1200);
    reportVisibleHeight(2000);
    expect(keyboardInset()).toBe(0);
  });

  it('el alto de referencia es el mayor visto, aunque la primera medida llegue con teclado', () => {
    reportVisibleHeight(1200);   // arranque con el teclado ya abierto
    reportVisibleHeight(2000);   // se cierra: esta es la pantalla completa
    reportVisibleHeight(1200);
    expect(keyboardInset()).toBe(800);
  });

  it('ignora medidas imposibles (0 o negativas)', () => {
    reportVisibleHeight(2000);
    reportVisibleHeight(0);
    reportVisibleHeight(-5);
    expect(keyboardInset()).toBe(0);
  });
});
