// Selector de PROTECCIÓN estilo «control de volumen» (reemplaza los 3 chips de
// palabras largas): pista con relleno degradado azul→ámbar→coral, 3 topes marcados
// y un pulgar que se desliza (arrastre o toque). «Protección» al medio, «Mínima» y
// «Máxima» en los extremos. Default = centro (Equilibrada). Acorde a la paleta.
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radii } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

const STOPS = 3;

export default function ProtectionSlider({
  value, onChange,
}: {
  value: number;              // 0 | 1 | 2
  onChange: (v: number) => void;
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [trackW, setTrackW] = useState(0);
  const anim = useRef(new Animated.Value(value)).current;
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    Animated.spring(anim, { toValue: value, useNativeDriver: false, friction: 7, tension: 90 }).start();
  }, [value, anim]);

  // Toque/arrastre → tope más cercano (0..2). Ancho útil = pista menos el pulgar.
  const PAD = 15; // radio del pulgar
  const pick = (x: number) => {
    if (trackW <= 0) return;
    const usable = trackW - PAD * 2;
    const frac = Math.max(0, Math.min(1, (x - PAD) / usable));
    const v = Math.round(frac * (STOPS - 1));
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

  const usable = Math.max(0, trackW - PAD * 2);
  const thumbLeft = anim.interpolate({
    inputRange: [0, STOPS - 1],
    outputRange: [PAD - 14, PAD + usable - 14],
  });
  const fillW = anim.interpolate({
    inputRange: [0, STOPS - 1],
    outputRange: [PAD, PAD + usable],
  });
  const stopColors = [c.accent, c.amber, c.coral];

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={[styles.edge, { color: c.textSecondary }]}>{t('map.prio.min')}</Text>
        <Text style={[styles.mid, { color: c.text }]}>{t('map.priority')}</Text>
        <Text style={[styles.edge, { color: c.textSecondary }]}>{t('map.prio.max')}</Text>
      </View>

      <View
        style={[styles.track, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        {/* relleno hasta el pulgar */}
        <Animated.View style={[styles.fill, { width: fillW, backgroundColor: stopColors[value] }]} />
        {/* topes */}
        {Array.from({ length: STOPS }).map((_, i) => {
          const left = PAD + (usable * i) / (STOPS - 1) - 3;
          return (
            <Pressable
              key={i}
              onPress={() => onChange(i)}
              hitSlop={16}
              style={[styles.stop, { left, backgroundColor: i <= value ? '#fff' : c.border }]}
            />
          );
        })}
        {/* pulgar */}
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { left: thumbLeft, borderColor: stopColors[value], backgroundColor: c.backgroundElement }]}
        >
          <View style={[styles.thumbCore, { backgroundColor: stopColors[value] }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  edge: { fontSize: 11, fontWeight: '600' },
  mid: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  track: {
    height: 30, borderRadius: Radii.pill, borderWidth: 1, justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: Radii.pill, opacity: 0.28 },
  stop: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  thumbCore: { width: 11, height: 11, borderRadius: 6 },
});
