// ALTO REAL DEL TECLADO, MEDIDO.
//
// Por qué existe: en Android el evento del teclado llega con altura 0 (la ventana se
// redimensiona sola, así que el sistema no la reporta) y las hojas de la app viven en
// un `Modal`, cuya ventana NO se redimensiona. Resultado verificado en el emulador: la
// hoja de reportar se dibujaba por debajo del teclado y el botón de enviar quedaba
// tapado mientras se escribía.
//
// La pantalla principal SÍ se encoge cuando aparece el teclado. Aquí se apunta su alto
// visible: el mayor visto es el alto sin teclado y la diferencia con el actual es lo que
// ocupa el teclado. Sin dependencias nativas nuevas: añadir una cambiaría la huella de
// compilación y la app dejaría de poder actualizarse por OTA.
//
// La app es solo vertical (`orientation: portrait`), así que el alto de referencia no
// cambia por girar el teléfono.
import { useEffect, useState } from 'react';

let baseline = 0;
let current = 0;
const listeners = new Set<(inset: number) => void>();

function computed(): number {
  if (!baseline || !current) return 0;
  return Math.max(0, Math.round(baseline - current));
}

/** La pantalla principal reporta su alto visible (en cada `onLayout`). */
export function reportVisibleHeight(height: number): void {
  if (!(height > 0)) return;
  const before = computed();
  if (height > baseline) baseline = height;
  current = height;
  const after = computed();
  if (after !== before) listeners.forEach((notify) => notify(after));
}

/** Lo que ocupa el teclado ahora mismo, sin React (lo usa el hook y las pruebas). */
export function keyboardInset(): number {
  return computed();
}

/** Lo que ocupa el teclado ahora mismo; 0 si no hay teclado. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(keyboardInset);
  useEffect(() => {
    listeners.add(setInset);
    setInset(computed());
    return () => { listeners.delete(setInset); };
  }, []);
  return inset;
}

/** Solo para pruebas: olvida lo medido. */
export function _resetKeyboardInsetForTests(): void {
  baseline = 0;
  current = 0;
}
