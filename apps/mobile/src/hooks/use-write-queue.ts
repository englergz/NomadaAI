// Vacía la cola de escrituras en los momentos en que suele volver la señal: al
// arrancar, al volver la app al frente y cuando el servicio pasa a responder.
// Avisa cuántos envíos pendientes salieron para que el usuario sepa que su
// reporte llegó, aunque lo hiciera sin señal.
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { NetState } from '@/lib/connectivity';
import { flush, subscribePending } from '@/lib/write-queue';

export function useWriteQueue(netState: NetState, onSent: (n: number) => void) {
  const [pending, setPending] = useState(0);
  useEffect(() => subscribePending(setPending), []);

  // El aviso se ata al COMPONENTE, no a esta pasada del efecto: el estado de red
  // puede parpadear (ok → sin-red → ok) mientras el envío está en vuelo, y si se
  // atara al efecto la limpieza silenciaría un envío que YA salió. El usuario
  // tiene que enterarse de que su reporte llegó.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;

  const online = netState === 'ok' || netState === 'lento';
  useEffect(() => {
    if (!online) return;
    const run = () => {
      flush()
        .then((r) => { if (mounted.current && r.sent > 0) onSentRef.current(r.sent); })
        .catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [online]);

  return { pending };
}
