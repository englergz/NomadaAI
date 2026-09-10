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
import { useEffect, useRef, useState } from 'react';
import type { RiskZonesResponse } from '@nomadaai/shared';

import { CITIES, DEFAULT_CITY, SERVED_CITIES, type CityKey } from '@/constants/map';
import { api } from '@/lib/api';
import { markBootReady } from '@/lib/boot';
import type { Translate } from '@/lib/i18n';
import type { Banner } from '@/hooks/use-banner';

export interface UseCityArgs {
  t: Translate;
  setBanner: (b: Banner | null) => void;
  setFocus: (f: { center: [number, number]; zoom: number } | null) => void;
  /** Capa Lugares activada en Ajustes (se carga la primera vez que se enciende). */
  poisOn: boolean;
  /** Se llama ANTES de cambiar de ciudad: parar el viaje y limpiar destino/ruta/búsqueda. */
  onBeforeSwitch: () => void;
}

export function useCity({ t, setBanner, setFocus, poisOn, onBeforeSwitch }: UseCityArgs) {
  const [city, setCity] = useState<CityKey>(DEFAULT_CITY);
  const [showCity, setShowCity] = useState(false);
  const [citySuggest, setCitySuggest] = useState<CityKey | null>(null); // «¿Estás en X?»

  const [routeCities, setRouteCities] = useState<string[]>([DEFAULT_CITY]);
  // Ciudades con capa de riesgo publicada: alimenta el selector por país y la
  // sugerencia «¿Estás en X?» (solo se sugiere lo que el servidor sirve).
  const [riskCities, setRiskCities] = useState<string[]>([...SERVED_CITIES]);
  useEffect(() => {
    // Si la consulta falla se conserva el valor por defecto: sin red no se promete de más.
    api.routeCities()
      .then((r) => { if (r?.cities?.length) setRouteCities(r.cities); })
      .catch(() => {});
    api.riskCities()
      .then((r) => { if (r?.cities?.length) setRiskCities(r.cities); })
      .catch(() => {});
  }, []);
  const riskCitiesRef = useRef(riskCities);
  useEffect(() => { riskCitiesRef.current = riskCities; }, [riskCities]);

  const canRoute = routeCities.includes(city);  // buscar destino y trazar ruta segura
  const canPredict = city === DEFAULT_CITY;     // alerta anticipada sin destino
  const cityFull = canRoute;                    // compatibilidad con el resto de la vista

  // Capa de riesgo POR CIUDAD (U3): al cambiar de ciudad se recarga la malla.
  const [riskData, setRiskData] = useState<RiskZonesResponse | null>(null);
  const riskRef = useRef<RiskZonesResponse | null>(null);
  useEffect(() => { riskRef.current = riskData; }, [riskData]);
  useEffect(() => {
    let alive = true;
    // La carga de la capa se ve: el usuario entiende por qué el mapa aún no
    // muestra el riesgo, en vez de quedarse mirando un mapa vacío sin explicación.
    if (alive) setBanner({ text: t('map.banner.loadingRisk'), tone: 'info' });
    api.riskZones(undefined, city)
      .then((d) => { if (alive) { setRiskData(d); setBanner(null); } })
      .catch(() => {
        // Sin riesgo no bloqueamos el mapa, pero el usuario debe saberlo (estado de error).
        if (alive) setBanner({ text: t('map.banner.riskLoadError'), tone: 'warn' });
      })
      .finally(() => markBootReady('risk')); // el splash espera este paso
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Capa Lugares: se carga la primera vez que se activa en Ajustes.
  // Los POIs del backend son de Tumaco; en otras ciudades la capa no aplica.
  const [poisData, setPoisData] = useState<RiskZonesResponse | null>(null);
  useEffect(() => {
    if (!poisOn || poisData || city !== DEFAULT_CITY) return;
    let alive = true;
    api.pois(500)
      .then((d) => { if (alive) setPoisData(d as RiskZonesResponse); })
      .catch(() => { /* sin POIs la capa queda vacía */ });
    return () => { alive = false; };
  }, [poisOn, poisData, city]);

  // Cambio de ciudad: encuadra, limpia el viaje en curso y es honesto con lo disponible.
  function switchCity(k: CityKey) {
    if (k === city) return;
    onBeforeSwitch();
    setCity(k);
    setCitySuggest(null);
    setFocus({ center: CITIES[k].center, zoom: CITIES[k].zoom });
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
