// CIUDAD ACTIVA (U3): el mapa, la capa de riesgo y el buscador giran alrededor de ella.
//
// COBERTURA POR GRADOS (no un sí/no). Verificado contra el backend:
//   · riesgo   → todas las ciudades que publica /risk/cities (Cali tiene 4.268 celdas)
//   · ruteo    → donde hay red vial cargada. Lo dice el SERVIDOR (/route/cities), no una
//                lista aquí: abrir una ciudad nueva ya no exige publicar versión del
//                cliente, basta con dejar su red vial en el backend.
//   · predicción → solo donde hay trayectorias para entrenar (hoy Tumaco)
// El recorrido y las alertas EN ZONA solo necesitan riesgo + GPS, así que funcionan
// en cualquier ciudad con capa de riesgo; lo único que se pierde sin predicción es
// la anticipación cuando el usuario no declara destino. Ver docs/DISENO_FUTURO.md §1.
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { RiskZonesResponse } from '@nomadaai/shared';

import { cityDef, DEFAULT_CITY, registerCities, SERVED_CITIES, subscribeCities, type CityKey } from '@/constants/map';
import { api } from '@/lib/api';
import { markBootReady } from '@/lib/boot';
import { ageLabel, cachedFetch } from '@/lib/offline-cache';
import type { Lang, Translate } from '@/lib/i18n';
import type { Banner } from '@/hooks/use-banner';

export interface UseCityArgs {
  t: Translate;
  lang: Lang;
  setBanner: Dispatch<SetStateAction<Banner | null>>;
  setFocus: (f: { center: [number, number]; zoom: number } | null) => void;
  /** Capa Lugares activada en Ajustes (se carga la primera vez que se enciende). */
  poisOn: boolean;
  /** Se llama ANTES de cambiar de ciudad: parar el viaje y limpiar destino/ruta/búsqueda. */
  onBeforeSwitch: () => void;
  /** El servicio responde (lib/connectivity). Al volver la señal se refrescan ciudades y capa. */
  online: boolean;
}

