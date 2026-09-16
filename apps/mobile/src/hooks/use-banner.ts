// BANNER de estado del mapa: un solo aviso a la vez, arriba, bajo el chip de ciudad.
// Los banners NO se quedan pegados: se auto-descartan según su categoría (info/ok
// breve, advertencias más tiempo, coral = alerta persiste un poco más) y siempre
// traen ✕ para cerrarlos a mano (eso lo pinta la vista).
//
// Detrás hay una COLA por importancia (`lib/banner-queue`): un aviso trivial ya no borra
// una alerta de riesgo sin leer, espera su turno. La interfaz de este hook no cambia:
// `setBanner(aviso)` para mostrar y `setBanner(null)` para cerrar y pasar al siguiente.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { empujar, siguiente, VACIO, type Banner, type BannerTone, type EstadoBanners } from '@/lib/banner-queue';

export type { Banner, BannerTone };

const DISMISS_MS: Record<BannerTone, number> = { ok: 6000, info: 6000, warn: 10000, coral: 15000 };

export function useBanner() {
  const [estado, setEstado] = useState<EstadoBanners>(VACIO);
  const banner = estado.actual;

  // Acepta el aviso directo o la forma actualizadora —`setBanner(b => …)`, que usa el
  // cambio de ciudad para retirar SU propio aviso de carga solo si sigue en pantalla—.
  const setBanner = useCallback<Dispatch<SetStateAction<Banner | null>>>((accion) => {
    setEstado((previo) => {
      const aviso = typeof accion === 'function' ? accion(previo.actual) : accion;
      if (aviso === previo.actual) return previo;   // el actualizador no cambió nada
      return empujar(previo, aviso);
    });
  }, []);

  useEffect(() => {
    if (!banner) return;
    const reloj = setTimeout(() => setEstado((previo) => siguiente(previo)), DISMISS_MS[banner.tone]);
    return () => clearTimeout(reloj);
  }, [banner]);

  return { banner, setBanner };
}
