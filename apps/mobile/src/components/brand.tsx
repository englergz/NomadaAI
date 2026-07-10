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
      <Text style={[{ fontFamily: BRAND_FONT, fontSize: size, color, letterSpacing: 0.2 }, haloStyle]}>
        Nómada<Text style={{ color: Brand.accent }}>.AI</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
