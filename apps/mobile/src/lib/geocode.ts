// Búsqueda de destino: POIs del propio backend (rápido, curado) + Nominatim (OSM)
// acotado al bbox de la ciudad activa. Sin API keys.
import type { Coordinate, GeoJSONFeature } from '@nomadaai/shared';

import { CITIES, type CityKey } from '@/constants/map';
import { api } from '@/lib/api';

export interface Place {
  name: string;
  detail: string;      // categoría o dirección corta
  coord: Coordinate;   // [lon, lat]
  source: 'poi' | 'osm';
}

// bbox aproximado ~6 km alrededor del centro de la ciudad.
function cityBBox(city: CityKey): [number, number, number, number] {
  const [lon, lat] = CITIES[city].center;
  const d = 0.055;
  return [lon - d, lat - d, lon + d, lat + d];
}

let poisCache: Place[] | null = null;

export async function loadPois(): Promise<Place[]> {
  if (poisCache) return poisCache;
  const fc = await api.pois(500);
  const out: Place[] = [];
  for (const f of (fc.features ?? []) as GeoJSONFeature[]) {
    const g = f.geometry as { type: string; coordinates: Coordinate };
    const p = f.properties as { name?: string; category?: string };
    if (g?.type !== 'Point' || !p?.name) continue;
    out.push({ name: p.name, detail: p.category ?? 'lugar', coord: g.coordinates, source: 'poi' });
  }
  poisCache = out;
  return out;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export async function searchPlaces(query: string, city: CityKey): Promise<Place[]> {
  const q = norm(query.trim());
  if (q.length < 2) return [];

  // 1) POIs locales del backend.
  let pois: Place[] = [];
  try {
    pois = (await loadPois()).filter((p) => norm(p.name).includes(q)).slice(0, 6);
  } catch { /* sin POIs seguimos con OSM */ }

  // 2) Nominatim (OSM): direcciones y lugares. Se añade la ciudad a la consulta y el
  // viewbox como preferencia (sin bounded, que descartaba direcciones); luego se
  // filtra por cercanía real a la ciudad para no traer resultados de otro país.
  let osm: Place[] = [];
  try {
    const [w, s, e, n] = cityBBox(city);
    const cityName = CITIES[city].label;
    const q2 = norm(query).includes(norm(cityName)) ? query : `${query}, ${cityName}`;
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=co` +
      `&viewbox=${w},${n},${e},${s}&q=${encodeURIComponent(q2)}`;
    const res = await fetch(url, { headers: { 'accept-language': 'es' } });
    if (res.ok) {
      const rows = (await res.json()) as { display_name: string; lon: string; lat: string; type?: string }[];
      osm = rows
        .map((r) => ({
          name: r.display_name.split(',')[0],
          detail: r.display_name.split(',').slice(1, 3).join(',').trim() || (r.type ?? 'lugar'),
          coord: [Number(r.lon), Number(r.lat)] as Coordinate,
          source: 'osm' as const,
        }))
        .filter((p) => distM(p.coord, CITIES[city].center) < 25000)
        .slice(0, 5);
    }
  } catch { /* red o rate-limit: devolvemos lo local */ }

  // Merge sin duplicados obvios (mismo nombre normalizado).
  const seen = new Set(pois.map((p) => norm(p.name)));
  return [...pois, ...osm.filter((p) => !seen.has(norm(p.name)))].slice(0, 8);
}

// Rumbo geográfico a→b en grados (0 = norte, horario).
export function bearingDeg(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const dLon = (b[0] - a[0]) * rad;
  const y = Math.sin(dLon) * Math.cos(b[1] * rad);
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad)
    - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dLon);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

// Distancia haversine (m).
export function distM(a: Coordinate, b: Coordinate): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Cobertura: ciudad soportada más cercana a menos de `maxKm`, o null si está fuera.
export function coverageCity(loc: Coordinate, maxKm = 40): CityKey | null {
  let best: { c: CityKey; d: number } | null = null;
  for (const key of Object.keys(CITIES) as CityKey[]) {
    const d = distM(loc, CITIES[key].center) / 1000;
    if (!best || d < best.d) best = { c: key, d };
  }
  return best && best.d <= maxKm ? best.c : null;
}
