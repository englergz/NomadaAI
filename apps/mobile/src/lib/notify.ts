// Avisos de seguridad: canal de ALTA importancia, vibración y entrega inmediata.
// Un aviso de riesgo que llega silencioso o tarde no sirve para nada, así que:
// - Android: canal propio con importancia MAX y patrón de vibración (un canal
//   normal se agrupa y puede silenciarse; la importancia se fija AL CREARLO y el
//   sistema no deja subirla después, por eso el canal es dedicado).
// - iOS: `interruptionLevel: 'timeSensitive'` para que atraviese el resumen y los
//   modos de concentración.
// - En primer plano se muestran igual (por defecto iOS las oculta si la app está
//   abierta) y además vibra el teléfono: en moto no se mira la pantalla.
import { Platform, Vibration } from 'react-native';

import type { AlertLevel } from '@/lib/alerts';

export const ALERT_CHANNEL = 'nomadaai-alerts';

/** Patrón por nivel: «atención» insiste más que «precaución». */
const PATTERN: Record<string, number[]> = {
  atencion: [0, 320, 140, 320],
  precaucion: [0, 200],
};

let ready = false;

/**
 * Prepara canal y presentación. Idempotente: se puede llamar en cada arranque y
 * al pedir el permiso, sin coste.
 */
export async function setupAlerts(): Promise<void> {
  if (Platform.OS === 'web' || ready) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // `shouldShowAlert` quedó obsoleto en SDK 57 → banner + lista por separado.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
        name: 'Alertas de seguridad',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: PATTERN.atencion,
        lightColor: '#2F81F7',
        bypassDnd: false, // se respeta «No molestar»: avisamos, no invadimos
      });
    }
    ready = true;
  } catch { /* sin módulo de notificaciones seguimos con los banners in-app */ }
}

/**
 * Aviso de riesgo. `level` decide la insistencia; el banner in-app ya se mostró,
 * esto es para cuando la pantalla está apagada o el usuario está en otra app.
 */
export async function notifyAlert(title: string, body: string, level: AlertLevel = 'precaucion'): Promise<void> {
  if (Platform.OS === 'web') return;
  const pattern = PATTERN[level] ?? PATTERN.precaucion;
  // La vibración va SIEMPRE, aunque la notificación falle o esté silenciada.
  try { Vibration.vibrate(pattern); } catch { /* sin vibrador */ }
  try {
    await setupAlerts();
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        vibrate: pattern,
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: level === 'atencion' ? 'timeSensitive' : 'active',
        ...(Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : null),
      },
      trigger: null, // inmediata: una alerta de seguridad no se programa
    });
  } catch { /* el banner in-app y la vibración ya cumplieron */ }
}
