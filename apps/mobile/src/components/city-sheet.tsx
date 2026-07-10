// Selector de CIUDAD (U3, estilo inDrive): lista las ciudades con superficie de
// riesgo publicada (/risk/cities ∩ ciudades con coordenadas conocidas) y es honesto
// con las capacidades: hoy solo Tumaco tiene predicción y rutas; el resto, capa de riesgo.
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CITIES, DEFAULT_CITY, type CityKey } from '@/constants/map';
import { Colors, Radii } from '@/constants/theme';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

export default function CitySheet({
  visible, current, onSelect, onClose,
}: {
  visible: boolean;
  current: CityKey;
  onSelect: (city: CityKey) => void;
  onClose: () => void;
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [available, setAvailable] = useState<CityKey[]>(Object.keys(CITIES) as CityKey[]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    api.riskCities()
      .then((r) => {
        // Solo ciudades que el servidor publica Y que sabemos encuadrar en el mapa.
        const known = (Object.keys(CITIES) as CityKey[]).filter((k) => r.cities.includes(k));
        if (alive && known.length) setAvailable(known);
      })
      .catch(() => { /* sin red usamos la lista local */ });
    return () => { alive = false; };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('city.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>{t('city.subtitle')}</Text>

        {available.map((k) => {
          const on = k === current;
          const full = k === DEFAULT_CITY; // solo Tumaco tiene pipeline completo hoy
          return (
            <Pressable
              key={k}
              onPress={() => { onSelect(k); onClose(); }}
              style={[styles.row, {
                borderColor: on ? c.accent : c.border,
                backgroundColor: on ? c.backgroundSelected : 'transparent',
              }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: on ? c.accent : c.text, fontSize: 15, fontWeight: '700' }}>
                  {CITIES[k].label}
                </Text>
                <Text style={{ color: c.textSecondary, fontSize: 11.5 }}>
                  {full ? t('city.full') : t('city.partial')}
                </Text>
              </View>
              {on && <Ionicons name="checkmark-circle" size={20} color={c.accent} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // B3: backdrop a pantalla completa (también detrás de las esquinas curvas de la hoja).
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    marginTop: 'auto',
    borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radii.control, paddingVertical: 12, paddingHorizontal: 14,
  },
});
