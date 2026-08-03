// «¿Cómo funciona?» — el MISMO contenido que la web, desde @nomadaai/shared.
// Aquí solo vive la presentación nativa; el texto no se reescribe (si se edita,
// se edita en packages/shared/src/help.ts y cambia en las dos superficies).
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { helpFor, HELP_LEAD } from '@nomadaai/shared';

import { Colors, Radii } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

export default function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sections = helpFor('mobile');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.backgroundElement, borderColor: c.border, maxHeight: height * 0.9, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('help.title')}</Text>

        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 12 }}>
          <Text style={{ color: c.textSecondary, fontSize: 13.5, lineHeight: 20 }}>{HELP_LEAD}</Text>

          {sections.map((sec) => (
            <View key={sec.title} style={{ gap: 9 }}>
              <Text style={[styles.section, { color: c.text }]}>{sec.title}</Text>
              {sec.items.map((it) => (
                <Text key={it.body} style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
                  {it.term ? <Text style={{ color: c.text, fontWeight: '700' }}>{it.term}: </Text> : null}
                  {it.body}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('settings.done')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    marginTop: 'auto', borderWidth: 1, borderBottomWidth: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10, gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  section: { fontSize: 14.5, fontWeight: '700' },
  close: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center' },
});
