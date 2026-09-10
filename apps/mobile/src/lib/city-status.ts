// ESTADO DE CADA CIUDAD DEL CATÁLOGO, dicho por el servidor y no por una lista fija.
//
//   disponible   → tiene capa de riesgo Y red vial: rutas seguras, recorrido, alertas.
//   próximamente → tiene capa de riesgo pero aún no red vial: se puede elegir, con
//                  aviso honesto (recorrido libre y avisos en zona, sin rutas).
//   no disponible → está en el catálogo para que el usuario la encuentre, pero el
//                  servidor no publica nada: no se puede seleccionar.
//
// Las listas vienen de GET /risk/cities y GET /route/cities. Abrir una ciudad nueva
// es dejar sus datos en el backend; el cliente no cambia.
import { CITIES, type CityKey, type CountryCode } from '@/constants/map';

export type CityStatus = 'available' | 'soon' | 'unavailable';

export function cityStatus(
  key: CityKey, riskCities: readonly string[], routeCities: readonly string[],
): CityStatus {
  if (!riskCities.includes(key)) return 'unavailable';
  return routeCities.includes(key) ? 'available' : 'soon';
}

/** Quita tildes y pasa a minúsculas para comparar («Bogotá» = «bogota»). */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function citiesOfCountry(country: CountryCode): CityKey[] {
  return (Object.keys(CITIES) as CityKey[]).filter((k) => CITIES[k].country === country);
}

export function searchCities(query: string): CityKey[] {
  const q = normalize(query);
  const all = Object.keys(CITIES) as CityKey[];
  if (!q) return all;
  return all.filter((k) => normalize(CITIES[k].label).includes(q) || k.includes(q));
}

/** Orden de presentación: disponibles primero, luego próximamente, luego el resto; alfabético dentro. */
export function sortByStatus(
  keys: CityKey[], riskCities: readonly string[], routeCities: readonly string[],
): CityKey[] {
  const rank: Record<CityStatus, number> = { available: 0, soon: 1, unavailable: 2 };
  return [...keys].sort((a, b) => {
    const ra = rank[cityStatus(a, riskCities, routeCities)];
    const rb = rank[cityStatus(b, riskCities, routeCities)];
    return ra !== rb ? ra - rb : CITIES[a].label.localeCompare(CITIES[b].label);
  });
}
