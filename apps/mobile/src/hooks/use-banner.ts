// BANNER de estado del mapa: un solo aviso a la vez, arriba, bajo el chip de ciudad.
// Los banners NO se quedan pegados: se auto-descartan según su categoría (info/ok
// breve, advertencias más tiempo, coral = alerta persiste un poco más) y siempre
// traen ✕ para cerrarlos a mano (eso lo pinta la vista).
import { useEffect, useState } from 'react';

export type BannerTone = 'ok' | 'warn' | 'info' | 'coral';
export interface Banner { text: string; tone: BannerTone }

const DISMISS_MS: Record<BannerTone, number> = { ok: 6000, info: 6000, warn: 10000, coral: 15000 };

export function useBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  useEffect(() => {
    if (!banner) return;
    const t2 = setTimeout(() => setBanner(null), DISMISS_MS[banner.tone]);
    return () => clearTimeout(t2);
  }, [banner]);
  return { banner, setBanner };
}
