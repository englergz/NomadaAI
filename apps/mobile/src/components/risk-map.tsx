// Mapa de la app de usuario — implementación NATIVA (Android/iOS) con MapLibre Native.
// Requiere un development build (npx expo run:android / run:ios o EAS); en Expo Go
// el módulo nativo no existe y se muestra un aviso en su lugar.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { baseStyle, CITIES, DEFAULT_CITY, HEAT_PALETTES, riskFillColor } from '@/constants/map';
import { POI_CIRCLE_COLOR, ROUTE_LEVEL_COLORS, segmentsFeatureCollection, type RiskMapProps } from './risk-map.types';

// Carga perezosa: si el módulo nativo no está (Expo Go), no reventamos el bundle.
let ML: typeof import('@maplibre/maplibre-react-native') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ML = require('@maplibre/maplibre-react-native');
} catch {
  ML = null;
}

// Vehículo cenital nativo (Views, sin dependencias): cuerpo redondeado + parabrisas
// claro al frente. La cámara ya rota al rumbo, así que el sprite apunta ARRIBA.
function VehicleSprite({ type }: { type: string | null }) {
  const moto = (type ?? '') === 'moto';
  return (
    <View
      style={{
        width: moto ? 14 : 22, height: moto ? 30 : 34, borderRadius: moto ? 7 : 9,
        backgroundColor: moto ? '#f97316' : '#1f2937', borderWidth: 1.5, borderColor: '#fff',
        alignItems: 'center', paddingTop: 5,
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
      }}
    >
      <View style={{ width: moto ? 7 : 12, height: 7, borderRadius: 3, backgroundColor: moto ? '#111827' : '#9cd2ff' }} />
    </View>
  );
}

export default function RiskMap({ dark, riskOn, riskData, userLocation, routes, destination, riskStyle, satellite, poisData, poisOn, focus, nav }: RiskMapProps) {
  const c = Colors[dark ? 'dark' : 'light'];
  const style = useMemo(() => baseStyle(dark, satellite), [dark, satellite]);
  const city = CITIES[DEFAULT_CITY];

  if (!ML) {
    return (
      <View style={[styles.fallback, { backgroundColor: c.background }]}>
        <Text style={[styles.fallbackTitle, { color: c.text }]}>Mapa nativo no disponible</Text>
        <Text style={[styles.fallbackBody, { color: c.textSecondary }]}>
          Expo Go no incluye MapLibre Native. Usa un development build
          (npx expo run:android / run:ios) o la versión web.
        </Text>
      </View>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Map, Camera, GeoJSONSource, Layer, MarkerView } = ML as typeof ML & { MarkerView?: any };
  const navOn = !!nav?.active && !!userLocation;
  return (
    <Map style={styles.map} mapStyle={style as never}>
      <Camera
        initialViewState={{ center: city.center, zoom: city.zoom } as never}
        center={userLocation ?? focus?.center ?? undefined}
        zoom={navOn ? 16.5 : userLocation ? 15 : focus?.zoom}
        {...({ pitch: navOn ? 50 : 0, heading: navOn ? nav?.heading ?? 0 : 0 } as Record<string, number>)}
      />
      {riskData && riskOn && (
        <GeoJSONSource id="risk" data={riskData as never}>
          <Layer
            id="risk-fill"
            type="fill"
            paint={{
              'fill-color': riskFillColor(riskStyle?.palette ?? 'calor', riskStyle?.intensity ?? 0.5) as never,
              'fill-opacity': riskStyle?.opacity ?? 0.7,
            }}
          />
          <Layer
            id="risk-line"
            type="line"
            paint={{ 'line-color': HEAT_PALETTES[riskStyle?.palette ?? 'calor'].line, 'line-width': 0.5 }}
          />
        </GeoJSONSource>
      )}
      {poisData && poisOn && (
        <GeoJSONSource id="pois" data={poisData as never}>
          <Layer
            id="pois"
            type="circle"
            paint={{
              'circle-radius': 5,
              'circle-color': POI_CIRCLE_COLOR as never,
              'circle-stroke-width': 1.2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      )}
      {routes && routes.direct.length > 1 && (
        <GeoJSONSource
          id="route-direct"
          data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routes.direct }, properties: {} } as never}
        >
          <Layer
            id="route-direct"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#8a97a5', 'line-width': 4, 'line-dasharray': [1.2, 1.6], 'line-opacity': 0.85 }}
          />
        </GeoJSONSource>
      )}
      {routes && routes.safe.length > 1 && (
        <GeoJSONSource id="route-safe" data={segmentsFeatureCollection(routes) as never}>
          <Layer
            id="route-safe"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['match', ['get', 'level'],
                'precaucion', ROUTE_LEVEL_COLORS.precaucion,
                'atencion', ROUTE_LEVEL_COLORS.atencion,
                ROUTE_LEVEL_COLORS.despejado] as never,
              'line-width': 5,
            }}
          />
        </GeoJSONSource>
      )}
      {destination && (
        <GeoJSONSource
          id="dest"
          data={{ type: 'Feature', geometry: { type: 'Point', coordinates: destination }, properties: {} } as never}
        >
          <Layer
            id="dest-dot"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#2f81f7',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      )}
      {/* En navegación: vehículo cenital (si MarkerView existe); si no, punto azul */}
      {navOn && MarkerView ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <MarkerView {...({ coordinate: userLocation } as any)}>
          <VehicleSprite type={nav?.vehicle ?? null} />
        </MarkerView>
      ) : userLocation ? (
        <GeoJSONSource
          id="me"
          data={{ type: 'Feature', geometry: { type: 'Point', coordinates: userLocation }, properties: {} } as never}
        >
          <Layer
            id="me-dot"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': '#2f81f7',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </GeoJSONSource>
      ) : null}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  fallbackTitle: { fontSize: 16, fontWeight: '700' },
  fallbackBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
