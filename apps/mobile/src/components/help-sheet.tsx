// «¿Cómo funciona?» — el MISMO contenido que la web, desde @nomadaai/shared.
// Aquí solo vive la presentación nativa; el texto no se reescribe (si se edita,
// se edita en packages/shared/src/help.ts y cambia en las dos superficies).
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { helpFor, HELP_LEAD } from '@nomadaai/shared';

import BaseSheet from '@/components/base-sheet';
import { Colors, Radii } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

export default function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const sections = helpFor('mobile');

  return (
    <BaseSheet visible={visible} onClose={onClose} sheetStyle={{ gap: 12 }}>
        <Text style={[styles.title, { color: c.text }]}>{t('help.title')}</Text>

        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 12 }}>
          <Text style={{ color: c.textSecondary, fontSize: 13.5, lineHeight: 20 }}>{HELP_LEAD}</Text>

          {sections.map((sec) => (
            <View key={sec.title} style={{ gap: 9 }}>
              <Text style={[styles.section, { color: c.accent }]}>{sec.title}</Text>
              {sec.items.map((it) => (
                <Text key={it.body} style={{ color: c.text, fontSize: 13, lineHeight: 20 }}>
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
    </BaseSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800' },
  // Igual que .help-modal h3 en el escritorio: es lo que separa secciones de cuerpo.
  section: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  close: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center' },
});
