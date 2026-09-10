// NOVEDADES: se muestra una vez, al abrir la app tras una actualización por aire.
// El contenido vive en constants/changelog.ts (la entrada [0] es la versión actual).
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { CHANGELOG } from '@/constants/changelog';
import { Colors, Radii } from '@/constants/theme';
import { useDateLocale, useLang, useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

export default function WhatsNewSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const locale = useDateLocale();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const entry = CHANGELOG[0];
  if (!entry) return null;
  const date = new Date(`${entry.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: winH * 0.8, paddingBottom: insets.bottom + 16, backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="sparkles-outline" size={18} color={c.accent} />
          <Text style={[styles.title, { color: c.text }]}>{t('news.title')}</Text>
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>{t('news.subtitle')} · {date}</Text>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10, paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
          {entry.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={[styles.bullet, { backgroundColor: c.accent }]} />
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{it[lang]}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.cta, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('news.ok')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    marginTop: 'auto',
    borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, gap: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  cta: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
});
