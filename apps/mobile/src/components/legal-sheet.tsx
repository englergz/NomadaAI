// Términos y privacidad: lectura y ACEPTACIÓN.
//
// Dos modos en un solo componente, porque el texto es el mismo:
//   - `mode="accept"`: puerta de entrada. No se puede cerrar sin decidir y la
//     casilla NO viene premarcada (aceptar tiene que ser un acto del usuario).
//   - `mode="read"`: consulta desde Configuración, con botón de cerrar.
//
// El contenido vive en @nomadaai/shared: se escribe UNA vez para app y escritorio.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LEGAL_DOCS, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from '@nomadaai/shared';

import { Colors, Radii } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

export default function LegalSheet({
  visible, mode, onAccept, onClose,
}: {
  visible: boolean;
  mode: 'accept' | 'read';
  onAccept?: () => void;
  onClose?: () => void;
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [checked, setChecked] = useState(false); // nunca premarcada

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // En modo aceptación el botón atrás no puede saltarse la decisión.
      onRequestClose={mode === 'read' ? onClose : undefined}
    >
      {mode === 'read' && <Pressable style={styles.backdrop} onPress={onClose} />}
      {mode === 'accept' && <View style={styles.backdrop} />}

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: c.backgroundElement,
            borderColor: c.border,
            maxHeight: height * (mode === 'accept' ? 0.92 : 0.9),
            paddingBottom: insets.bottom + 14,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('legal.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 11.5 }}>
          {t('legal.version', { version: LEGAL_VERSION, date: LEGAL_EFFECTIVE_DATE })}
        </Text>

        <ScrollView contentContainerStyle={{ gap: 20, paddingVertical: 8 }}>
          {LEGAL_DOCS.map((doc) => (
            <View key={doc.id} style={{ gap: 10 }}>
              <Text style={[styles.docTitle, { color: c.text }]}>{doc.title}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{doc.intro}</Text>
              {doc.blocks.map((b) => (
                <View key={b.title} style={{ gap: 4 }}>
                  <Text style={[styles.blockTitle, { color: c.accent }]}>{b.title}</Text>
                  <Text style={{ color: c.text, fontSize: 13, lineHeight: 20 }}>{b.body}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

        {mode === 'accept' ? (
          <>
            <Pressable onPress={() => setChecked((v) => !v)} style={styles.checkRow}>
              <View
                style={[
                  styles.check,
                  { borderColor: checked ? c.accent : c.border, backgroundColor: checked ? c.accent : 'transparent' },
                ]}
              >
                {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={{ color: c.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{t('legal.check')}</Text>
            </Pressable>

            <Pressable
              onPress={onAccept}
              disabled={!checked}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: c.accent, opacity: !checked ? 0.4 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.ctaText}>{t('legal.accept')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.ctaText}>{t('settings.done')}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    marginTop: 'auto', borderWidth: 1, borderBottomWidth: 0,
    borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 20, paddingTop: 10, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  docTitle: { fontSize: 15, fontWeight: '800' },
  blockTitle: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 6 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cta: { borderRadius: Radii.pill, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
