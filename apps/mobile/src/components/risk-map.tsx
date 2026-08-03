// Mapa de la app de usuario — implementación NATIVA (Android/iOS) con MapLibre Native.
// Requiere un development build (npx expo run:android / run:ios o EAS); en Expo Go
// el módulo nativo no existe y se muestra un aviso en su lugar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { baseStyle, CITIES, DEFAULT_CITY, riskFillColor } from '@/constants/map';
import { POI_CIRCLE_COLOR, ROUTE_LEVEL_COLORS, segmentsFeatureCollection, type RiskMapProps } from './risk-map.types';
import { VehicleSpriteView } from './vehicle-sprite';

// Carga perezosa: si el módulo nativo no está (Expo Go), no reventamos el bundle.
let ML: typeof import('@maplibre/maplibre-react-native') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ML = require('@maplibre/maplibre-react-native');
} catch {
  ML = null;
}

// Vehículo ilustrado (SVG estilo Uber/Rappi). La cámara nativa rota el mapa, pero no
// el marcador, así que lo rotamos al rumbo aquí; la leve inclinación le da aire 3D.
function VehicleSprite({ type, heading = 0 }: { type: string | null; heading?: number }) {
  return (
    <View style={{ transform: [{ perspective: 500 }, { rotateX: '32deg' }, { rotate: `${heading}deg` }] }}>
      <VehicleSpriteView type={type} />
    </View>
  );
}

/**
 * FLUIDEZ EN CAMPO: el GPS entrega una posición por segundo, así que pintar cada
 * fijación tal cual hace que el vehículo SALTE. Aquí se interpola entre la
 * anterior y la nueva para que se DESLICE.
 *
 * Vive en su propio componente a propósito: la animación cambia estado ~25 veces
 * por segundo y así solo se repinta el marcador, no el mapa entero con sus capas.
 */
function SmoothVehicleMarker({
  Marker, target, type, heading, ms = 1000,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Marker: any;
  target: [number, number];
  type: string | null;
  heading: number;
  ms?: number;
}) {
  const [pos, setPos] = useState<[number, number]>(target);
  const posRef = useRef<[number, number]>(target);
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const from = posRef.current;
    const to = target;
    // Un salto enorme (cambio de ciudad, primer fix) no se anima: se teletransporta.
    const jump = Math.abs(to[0] - from[0]) > 0.02 || Math.abs(to[1] - from[1]) > 0.02;
    if (jump) {
      posRef.current = to; setPos(to);
      return;
    }
    const start = Date.now();
    if (rafRef.current) clearInterval(rafRef.current);
    rafRef.current = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / ms);
      const e = k * (2 - k); // easeOut: entra rápido y asienta suave
      const next: [number, number] = [
        from[0] + (to[0] - from[0]) * e,
        from[1] + (to[1] - from[1]) * e,
      ];
      posRef.current = next;
      setPos(next);
      if (k >= 1 && rafRef.current) { clearInterval(rafRef.current); rafRef.current = null; }
    }, 40); // ~25 fps: suficiente para que se vea continuo sin castigar el puente
    return () => { if (rafRef.current) { clearInterval(rafRef.current); rafRef.current = null; } };
    // Se depende de los VALORES, no del array: `target` se recrea en cada render y
    // reiniciaría la animación constantemente (el vehículo nunca llegaría).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target[0], target[1], ms]);

  return (
    <Marker {...({ lngLat: pos } as Record<string, unknown>)}>
      <VehicleSprite type={type} heading={heading} />
    </Marker>
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

  // Cámara IMPERATIVA (ref): las props declarativas de stop no re-aplicaban el
  // cambio de ciudad. flyTo/easeTo con `center`+`zoom` sí mueven la cámara.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  useEffect(() => {
    if (navOn || !focus) return;               // en navegación manda trackUserLocation
    // bearing:0 además de pitch:0 — al salir de navegación el mapa quedaba ROTADO
    // para siempre (trackUserLocation="course" lo gira y nadie lo devolvía al
    // norte): las etiquetas se leían al revés y la brújula quedaba torcida.
    cameraRef.current?.flyTo?.({
      center: focus.center, zoom: focus.zoom, pitch: 0, bearing: 0, duration: 1400,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, navOn]);

  return (
    <Map style={styles.map} mapStyle={style as never}>
      {/* En navegación, `trackUserLocation="course"` hace que MapLibre siga al
          usuario y ROTE el mapa según el movimiento de forma NATIVA y fluida.
          minZoom evita cargar teselas del mundo entero (menos cancelaciones). */}
      <Camera
        ref={cameraRef}
        initialViewState={{ center: city.center, zoom: city.zoom } as never}
        minZoom={9}
        {...(navOn
          ? ({ trackUserLocation: 'course', pitch: 50, followZoomLevel: 16.5 } as Record<string, unknown>)
          : {})}
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
        </GeoJSONSource>
      )}
      {poisData && poisOn && (
        // POIs como puntos de color por categoría (fiable en nativo; los iconos tipo
        // web requieren assets PNG registrados con <Images/> — pendiente U7-B).
        <GeoJSONSource id="pois" data={poisData as never}>
          <Layer
            id="pois-bg"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': POI_CIRCLE_COLOR as never,
              'circle-stroke-width': 1.6,
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
      {/* En navegación: vehículo cenital (Marker con lngLat); si no, punto azul */}
      {navOn && Marker && userLocation ? (
        <SmoothVehicleMarker
          Marker={Marker}
          target={userLocation as [number, number]}
          type={nav?.vehicle ?? null}
          heading={nav?.heading ?? 0}
        />
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
