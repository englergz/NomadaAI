// OTA en la vista: la actualización descargada se AVISA con una tarjeta; solo se
// aplica a petición del usuario y nunca con un recorrido en curso (regla del
// producto). Novedades: una vez, en el primer arranque con una versión nueva.
import { useEffect, useState } from 'react';

import { shouldShowWhatsNew, subscribeUpdatePending } from '@/lib/ota';

export function useOta() {
  const [otaPending, setOtaPending] = useState(false);
  const [otaDismissed, setOtaDismissed] = useState(false);
  useEffect(() => subscribeUpdatePending(setOtaPending), []);
  const [showNews, setShowNews] = useState(false);
  useEffect(() => { shouldShowWhatsNew().then(setShowNews).catch(() => {}); }, []);
  return { otaPending, otaDismissed, setOtaDismissed, showNews, setShowNews };
}
