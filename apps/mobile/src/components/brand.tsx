// Wordmark de marca: «Nómada» + «.AI» SIEMPRE en azul de marca, tipografía Sora
// (Google Fonts, OFL — geométrica, simple y diferencial; se carga en _layout).
// Regla de marca: usar este componente en todo lugar donde aparezca el nombre solo.
import { Image, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

export const BRAND_FONT = 'Sora_700Bold';

export default function BrandWordmark({
  size = 14, color, withLogo = false, halo,
}: {
  size?: number;
  color: string;      // color de «Nómada» según el tema
  withLogo?: boolean; // icono de la app a la izquierda
  halo?: string;      // sombra suave para flotar SIN relleno sobre el mapa
}) {
  // RN 0.86: textShadow como propiedad única (los textShadow* están deprecados);
  // los tipos aún no la declaran, el runtime sí la acepta.
  const haloStyle = halo
    ? ({ textShadow: `0px 1px 6px ${halo}` } as unknown as import('react-native').TextStyle)
    : null;
  return (
    <View style={styles.row}>
      {withLogo && (
        <Image
          source={require('@/assets/images/icon.png')}
          style={{
            width: size * 1.5, height: size * 1.5, borderRadius: size * 0.4,
            ...(halo ? { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : null),
          }}
        />
      )}
      {/* El «.» es un punto REDONDO real (View), no el glifo cuadrado de la fuente —
          el mismo punto del mapa y del splash: consistencia en toda la marca. */}
      <View style={styles.wordRow}>
        <Text style={[{ fontFamily: BRAND_FONT, fontSize: size, color, letterSpacing: 0.2 }, haloStyle]}>
          Nómada
        </Text>
        <View
          style={{
            width: size * 0.24, height: size * 0.24, borderRadius: 999,
            backgroundColor: Brand.accent, marginHorizontal: size * 0.14, marginBottom: size * 0.12,
          }}
        />
        <Text style={[{ fontFamily: BRAND_FONT, fontSize: size, color: Brand.accent, letterSpacing: 0.2 }, haloStyle]}>
          AI
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wordRow: { flexDirection: 'row', alignItems: 'baseline' },
});
