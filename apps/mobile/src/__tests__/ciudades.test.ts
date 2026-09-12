// Estado de cada ciudad del catálogo: lo dice el SERVIDOR (riesgo + red vial), no
// una lista fija en el cliente. Si esto se rompe, o se promete cobertura que no
// existe o se esconde una ciudad que ya funciona.
import { CITIES, SERVED_CITIES, type CityKey } from '@/constants/map';
import { citiesOfCountry, cityStatus, normalize, searchCities, sortByStatus } from '@/lib/city-status';
// geocode importa el cliente HTTP (env de Expo, ESM): aquí solo interesa la geometría.
jest.mock('@/lib/api', () => ({ api: {}, baseUrl: '' }));
import { coverageCity } from '@/lib/geocode';

const RISK = ['tumaco', 'cali', 'pasto'];   // pasto: riesgo publicado, aún sin red vial
const ROUTE = ['tumaco', 'cali'];

describe('estado por ciudad', () => {
  it('disponible = riesgo + red vial; próximamente = solo riesgo; el resto no disponible', () => {
    expect(cityStatus('tumaco', RISK, ROUTE)).toBe('available');
    expect(cityStatus('cali', RISK, ROUTE)).toBe('available');
    expect(cityStatus('pasto', RISK, ROUTE)).toBe('soon');
    expect(cityStatus('bogota', RISK, ROUTE)).toBe('unavailable');
  });

  it('con red vial pero sin riesgo NO es disponible (el ruteo pesa aristas con la capa de riesgo)', () => {
    expect(cityStatus('bogota', ['tumaco'], ['tumaco', 'bogota'])).toBe('unavailable');
  });

  it('ordena disponibles → próximamente → no disponibles, alfabético dentro de cada grupo', () => {
    const out = sortByStatus(citiesOfCountry('CO'), RISK, ROUTE);
    expect(out.slice(0, 2)).toEqual(['cali', 'tumaco']);
    expect(out[2]).toBe('pasto');
    const rest = out.slice(3).map((k) => CITIES[k].label);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
  });
});

describe('catálogo por país y búsqueda', () => {
  it('cada país lista solo sus ciudades', () => {
    for (const k of citiesOfCountry('EC')) expect(CITIES[k].country).toBe('EC');
    expect(citiesOfCountry('CO')).toContain('tumaco');
    expect(citiesOfCountry('CO')).not.toContain('quito');
  });

  it('la búsqueda ignora tildes y mayúsculas', () => {
    expect(normalize('Bogotá')).toBe('bogota');
    expect(searchCities('BOGOTA')).toEqual(['bogota']);
    expect(searchCities('medell')).toEqual(['medellin']);
    expect(searchCities('')).toHaveLength(Object.keys(CITIES).length);
    expect(searchCities('xyz')).toEqual([]);
  });
});

describe('sugerencia «¿Estás en X?»', () => {
  it('solo sugiere ciudades que el servidor publica, aunque el catálogo tenga más', () => {
    const bogota = CITIES.bogota.center;
    // Bogotá está en el catálogo pero no la sirve el backend: nada que sugerir.
    expect(coverageCity(bogota, 40, SERVED_CITIES)).toBeNull();
    // Si el servidor la publica, sí.
    expect(coverageCity(bogota, 40, ['tumaco', 'bogota'] as CityKey[])).toBe('bogota');
    // Tumaco sigue sugiriéndose con la lista por defecto.
    expect(coverageCity(CITIES.tumaco.center)).toBe('tumaco');
  });
});

describe('catálogo ampliable desde el servidor', () => {
  it('una ciudad nueva del servidor aparece en su país y en la búsqueda, sin publicar app', () => {
    const { registerCities, CITIES, cityDef } = jest.requireActual('@/constants/map');
    expect(CITIES.manizales).toBeUndefined();
    const changed = registerCities([
      { key: 'manizales', label: 'Manizales', country: 'CO', center: [-75.514, 5.07], zoom: 12 },
    ]);
    expect(changed).toBe(true);
    expect(citiesOfCountry('CO')).toContain('manizales');
    expect(searchCities('maniza')).toEqual(['manizales']);
    expect(cityDef('manizales').center).toEqual([-75.514, 5.07]);
    // Estar en el catálogo NO da cobertura: sigue mandando lo que publica el servidor.
    expect(cityStatus('manizales', RISK, ROUTE)).toBe('unavailable');
  });

  it('registrar lo mismo dos veces no cambia nada, y una clave desconocida cae en la ciudad por defecto', () => {
    const { registerCities, cityDef } = jest.requireActual('@/constants/map');
    const city = { key: 'ipiales', label: 'Ipiales', country: 'CO', center: [-77.64, 0.83], zoom: 13 };
    expect(registerCities([city])).toBe(true);
    expect(registerCities([city])).toBe(false);
    expect(cityDef('no-existe').label).toBe('Tumaco');
  });
});
