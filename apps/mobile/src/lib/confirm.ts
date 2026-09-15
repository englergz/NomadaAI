// Diálogos que funcionan en Android, iOS y web.
//
// Por qué existe: react-native-web no implementa Alert.alert, que en el navegador no muestra
// nada. Un botón que dependiera de él no hacía nada en la versión web: así quedó «Borrar mis
// datos», que nunca pasaba de la confirmación. Aquí se decide una sola vez por plataforma.
import { Alert, Platform } from 'react-native';

/**
 * Confirmación previa a una acción destructiva: Alert nativo con el botón marcado como
 * destructivo; confirm() del navegador en web. `title` es opcional; sin él se usa la etiqueta
 * del botón de confirmar.
 */
export function confirmDestructive(
  message: string,
  confirmLabel: string,
  cancelLabel: string,
  onConfirm: () => void,
  title?: string,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(title ? `${title}\n\n${message}` : message)) onConfirm();
    return;
  }
  Alert.alert(title ?? confirmLabel, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Aviso informativo con un solo botón: Alert nativo; alert() del navegador en web. */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
