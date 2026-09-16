// Reporte ciudadano de incidentes (Fase 4, participativo): tipo + descripción opcional;
// la ubicación es la del usuario (o el centro de la ciudad) y la hora se toma sola.
// Anti-abuso en cliente (cooldown) además del rate-limit del servidor.
// La foto llegará cuando el backend soporte adjuntos (Storage) — no se finge.
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { CITIES, DEFAULT_CITY, type CityKey } from '@/constants/map';
import BaseSheet from '@/components/base-sheet';
import { Colors, Radii } from '@/constants/theme';
import { api } from '@/lib/api';
import { ApiError } from '@nomadaai/shared';
import { enqueue } from '@/lib/write-queue';
import { historyAuth } from '@/lib/history-auth';
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
  city?: CityKey;                    // ciudad activa: el reporte se asocia a ella
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  // El campo de descripción quedaba TAPADO por el teclado: la hoja sube con él,
  // mismo mecanismo que la barra inferior del mapa.
  // Con el teclado abierto la hoja no cabe entera: se desplaza y, al enfocar la
  // descripción, se lleva a la vista. Antes el campo y el botón de enviar quedaban
  // DEBAJO del teclado, sin forma de alcanzarlos (verificado en emulador).
  const scrollRef = useRef<ScrollView>(null);

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
      const body = {
        lon, lat, category,
        description: description.trim() || undefined,
        city,
        hour: new Date().getHours(),
      };
      let r: { accepted: boolean; note?: string } | null = null;
      try {
        // Firmado con el token si hay sesión o con la llave del dispositivo: así «Borrar mis
        // datos» lo alcanza y el límite por hora es por persona.
        r = await api.reportIncident(body, await historyAuth());
      } catch (e) {
        // Un rechazo del servidor (4xx: mal formado o límite por hora) NO es «sin red»:
        // encolarlo lo reenviaría igual y taparía la cola. Se muestra y se acaba.
        if (e instanceof ApiError && !e.retryable) {
          setMsg({ text: e.detail ?? t('report.rejected'), ok: false });
          return;
        }
        // SIN RED (o servidor caído): el reporte no se pierde. Se guarda cifrado y sale solo
        // al volver la señal.
        await enqueue({ kind: 'report', body });
        await AsyncStorage.setItem(LAST_KEY, String(Date.now()));
        setMsg({ text: t('report.queued'), ok: true });
        setCategory(null); setDescription('');
        return;
      }
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
    <BaseSheet visible={visible} onClose={onClose} maxHeightPct={0.9}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        // La hoja es un Modal y su ventana NO se encoge con el teclado (la altura del
        // teclado llega 0 en Android), así que el botón de enviar queda debajo mientras
        // se escribe: arrastrar la hoja cierra el teclado y lo deja a la vista.
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
      >
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
          // Dos pasadas a propósito: la primera llega mientras el teclado todavía está
          // abriéndose y deja el botón de enviar a medias; la segunda, ya con la hoja
          // en su alto final, lo termina de subir.
          onFocus={() => {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 500);
          }}
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
      </ScrollView>
    </BaseSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800' },
  // Radios del sistema (Radii): controles 14, campo multilínea 14, botón píldora.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderRadius: Radii.control, paddingVertical: 11, alignItems: 'center', gap: 5 },
  input: { borderWidth: 1, borderRadius: Radii.control, padding: 12, fontSize: 14, minHeight: 64, textAlignVertical: 'top' },
  cta: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center' },
});
