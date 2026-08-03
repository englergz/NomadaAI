// Estado de arranque con marca. Existe para que NINGUNA ruta pueda quedarse en
// blanco mientras resuelve algo (almacenamiento, sesión): un vacío sin salida es
// el peor fallo posible de arranque, y ya nos pasó con el retorno de Google.
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import BrandWordmark from '@/components/brand';
import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/lib/settings';

export default function BootScreen() {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <BrandWordmark size={20} color={c.text} withLogo />
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
