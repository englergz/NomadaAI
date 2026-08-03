// Selector de PROTECCIÓN estilo «control de volumen». Paridad con la barra del
// escritorio (apps/web ProtectionBar): MISMOS niveles (los define el panel admin
// vía GET /config/app), MISMA rampa azul→morado y la misma geometría de riel
// interior que dejó los topes y el pulgar SIEMPRE dentro del redondeado.
//
// El contrato (niveles por defecto, colores, λ) vive en @nomadaai/shared para no
// volver a arreglar lo mismo dos veces en cada plataforma.
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_PROTECTION_LEVELS, protectionColor } from '@nomadaai/shared';

import { Colors, Radii } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

/** Radio del pulgar: define el riel interior (por eso nada se sale del redondeado). */
const THUMB_R = 14;

export default function ProtectionSlider({
  value, onChange, levels = DEFAULT_PROTECTION_LEVELS, disabled = false,
}: {
  value: number;                 // índice del nivel activo
  onChange: (v: number) => void;
  levels?: number[];             // porcentajes configurables (panel admin)
  disabled?: boolean;
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const stops = Math.max(2, levels.length);
  const [trackW, setTrackW] = useState(0);
  const anim = useRef(new Animated.Value(value)).current;
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  // Si el admin cambia los niveles, el índice puede quedar fuera de rango.
  useEffect(() => {
    if (value > stops - 1) onChange(stops - 1);
  }, [stops, value, onChange]);

  useEffect(() => {
    Animated.spring(anim, { toValue: value, useNativeDriver: false, friction: 7, tension: 90 }).start();
  }, [value, anim]);

  // Toque/arrastre → tope más cercano. El ancho útil es el RIEL interior: la pista
  // menos un radio de pulgar en cada extremo.
  const usable = Math.max(0, trackW - THUMB_R * 2);
  const pick = (x: number) => {
    if (trackW <= 0 || disabled) return;
    const frac = Math.max(0, Math.min(1, (x - THUMB_R) / (usable || 1)));
    const v = Math.round(frac * (stops - 1));
    if (v !== valueRef.current) onChange(v);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    }),
  ).current;

  const thumbLeft = anim.interpolate({
    inputRange: [0, stops - 1],
    outputRange: [THUMB_R - 14, THUMB_R + usable - 14],
  });
  const fillW = anim.interpolate({
    inputRange: [0, stops - 1],
    outputRange: [THUMB_R, THUMB_R + usable],
  });
  const color = protectionColor(value, stops);

  return (
    <View style={[styles.wrap, disabled && styles.off]}>
      <View style={styles.labels}>
        <Text style={[styles.edge, { color: c.textSecondary }]}>{t('map.prio.min')}</Text>
        <Text style={[styles.mid, { color: c.text }]}>{t('map.priority')}</Text>
        <Text style={[styles.edge, { color: c.textSecondary }]}>{t('map.prio.max')}</Text>
      </View>

      <View
        style={[styles.track, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...(disabled ? {} : pan.panHandlers)}
      >
        <Animated.View style={[styles.fill, { width: fillW, backgroundColor: color }]} />
        {Array.from({ length: stops }).map((_, i) => {
          const left = THUMB_R + (usable * i) / (stops - 1) - 3;
          return (
            <Pressable
              key={i}
              onPress={() => !disabled && onChange(i)}
              hitSlop={16}
              style={[styles.stop, { left, backgroundColor: i <= value ? '#fff' : c.border }]}
            />
          );
        })}
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { left: thumbLeft, borderColor: color, backgroundColor: c.backgroundElement }]}
        >
          <View style={[styles.thumbCore, { backgroundColor: color }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  off: { opacity: 0.5 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  edge: { fontSize: 11, fontWeight: '600', flexShrink: 0 },
  mid: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, flexShrink: 0 },
  track: { height: 30, borderRadius: Radii.pill, borderWidth: 1, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: Radii.pill, opacity: 0.28 },
  stop: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  thumbCore: { width: 11, height: 11, borderRadius: 6 },
});
