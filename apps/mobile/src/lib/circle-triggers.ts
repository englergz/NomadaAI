// DISPARADORES AUTOMÁTICOS DE CÍRCULOS, conectados al recorrido.
//
// Hasta ahora un círculo solo se enteraba si alguien pulsaba «Pedir ayuda». Pero lo que el
// diseño promete es otra cosa: si entras en una zona de riesgo alto, te quedas quieto o te
// desvías, tu gente se entera sin que tengas que sacar el teléfono. Aquí se decide A QUÉ
// círculos avisar: solo a los que tienen ESE disparador encendido en TUS preferencias, y nunca
// a los que marcaste como «no compartir».
//
// Reglas que sostienen la confianza:
// - Sin cuenta no hay círculos: no se consulta nada.
// - Un mismo motivo no abre avisos en ráfaga: como mucho uno cada 10 minutos. El servidor,
//   además, reutiliza el aviso abierto de cada círculo.
// - Lo que abrió el recorrido lo cierra el recorrido: al terminarlo, los avisos automáticos
//   se cierran y su rastro se borra. El pánico NO: ese solo lo cierra «Estoy bien».
// - Nada de esto tumba el recorrido: cualquier fallo de red se ignora y se reintenta en la
//   siguiente ocasión.
import type { CircleEventKind, CircleTriggers } from '@nomadaai/shared';
import { DEFAULT_CIRCLE_TRIGGERS } from '@nomadaai/shared';

import { api } from '@/lib/api';
import { authToken, authUserId } from '@/lib/auth';
import { currentSharing, startSharing, stopSharing } from '@/lib/circle-sharing';

/** Motivos que el recorrido puede disparar solo (el pánico es siempre a mano). */
export type TripTrigger = Extract<CircleEventKind, keyof CircleTriggers>;

/** Separación mínima entre dos disparos del mismo motivo. */
export const TRIGGER_COOLDOWN_MS = 10 * 60 * 1000;

const ultimoDisparo = new Map<TripTrigger, number>();

/** ¿Toca disparar este motivo ahora? Separado para poder probar el freno sin red. */
export function puedeDisparar(motivo: TripTrigger, ahora: number = Date.now()): boolean {
  const antes = ultimoDisparo.get(motivo);
  return antes === undefined || ahora - antes >= TRIGGER_COOLDOWN_MS;
}

/** ¿Este círculo quiere enterarse de este motivo, según las preferencias de la persona? */
export function circuloQuiere(
  prefs: { triggers?: Partial<CircleTriggers>; share_mode?: string } | null | undefined,
  motivo: TripTrigger,
): boolean {
  if (!prefs || prefs.share_mode === 'never') return false;
  return !!(prefs.triggers?.[motivo] ?? DEFAULT_CIRCLE_TRIGGERS[motivo]);
}

/** Solo para pruebas: olvida los disparos recientes. */
export function _resetTriggersForTests(): void {
  ultimoDisparo.clear();
}

/**
 * El recorrido dice «pasó esto». Abre un aviso en cada círculo que lo quiera y empieza a
 * compartir con ellos. Devuelve a cuántos círculos avisó.
 */
export async function dispararCirculos(motivo: TripTrigger): Promise<number> {
  if (!authUserId() || !puedeDisparar(motivo)) return 0;
  ultimoDisparo.set(motivo, Date.now());
  try {
    const token = await authToken();
    if (!token) return 0;
    const auth = { token };
    const { circles } = await api.myCircles(auth);
    let avisados = 0;
    for (const circulo of circles) {
      try {
        const prefs = await api.circlePrefs(auth, circulo.id);
        if (!circuloQuiere(prefs, motivo)) continue;
        const ev = await api.openCircleEvent(auth, circulo.id, motivo);
        // Si ya había un aviso abierto (por ejemplo, un pánico), se respeta su motivo.
        await startSharing(circulo.id, ev.id, ev.reused ? ev.kind : motivo);
        avisados += 1;
      } catch { /* un círculo que falla no impide avisar a los demás */ }
    }
    return avisados;
  } catch {
    return 0;
  }
}

/**
 * Terminó el recorrido: se cierran los avisos que abrió él (riesgo, precaución, inactividad,
 * desvío) y su rastro se borra en el servidor. Un pánico abierto sigue hasta «Estoy bien».
 */
export async function cerrarAvisosDelRecorrido(): Promise<void> {
  const abiertos = (await currentSharing()).filter((s) => s.kind !== 'panico');
  if (!abiertos.length) return;
  const token = await authToken();
  for (const s of abiertos) {
    try {
      if (token) await api.closeCircleEvent({ token }, s.circleId, s.eventId);
    } catch { /* aunque falle, se deja de mandar: nadie debe compartir sin querer */ }
    await stopSharing(s.circleId);
  }
  ultimoDisparo.clear();
}
