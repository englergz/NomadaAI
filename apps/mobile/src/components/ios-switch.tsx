// Switch tipo iOS (pista píldora + perilla que se desliza) — reutilizable en toda
// la app para no repetir el toggle ON/OFF. Animado, accesible.
import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/lib/settings';

export default function IOSSwitch({ value, onValueChange }: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [c.backgroundSelected, c.accent] });
  const knobX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <Pressable onPress={() => onValueChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Animated.View style={{ width: 46, height: 28, borderRadius: 999, backgroundColor: trackColor, justifyContent: 'center', borderWidth: 1, borderColor: value ? c.accent : c.border }}>
        <Animated.View
          style={{
            width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', transform: [{ translateX: knobX }],
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
