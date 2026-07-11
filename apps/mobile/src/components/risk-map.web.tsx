// Mapa de la app de usuario — implementación WEB (maplibre-gl).
// La versión nativa (Android/iOS) vive en risk-map.tsx con la misma interfaz.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { baseStyle, baseTiles, CITIES, DEFAULT_CITY, RISK_FILL_COLOR, riskFillColor } from '@/constants/map';
// Glyphmap oficial de MaterialCommunityIcons (nombre → codepoint): iconos literales
// por categoría (gas-station, hospital-box, church…), nada de emojis.
import MCIGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import MCI from '@expo/vector-icons/MaterialCommunityIcons';
import * as Font from 'expo-font';

import { POI_ICON_DEFS, ROUTE_LEVEL_COLORS, segmentsFeatureCollection, vehicleTopSvg, type RiskMapProps } from './risk-map.types';

// B4: rasteriza cada glyph a una imagen PNG del mapa — SIN fondo (nada de círculo
// blanco): icono coloreado por categoría con halo blanco fino para que sea legible
// sobre el heatmap y el satelital.
async function addPoiIcons(map: maplibregl.Map) {
  const family = Object.keys(MCI.font)[0]; // 'material-community'
  try {
    await Font.loadAsync(MCI.font);
    await document.fonts.load(`44px ${family}`);
  } catch { /* si no carga, igual intentamos */ }
  const size = 56;
  const glyphs = MCIGlyphs as Record<string, number>;
  for (const [key, def] of Object.entries(POI_ICON_DEFS)) {
    const code = glyphs[def.glyph] ?? glyphs['map-marker'];
    if (!code) continue;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const ch = String.fromCodePoint(code);
    ctx.font = `44px ${family}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4.5;
    ctx.strokeText(ch, size / 2, size / 2);
    ctx.fillStyle = def.color;
    ctx.fillText(ch, size / 2, size / 2);
    if (!map.hasImage(`poi-${key}`)) {
      map.addImage(`poi-${key}`, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
    }
  }
}

// Expresión icon-image: match por categoría → poi-<cat>, con poi-default de respaldo.
const POI_ICON_IMAGE = [
  'match', ['get', 'category'],
  ...Object.keys(POI_ICON_DEFS).filter((k) => k !== 'default').flatMap((k) => [k, `poi-${k}`]),
  'poi-default',
] as const;

// Tamaño del icono según zoom: crece al acercarse (no se queda diminuto al hacer zoom).
const POI_ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 12, 0.65, 15, 0.95, 18, 1.35] as const;

export default function RiskMap({ dark, riskOn, riskData, userLocation, routes, destination, riskStyle, satellite, poisData, poisOn, poiCategoryLabel, focus, nav }: RiskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const vehMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehTypeRef = useRef<string | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  // El handler de click se registra una vez; el rótulo traducido llega por ref.
  const poiLabelRef = useRef(poiCategoryLabel);
  useEffect(() => { poiLabelRef.current = poiCategoryLabel; }, [poiCategoryLabel]);

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
    // Al cambiar la base (tema/satélite) MapLibre aborta los tiles en vuelo y emite
    // AbortError: es esperado y benigno; solo se registran los errores reales.
    map.on('error', (e) => {
      const msg = String(e?.error?.message ?? e?.error ?? '');
      if (!msg.includes('AbortError') && !msg.includes('aborted')) console.error('map:', e.error);
    });
    map.on('load', () => {
      map.addSource('risk', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // Grillas de riesgo (fill por celda) — sin bordes de línea.
      map.addLayer({
        id: 'risk-fill', type: 'fill', source: 'risk',
        paint: { 'fill-color': RISK_FILL_COLOR as never, 'fill-opacity': 0.25 },
      });
      // Lugares (POIs): iconos por categoría (B4). Las imágenes se rasterizan async;
      // al terminar se fuerza un repaint para que la capa las tome.
      const empty = { type: 'FeatureCollection', features: [] } as never;
      addPoiIcons(map).then(() => map.triggerRepaint()).catch(() => { /* capa sin iconos */ });
      map.addSource('pois', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'pois', type: 'symbol', source: 'pois',
        layout: {
          'icon-image': POI_ICON_IMAGE as never,
          'icon-size': POI_ICON_SIZE as never, // crece con el zoom, no queda diminuto
          'icon-allow-overlap': false,
        },
      });
      // Tocar un icono → popup con nombre y categoría (rótulo traducido vía prop).
      map.on('click', 'pois', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name?: string; category?: string };
        const cat = String(p.category ?? 'default');
        const label = poiLabelRef.current?.(cat) ?? cat;
        new maplibregl.Popup({ closeButton: false, offset: 14, maxWidth: '240px' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font: 600 13px system-ui; color:#17212c">${String(p.name ?? label)}</div>` +
            `<div style="font: 12px system-ui; color:#5b6773">${label}</div>`,
          )
          .addTo(map);
      });
      map.on('mouseenter', 'pois', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'pois', () => { map.getCanvas().style.cursor = ''; });
      // Rutas: directa (gris discontinua) debajo, segura (azul de marca) encima.
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
        paint: {
          // color POR TRAMO según nivel de riesgo (azul → ámbar → coral)
          'line-color': ['match', ['get', 'level'],
            'precaucion', ROUTE_LEVEL_COLORS.precaucion,
            'atencion', ROUTE_LEVEL_COLORS.atencion,
            ROUTE_LEVEL_COLORS.despejado] as never,
          'line-width': 5,
        },
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

  // Tema/satélite: cambia la base sin perder cámara ni capas. Si el mapa aún no terminó
  // de cargar (p. ej. los ajustes persistidos llegan antes del primer frame), se difiere.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('base') as maplibregl.RasterTileSource | undefined;
      if (src?.setTiles) src.setTiles(baseTiles(dark, satellite));
    };
    if (loadedRef.current) apply(); else map.once('load', apply);
  }, [dark, satellite]);

  // Capa Lugares (POIs): datos + visibilidad.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('pois') as maplibregl.GeoJSONSource | undefined;
      if (src && poisData) src.setData(poisData as never);
      if (map.getLayer('pois')) map.setLayoutProperty('pois', 'visibility', poisOn ? 'visible' : 'none');
    };
    if (loadedRef.current) apply(); else map.once('load', apply);
  }, [poisOn, poisData]);

  // Personalización del heatmap: paleta, intensidad y transparencia (Ajustes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !riskStyle) return;
    const apply = () => {
      if (!map.getLayer('risk-fill')) return;
      map.setPaintProperty('risk-fill', 'fill-color', riskFillColor(riskStyle.palette, riskStyle.intensity) as never);
      map.setPaintProperty('risk-fill', 'fill-opacity', riskStyle.opacity);
    };
    if (loadedRef.current) apply(); else map.once('load', apply);
  }, [riskStyle]);

  // Datos y visibilidad de la capa de riesgo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('risk') as maplibregl.GeoJSONSource | undefined;
      if (src && riskData) src.setData(riskData as never);
      if (map.getLayer('risk-fill')) map.setLayoutProperty('risk-fill', 'visibility', riskOn ? 'visible' : 'none');
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
        routes && routes.safe.length ? (segmentsFeatureCollection(routes) as never) : empty,
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

  // Encuadre externo (U3): vuela a la ciudad seleccionada.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({ center: focus.center, zoom: focus.zoom, duration: 1600 });
  }, [focus]);

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

  // Modo NAVEGACIÓN (recorrido activo): vehículo cenital rotado al rumbo y cámara
  // inclinada que sigue (estilo navegador). Al terminar, vuelve la vista plana.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (nav?.active && userLocation) {
      markerRef.current?.remove(); markerRef.current = null; // el punto azul cede al vehículo
      if (!vehMarkerRef.current || vehTypeRef.current !== (nav.vehicle ?? 'car')) {
        vehMarkerRef.current?.remove();
        const el = document.createElement('div');
        el.innerHTML = vehicleTopSvg(nav.vehicle);
        vehTypeRef.current = nav.vehicle ?? 'car';
        // pitchAlignment 'map': el sprite se ACUESTA sobre el plano del mapa — con
        // la cámara inclinada se ve en perspectiva (efecto 3D estilo Uber).
        vehMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
          .setLngLat(userLocation).addTo(map);
      } else {
        vehMarkerRef.current.setLngLat(userLocation);
      }
      if (nav.heading != null) vehMarkerRef.current.setRotation(nav.heading);
      // Seguimiento CONTINUO: duración ≈ intervalo del GPS (~1 s) y easing lineal
      // → el mapa fluye con el vehículo en vez de dar saltitos.
      map.easeTo({
        center: userLocation,
        bearing: nav.heading ?? map.getBearing(),
        pitch: 55,
        zoom: Math.max(map.getZoom(), 16.5),
        duration: 1000,
        easing: (x) => x,
      });
    } else if (vehMarkerRef.current) {
      vehMarkerRef.current.remove(); vehMarkerRef.current = null; vehTypeRef.current = null;
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    }
  }, [nav?.active, nav?.heading, nav?.vehicle, userLocation]);

  // Ubicación del usuario: marcador + flyTo la primera vez (fuera de navegación).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || nav?.active) return;
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:16px;height:16px;border-radius:50%;background:#2f81f7;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)';
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat(userLocation).addTo(map);
      map.flyTo({ center: userLocation, zoom: 15, duration: 1800 });
    } else {
      markerRef.current.setLngLat(userLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, nav?.active]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
