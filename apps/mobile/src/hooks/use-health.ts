// ESTADO DEL SERVICIO: comprobación REAL de /health cada 60 s, con DIAGNÓSTICO
// (lib/connectivity): distingue «no tienes internet» de «somos nosotros los que
// fallamos» y de «la red va lenta». Antes todo era el mismo mensaje culpando al
// usuario, incluso cuando el caído era nuestro servidor.
//
// Alimenta el punto verde/coral del chip de ciudad; `onChange` se llama SOLO al
// cambiar de estado (no se repite el aviso cada minuto).
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { diagnose, messageKeyFor, type NetState } from '@/lib/connectivity';
import type { TKey } from '@/lib/i18n';

export function useHealth(onChange: (key: TKey, state: NetState) => void) {
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [netState, setNetState] = useState<NetState>('ok');
  const prevRef = useRef<NetState>('ok');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const d = await diagnose(async () => {
        await api.health();
        return 200;
      });
      if (!alive) return;
      setHealthOk(d.state === 'ok' || d.state === 'lento');
      const key = messageKeyFor(d.state);
      if (key && prevRef.current !== d.state) onChangeRef.current(key as TKey, d.state);
      prevRef.current = d.state;
      setNetState(d.state);
    };
    void check();
    const iv = setInterval(() => { void check(); }, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return { healthOk, netState };
}
