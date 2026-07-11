// Mapa de la app de usuario — implementación NATIVA (Android/iOS) con MapLibre Native.
// Requiere un development build (npx expo run:android / run:ios o EAS); en Expo Go
// el módulo nativo no existe y se muestra un aviso en su lugar.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { baseStyle, CITIES, DEFAULT_CITY, riskFillColor } from '@/constants/map';
import { POI_CIRCLE_COLOR, POI_EMOJI_FIELD, ROUTE_LEVEL_COLORS, segmentsFeatureCollection, type RiskMapProps } from './risk-map.types';

// Carga perezosa: si el módulo nativo no está (Expo Go), no reventamos el bundle.
let ML: typeof import('@maplibre/maplibre-react-native') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ML = require('@maplibre/maplibre-react-native');
} catch {
  ML = null;
}

// Vehículo cenital nativo (Views): cuerpo por tipo + parabrisas claro al frente.
// Con `trackUserLocation="course"` el mapa rota, pero el marcador NO, así que lo
// rotamos al rumbo aquí. La ligera inclinación (rotateX) le da aire 3D con el pitch.
const VEH_STYLE: Record<string, { w: number; h: number; body: string; glass: string }> = {
  moto: { w: 16, h: 30, body: '#f97316', glass: '#111827' },
  car: { w: 24, h: 36, body: '#1f2937', glass: '#9cd2ff' },
  bus: { w: 26, h: 40, body: '#2563eb', glass: '#cfe5ff' },
  truck: { w: 26, h: 40, body: '#374151', glass: '#cbd5e1' },
};
function VehicleSprite({ type, heading = 0 }: { type: string | null; heading?: number }) {
  const v = VEH_STYLE[(type ?? 'car')] ?? VEH_STYLE.car;
  return (
    <View style={{ transform: [{ perspective: 320 }, { rotateX: '48deg' }, { rotate: `${heading}deg` }] }}>
      <View
        style={{
          width: v.w, height: v.h, borderRadius: v.w * 0.42,
          backgroundColor: v.body, borderWidth: 2, borderColor: '#fff', alignItems: 'center', paddingTop: 5,
          shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 3 },
        }}
      >
        <View style={{ width: v.w * 0.6, height: 7, borderRadius: 3, backgroundColor: v.glass }} />
      </View>
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

  // v11 renombró MarkerView → Marker (por eso el vehículo nunca cargaba y caía al
  // punto azul). Usamos Marker con prop `lngLat` y un hijo (el sprite del vehículo).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Map, Camera, GeoJSONSource, Layer, Marker } = ML as typeof ML & { Marker?: any };
  const navOn = !!nav?.active && !!userLocation;
  return (
    <Map style={styles.map} mapStyle={style as never}>
      {/* API v11: props `centerCoordinate`/`zoomLevel` (antes usaba `center`/`zoom`,
          que la librería IGNORA — por eso el cambio de ciudad no movía la cámara).
          En navegación, `trackUserLocation="course"` hace que MapLibre siga al
          usuario y ROTE el mapa según el movimiento de forma NATIVA y fluida
          (sin animar a mano ni cancelar teselas). minZoom evita cargar el mundo. */}
      <Camera
        initialViewState={{ center: city.center, zoom: city.zoom } as never}
        minZoom={9}
        {...(navOn
          ? ({ trackUserLocation: 'course', pitch: 50, followZoomLevel: 16.5 } as Record<string, unknown>)
          : ({
              centerCoordinate: focus?.center ?? userLocation ?? city.center,
              zoomLevel: focus?.zoom ?? (userLocation ? 15 : city.zoom),
              pitch: 0,
              animationMode: 'flyTo',
              animationDuration: 1400,
            } as Record<string, unknown>))}
      />
      {riskData && riskOn && (
        <GeoJSONSource id="risk" data={riskData as never}>
          <Layer
            id="risk-fill"
            type="fill"
            paint={{
              'fill-color': riskFillColor(riskStyle?.palette ?? 'semaforo', riskStyle?.intensity ?? 0.5) as never,
              'fill-opacity': riskStyle?.opacity ?? 0.25,
            }}
          />
          {/* Sin bordes de celda (risk-line): superficie continua, como en la web. */}
        </GeoJSONSource>
      )}
      {poisData && poisOn && (
        <GeoJSONSource id="pois" data={poisData as never}>
          {/* Círculo de fondo blanco + emoji de categoría encima: aproxima los
              iconos de la web (el canvas del navegador no existe en nativo). */}
          <Layer
            id="pois-bg"
            type="circle"
            paint={{
              'circle-radius': 11,
              'circle-color': '#ffffff',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': POI_CIRCLE_COLOR as never,
            }}
          />
          <Layer
            id="pois"
            type="symbol"
            layout={{
              'text-field': POI_EMOJI_FIELD as never,
              'text-size': 15,
              'text-allow-overlap': false,
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
      {/* En navegación: vehículo cenital (Marker con lngLat); si no, punto azul */}
      {navOn && Marker ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Marker {...({ lngLat: userLocation } as any)}>
          <VehicleSprite type={nav?.vehicle ?? null} heading={nav?.heading ?? 0} />
        </Marker>
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
