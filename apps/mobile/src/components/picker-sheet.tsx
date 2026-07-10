// Selector genérico en hoja modal (lista + búsqueda opcional): lo usan la
// nacionalidad (países) y la fecha de nacimiento (día/mes/año) del perfil.
// Mismo lenguaje visual que el resto de hojas (B3 + Radii).
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii } from '@/constants/theme';
import { useResolvedScheme } from '@/lib/settings';

export default function PickerSheet({
  visible, title, options, selected, onSelect, onClose, searchable = false, searchPlaceholder = '',
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [q, setQ] = useState('');
  useEffect(() => { if (!visible) setQ(''); }, [visible]);

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = q.trim() ? options.filter((o) => norm(o).includes(norm(q))) : options;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {searchable && (
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={searchPlaceholder}
            placeholderTextColor={c.textSecondary}
            style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.backgroundSelected }]}
          />
        )}
        <FlatList
          data={shown}
          keyExtractor={(o) => o}
          style={{ maxHeight: 340 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={24}
          renderItem={({ item }) => {
            const on = item === selected;
            return (
              <Pressable
                onPress={() => { onSelect(item); onClose(); }}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed || on ? c.backgroundSelected : 'transparent' }]}
              >
                <Text style={{ color: on ? c.accent : c.text, fontSize: 14, fontWeight: on ? '700' : '400' }}>{item}</Text>
                {on && <Ionicons name="checkmark" size={16} color={c.accent} />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    marginTop: 'auto',
    borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  search: { borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: 14, paddingVertical: 9, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10,
  },
});
