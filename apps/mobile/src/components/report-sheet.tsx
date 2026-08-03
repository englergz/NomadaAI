// Reporte ciudadano de incidentes (Fase 4, participativo): tipo + descripción opcional;
// la ubicación es la del usuario (o el centro de la ciudad) y la hora se toma sola.
// Anti-abuso en cliente (cooldown) además del rate-limit del servidor.
// La foto llegará cuando el backend soporte adjuntos (Storage) — no se finge.
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { CITIES, DEFAULT_CITY, type CityKey } from '@/constants/map';
import { Colors, Radii } from '@/constants/theme';
import { api } from '@/lib/api';
import { authToken } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

// La clave viaja a la API en español (categorías del modelo); solo el rótulo se traduce.
// Cada categoría con un signo reconocible: el usuario elige de un vistazo, sin leer.
const CAT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'robo': 'bag-remove-outline',
  'atraco a mano armada': 'alert-circle-outline',
  'hurto de vehículo': 'car-outline',
  'riña': 'people-outline',
  'acoso': 'eye-off-outline',
  'presencia sospechosa': 'walk-outline',
  'iluminación dañada': 'bulb-outline',
  'vía en mal estado': 'construct-outline',
  'accidente de tránsito': 'warning-outline',
  'retén irregular': 'hand-left-outline',
  'otro': 'ellipsis-horizontal-circle-outline',
};

const CATEGORIES = [
  'robo', 'atraco a mano armada', 'hurto de vehículo', 'riña', 'acoso',
  'presencia sospechosa', 'iluminación dañada', 'vía en mal estado',
  'accidente de tránsito', 'retén irregular', 'otro',
] as const;

const COOLDOWN_MS = 3 * 60 * 1000; // 3 min entre reportes desde este dispositivo
const LAST_KEY = 'nomadaai_last_report';

export default function ReportSheet({
  visible, onClose, location, city = DEFAULT_CITY,
}: {
  visible: boolean;
  onClose: () => void;
  location: [number, number] | null; // [lon, lat] del usuario (o null → centro ciudad)
  city?: CityKey;                    // ciudad activa (U3): el reporte se asocia a ella
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function send() {
    if (!category || sending) return;
    setSending(true);
    setMsg(null);
    try {
      const last = Number((await AsyncStorage.getItem(LAST_KEY)) ?? 0);
      if (Date.now() - last < COOLDOWN_MS) {
        setMsg({ text: t('report.cooldown'), ok: false });
        return;
      }
      const [lon, lat] = location ?? CITIES[city].center;
      // U4: con sesión, el reporte viaja firmado (el backend verifica el token).
      const r = await api.reportIncident({
        lon, lat, category,
        description: description.trim() || undefined,
        city,
        hour: new Date().getHours(),
      }, await authToken());
      if (r.accepted) {
        await AsyncStorage.setItem(LAST_KEY, String(Date.now()));
        setMsg({ text: t('report.ok'), ok: true });
        setCategory(null); setDescription('');
      } else {
        setMsg({ text: r.note ?? t('report.rejected'), ok: false });
      }
    } catch {
      setMsg({ text: t('report.offline'), ok: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('report.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>{t('report.intro')}</Text>

        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const on = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(on ? null : cat)}
                style={[
                  styles.cat,
                  { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.backgroundSelected : 'transparent' },
                ]}
              >
                <Ionicons
                  name={CAT_ICON[cat] ?? 'ellipsis-horizontal-circle-outline'}
                  size={18}
                  color={on ? c.accent : c.textSecondary}
                />
                <Text style={{ color: on ? c.accent : c.text, fontSize: 12.5, fontWeight: '600', textAlign: 'center' }}>
                  {t(`report.cat.${cat}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('report.placeholder')}
          placeholderTextColor={c.textSecondary}
          maxLength={500}
          multiline
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.backgroundSelected }]}
        />

        {msg && (
          <Text style={{ color: msg.ok ? c.ok : c.amber, fontSize: 12.5, textAlign: 'center' }}>{msg.text}</Text>
        )}

        <Pressable
          onPress={send}
          disabled={!category || sending}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: c.accent, opacity: !category || sending ? 0.45 : pressed ? 0.85 : 1 },
          ]}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('report.send')}</Text>}
        </Pressable>
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
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  // Radios del sistema (Radii): controles 14, campo multilínea 14, botón píldora.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderRadius: Radii.control, paddingVertical: 11, alignItems: 'center', gap: 5 },
  input: { borderWidth: 1, borderRadius: Radii.control, padding: 12, fontSize: 14, minHeight: 64, textAlignVertical: 'top' },
  cta: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center' },
});
