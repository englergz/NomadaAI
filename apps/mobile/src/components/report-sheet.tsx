// Reporte ciudadano de incidentes (Fase 4, participativo): tipo + descripción opcional;
// la ubicación es la del usuario (o el centro de la ciudad) y la hora se toma sola.
// Anti-abuso en cliente (cooldown) además del rate-limit del servidor.
// La foto llegará cuando el backend soporte adjuntos (Storage) — no se finge.
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CITIES, DEFAULT_CITY } from '@/constants/map';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useResolvedScheme } from '@/lib/settings';

const CATEGORIES = [
  { key: 'robo', label: 'Robo' },
  { key: 'riña', label: 'Riña' },
  { key: 'iluminación dañada', label: 'Iluminación dañada' },
  { key: 'presencia sospechosa', label: 'Presencia sospechosa' },
] as const;

const COOLDOWN_MS = 3 * 60 * 1000; // 3 min entre reportes desde este dispositivo
const LAST_KEY = 'nomadaai_last_report';

export default function ReportSheet({
  visible, onClose, location,
}: {
  visible: boolean;
  onClose: () => void;
  location: [number, number] | null; // [lon, lat] del usuario (o null → centro ciudad)
}) {
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
        setMsg({ text: 'Acabas de enviar un reporte. Espera unos minutos.', ok: false });
        return;
      }
      const [lon, lat] = location ?? CITIES[DEFAULT_CITY].center;
      const r = await api.reportIncident({
        lon, lat, category,
        description: description.trim() || undefined,
        city: DEFAULT_CITY,
        hour: new Date().getHours(),
      });
      if (r.accepted) {
        await AsyncStorage.setItem(LAST_KEY, String(Date.now()));
        setMsg({ text: 'Reporte recibido. Gracias: tu aporte mejora el mapa de todos.', ok: true });
        setCategory(null); setDescription('');
      } else {
        setMsg({ text: r.note ?? 'El reporte no fue aceptado.', ok: false });
      }
    } catch {
      setMsg({ text: 'Sin conexión con el servicio. Intenta de nuevo.', ok: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>Reportar incidente</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>
          Se envía de forma anónima con tu ubicación actual y la hora. Los reportes se agregan
          al modelo; nunca se publican individualmente.
        </Text>

        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const on = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(on ? null : cat.key)}
                style={[
                  styles.cat,
                  { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.backgroundSelected : 'transparent' },
                ]}
              >
                <Text style={{ color: on ? c.accent : c.text, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción (opcional, máx. 500)"
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
            : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Enviar reporte</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 64, textAlignVertical: 'top' },
  cta: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
