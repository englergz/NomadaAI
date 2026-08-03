// ACTUALIZACIONES POR AIRE (OTA) — expo-updates.
// Permite corregir la parte JS (pantallas, textos, lógica, diseño) sin volver a
// publicar el APK. Lo que toca código NATIVO (permisos, módulos, splash) SÍ exige
// una build nueva: por eso runtimeVersion usa la política `fingerprint`, que
// invalida sola las actualizaciones cuando lo nativo cambia.
//
// REGLA DE SEGURIDAD DEL PRODUCTO: nunca se recarga la app en mitad de un
// recorrido. Una actualización que reinicia la interfaz mientras alguien navega
// por una zona de riesgo es exactamente lo que no puede pasar; se descarga y se
// aplica en el siguiente arranque en frío.
import * as Updates from 'expo-updates';

export interface OtaResult {
  /** Hay una actualización descargada y lista para el próximo arranque. */
  pending: boolean;
  error?: string;
}

/**
 * Busca y descarga una actualización. NO recarga la app: devuelve si quedó una
 * pendiente para que la interfaz pueda avisar («Novedades disponibles»).
 */
export async function checkForUpdate(): Promise<OtaResult> {
  // En desarrollo el módulo está deshabilitado a propósito (Metro manda).
  if (__DEV__ || !Updates.isEnabled) return { pending: false };
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { pending: false };
    await Updates.fetchUpdateAsync();
    return { pending: true };
  } catch (e) {
    return { pending: false, error: String(e) };
  }
}

/**
 * Aplica la actualización descargada reiniciando la app. Quien llame DEBE
 * comprobar antes que no hay un recorrido en curso.
 */
export async function applyUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch { /* si falla, se aplicará sola en el próximo arranque en frío */ }
}

/** Identificador de la versión en ejecución (útil para soporte y BI). */
export function currentUpdateId(): string | null {
  return Updates.updateId ?? null;
}
