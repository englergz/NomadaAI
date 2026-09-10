// HOJA MODAL BASE (U7-ARCH): el andamiaje que las nueve hojas de la app repetían
// —Modal deslizante, fondo oscurecido que cierra al tocar, tarjeta pegada abajo con
// esquinas Radii.sheet y el asa— vive aquí UNA vez. Cada hoja pone solo su contenido.
//
// Lo que varía entre hojas se pasa por props y conserva el valor que cada una tenía:
//   · `dismissible=false`  → puerta legal: ni el fondo ni el botón atrás la cierran.
//   · `backdropOpacity`    → 0.45 por defecto (legal 0.55, privacidad 0.5).
//   · `maxHeightPct`       → tope respecto a la pantalla; `null` = sin tope.
//   · `sheetStyle`         → relleno inferior, separación, margen por teclado…
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii } from '@/constants/theme';
import { useResolvedScheme } from '@/lib/settings';

export interface BaseSheetProps {
  visible: boolean;
  onClose?: () => void;
  /** Si es false, ni el fondo ni «atrás» cierran la hoja (decisiones obligatorias). */
  dismissible?: boolean;
  backdropOpacity?: number;
  /** Fracción de la altura de pantalla; `null` para no acotar. */
  maxHeightPct?: number | null;
  sheetStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export default function BaseSheet({
  visible, onClose, dismissible = true, backdropOpacity = 0.45, maxHeightPct = 0.9, sheetStyle, children,
}: BaseSheetProps) {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const close = dismissible ? onClose : undefined;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* B3: el fondo cubre TODA la pantalla (también detrás de las esquinas curvas). */}
      <Pressable style={[styles.backdrop, { backgroundColor: `rgba(0,0,0,${backdropOpacity})` }]} onPress={close} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.backgroundElement, borderColor: c.border, paddingBottom: insets.bottom + 16 },
          maxHeightPct !== null ? { maxHeight: winH * maxHeightPct } : null,
          sheetStyle,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    marginTop: 'auto',
    borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
});
