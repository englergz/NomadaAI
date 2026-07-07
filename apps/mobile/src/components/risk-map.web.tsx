// Mapa de la app de usuario — implementación WEB (maplibre-gl).
// La versión nativa (Android/iOS) vive en risk-map.tsx con la misma interfaz.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { baseStyle, CITIES, DEFAULT_CITY, RISK_FILL_COLOR, RISK_LINE_COLOR } from '@/constants/map';
import type { RiskMapProps } from './risk-map.types';

export default function RiskMap({ dark, riskOn, riskData, userLocation, routes, destination }: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const city = CITIES[DEFAULT_CITY];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(dark) as never,
      center: city.center,
      zoom: city.zoom,
      attributionControl: { compact: true } as never,
    });
    map.on('load', () => {
      map.addSource('risk', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'risk-fill', type: 'fill', source: 'risk',
        paint: { 'fill-color': RISK_FILL_COLOR as never },
      });
      map.addLayer({
        id: 'risk-line', type: 'line', source: 'risk',
        paint: { 'line-color': RISK_LINE_COLOR, 'line-width': 0.5 },
      });
      // Rutas: directa (gris discontinua) debajo, segura (azul de marca) encima.
      const empty = { type: 'FeatureCollection', features: [] } as never;
      map.addSource('route-direct', { type: 'geojson', data: empty });
      map.addSource('route-safe', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'route-direct', type: 'line', source: 'route-direct',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#8a97a5', 'line-width': 4, 'line-dasharray': [1.2, 1.6], 'line-opacity': 0.85 },
      });
      map.addLayer({
        id: 'route-safe', type: 'line', source: 'route-safe',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2f81f7', 'line-width': 5 },
      });
      loadedRef.current = true;
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __map?: maplibregl.Map }).__map = map; // solo para depurar en dev
    }
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; };
    // El tema se aplica en el efecto de abajo sin recrear el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tema: cambia la base sin perder cámara ni capas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource('base') as maplibregl.RasterTileSource | undefined;
    if (src?.setTiles) src.setTiles((baseStyle(dark).sources.base.tiles as string[]));
  }, [dark]);

  // Datos y visibilidad de la capa de riesgo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('risk') as maplibregl.GeoJSONSource | undefined;
      if (src && riskData) src.setData(riskData as never);
      for (const id of ['risk-fill', 'risk-line']) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', riskOn ? 'visible' : 'none');
      }
    };
    if (loadedRef.current) apply(); else map.once('load', apply);
  }, [riskOn, riskData]);

  // Rutas segura/directa: pinta y encuadra ambas.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const line = (coords: [number, number][]) =>
        ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }) as never;
      const empty = { type: 'FeatureCollection', features: [] } as never;
      (map.getSource('route-safe') as maplibregl.GeoJSONSource | undefined)?.setData(
        routes && routes.safe.length ? line(routes.safe as [number, number][]) : empty,
      );
      (map.getSource('route-direct') as maplibregl.GeoJSONSource | undefined)?.setData(
        routes && routes.direct.length ? line(routes.direct as [number, number][]) : empty,
      );
      if (routes && routes.safe.length > 1) {
        const b = new maplibregl.LngLatBounds();
        for (const p of [...routes.safe, ...routes.direct]) b.extend(p as [number, number]);
        map.fitBounds(b, { padding: { top: 90, bottom: 240, left: 40, right: 40 }, duration: 1200 });
      }
    };
    if (loadedRef.current) apply(); else map.once('load', apply);
  }, [routes]);

  // Marcador de destino.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (destination) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new maplibregl.Marker({ color: '#2f81f7' }).setLngLat(destination).addTo(map);
      } else {
        destMarkerRef.current.setLngLat(destination);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [destination]);

  // Ubicación del usuario: marcador + flyTo la primera vez.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#2f81f7;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)';
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat(userLocation).addTo(map);
      map.flyTo({ center: userLocation, zoom: 15, duration: 1800 });
    } else {
      markerRef.current.setLngLat(userLocation);
    }
  }, [userLocation]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
