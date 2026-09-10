// NOVEDADES: se muestra una vez, al abrir la app tras una actualización por aire.
// El contenido vive en constants/changelog.ts (la entrada [0] es la versión actual).
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CHANGELOG } from '@/constants/changelog';
import BaseSheet from '@/components/base-sheet';
import { Colors, Radii } from '@/constants/theme';
import { useDateLocale, useLang, useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

export default function WhatsNewSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const locale = useDateLocale();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const entry = CHANGELOG[0];
  if (!entry) return null;
  const date = new Date(`${entry.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <BaseSheet visible={visible} onClose={onClose} maxHeightPct={0.8} sheetStyle={{ gap: 8 }}>
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
    </BaseSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800' },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  cta: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
});