export function useCity({ t, lang, setBanner, setFocus, poisOn, onBeforeSwitch, online }: UseCityArgs) {
  const [city, setCity] = useState<CityKey>(DEFAULT_CITY);
  const [showCity, setShowCity] = useState(false);
  const [citySuggest, setCitySuggest] = useState<CityKey | null>(null); // «¿Estás en X?»

  const [routeCities, setRouteCities] = useState<string[]>([DEFAULT_CITY]);
  // Ciudades con capa de riesgo publicada: alimenta el selector por país y la
  // sugerencia «¿Estás en X?» (solo se sugiere lo que el servidor sirve).
  const [riskCities, setRiskCities] = useState<string[]>([...SERVED_CITIES]);
  // CATÁLOGO del servidor: amplía las ciudades integradas sin publicar versión de
  // la app (lo edita el panel admin). Con copia local para que sobreviva sin red.
  const [, bumpCatalog] = useState(0);
  useEffect(() => subscribeCities(() => bumpCatalog((n) => n + 1)), []);
  useEffect(() => {
    if (!online) return;
    cachedFetch('cities-catalog', () => api.citiesCatalog())
      .then(({ data }) => { if (data?.cities?.length) registerCities(data.cities); })
      .catch(() => { /* sin catálogo quedan las integradas */ });
  }, [online]);

  useEffect(() => {
    // Si la consulta falla (ni red ni copia) se conserva el valor por defecto:
    // sin red no se promete de más. Con copia guardada, se usa la copia. Y cuando
    // la señal vuelve (`online` pasa a true) se vuelve a preguntar: un arranque sin
    // red no puede dejar a Cali «sin rutas» para siempre.
    if (!online) return;
    cachedFetch('route-cities', () => api.routeCities())
      .then(({ data: r }) => { if (r?.cities?.length) setRouteCities(r.cities); })
      .catch(() => {});
    cachedFetch('risk-cities', () => api.riskCities())
      .then(({ data: r }) => { if (r?.cities?.length) setRiskCities(r.cities); })
      .catch(() => {});
  }, [online]);
  const riskCitiesRef = useRef(riskCities);
  useEffect(() => { riskCitiesRef.current = riskCities; }, [riskCities]);

  const canRoute = routeCities.includes(city);  // buscar destino y trazar ruta segura
  const canPredict = city === DEFAULT_CITY;     // alerta anticipada sin destino
  const cityFull = canRoute;                    // compatibilidad con el resto de la vista

  // Capa de riesgo POR CIUDAD y POR HORA (U3): al cambiar de ciudad se recarga la
  // malla, y al cambiar la hora del día también. Antes no se enviaba la hora y el
  // servidor respondía siempre la de las 19:00: el mapa y las alertas en zona
  // evaluaban el riesgo de la noche aunque fueran las 9 de la mañana.
  const [riskData, setRiskData] = useState<RiskZonesResponse | null>(null);
  const riskRef = useRef<RiskZonesResponse | null>(null);
  useEffect(() => { riskRef.current = riskData; }, [riskData]);
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const iv = setInterval(() => {
      const h = new Date().getHours();
      setHour((prev) => (prev === h ? prev : h));
    }, 60000);
    return () => clearInterval(iv);
  }, []);
  // Si la capa vino de la copia, al volver la señal se vuelve a pedir la de verdad.
  const riskFromCacheRef = useRef(false);
  useEffect(() => {
    let alive = true;
    if (!online && riskData && !riskFromCacheRef.current) return; // sin red y con capa fresca: nada que hacer
    // La carga de la capa se ve: el usuario entiende por qué el mapa aún no
    // muestra el riesgo, en vez de quedarse mirando un mapa vacío sin explicación.
    if (alive) setBanner({ text: t('map.banner.loadingRisk'), tone: 'info' });
    // Red primero; sin red, la última capa guardada de esta ciudad (con aviso de
    // cuándo se descargó). Sin red ni copia: error visible, el mapa sigue.
    cachedFetch(`risk:${city}`, () => api.riskZones(undefined, city, hour))
      .then(({ data, fromCache, savedAt }) => {
        if (!alive) return;
        riskFromCacheRef.current = fromCache;
        setRiskData(data);
        if (fromCache) {
          setBanner({ text: t('map.banner.riskFromCache', { when: ageLabel(savedAt, Date.now(), lang) }), tone: 'warn' });
        } else {
          // Solo se retira el aviso de carga PROPIO: si mientras tanto otro módulo
          // avisó algo (p. ej. «se enviaron tus reportes pendientes»), se respeta.
          const loading = t('map.banner.loadingRisk');
          setBanner((b) => (b && b.text === loading ? null : b));
        }
      })
      .catch(() => {
        // Sin riesgo no bloqueamos el mapa, pero el usuario debe saberlo (estado de error).
        if (alive) setBanner({ text: t('map.banner.riskLoadError'), tone: 'warn' });
      })
      .finally(() => markBootReady('risk')); // el splash espera este paso
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, hour, online]);

  // Capa Lugares: se carga la primera vez que se activa en Ajustes.
  // Los POIs del backend son de Tumaco; en otras ciudades la capa no aplica.
  const [poisData, setPoisData] = useState<RiskZonesResponse | null>(null);
  useEffect(() => {
    if (!poisOn || poisData || city !== DEFAULT_CITY) return;
    let alive = true;
    cachedFetch('pois', () => api.pois(500))
      .then(({ data: d }) => { if (alive) setPoisData(d as RiskZonesResponse); })
      .catch(() => { /* sin POIs (ni copia) la capa queda vacía */ });
    return () => { alive = false; };
  }, [poisOn, poisData, city]);

  // Cambio de ciudad: encuadra, limpia el viaje en curso y es honesto con lo disponible.
  function switchCity(k: CityKey) {
    if (k === city) return;
    onBeforeSwitch();
    setCity(k);
    setCitySuggest(null);
    setFocus({ center: cityDef(k).center, zoom: cityDef(k).zoom });
    // La nota fija de la barra inferior ya explica lo disponible; sin banner duplicado.
    setBanner(null);
  }

  return {
    city, showCity, setShowCity, citySuggest, setCitySuggest,
    routeCities, riskCities, riskCitiesRef,
    canRoute, canPredict, cityFull,
    riskData, riskRef, poisData,
    switchCity,
  };
}
