// Altura del teclado en vivo. Estaba escrito a mano dentro de map.tsx y hacía
// falta lo mismo en las hojas con campos de texto (reportar incidente), así que
// vive aquí UNA vez: cualquier pantalla que necesite subir su contenido lo usa.
//
// iOS avisa con «will» (antes de animar) y Android con «did» (después): usar el
// evento correcto en cada plataforma evita el salto visible del contenido.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setHeight(0),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
