// ¿ALGUIEN DE MIS CÍRCULOS ESTÁ PIDIENDO AYUDA?
//
// Círculos vivía escondido en Configuración: si tu mamá pedía ayuda, no había nada en la
// pantalla principal que te lo dijera. Este hook alimenta el botón de Círculos del mapa con un
// punto rojo cuando alguien de tus círculos tiene un aviso abierto.
//
// Cómo, y con qué límites:
// - Solo con sesión (los círculos son de cuentas) y solo con la app en pantalla: se consulta
//   cada 45 s, que es lo que cuesta poco y basta para notarlo al mirar el teléfono.
// - Tus propios avisos no cuentan: ya sabes que pediste ayuda.
// - Con la app cerrada esto no llega; eso necesita push desde el servidor (pendiente).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api';
import { authToken, authUserId } from '@/lib/auth';
import { currentSharing } from '@/lib/circle-sharing';

export const CIRCLE_ALERT_POLL_MS = 45_000;

/**
 * Cuántos avisos abiertos hay que NO son tuyos. Pura, para poder probarla: recibe cuántos
 * abiertos tiene cada círculo y en qué círculos estás compartiendo tú.
 */
export function avisosAjenos(
  circulos: { id: number; open_events: number }[],
  compartiendoEn: number[],
): number {
  return circulos.reduce((total, c) => {
    const propios = compartiendoEn.includes(c.id) ? 1 : 0;
    return total + Math.max(0, c.open_events - propios);
  }, 0);
}

export function useCircleAlerts(): number {
  const [ajenos, setAjenos] = useState(0);
  useEffect(() => {
    let alive = true;
    const consultar = async () => {
      if (!authUserId() || AppState.currentState !== 'active') { if (alive) setAjenos(0); return; }
      try {
        const token = await authToken();
        if (!token) return;
        const { circles } = await api.myCircles({ token });
        const mios = (await currentSharing()).map((s) => s.circleId);
        if (alive) setAjenos(avisosAjenos(circles, mios));
      } catch { /* sin red: se conserva lo último conocido */ }
    };
    void consultar();
    const reloj = setInterval(() => { void consultar(); }, CIRCLE_ALERT_POLL_MS);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void consultar(); });
    return () => { alive = false; clearInterval(reloj); sub.remove(); };
  }, []);
  return ajenos;
}
