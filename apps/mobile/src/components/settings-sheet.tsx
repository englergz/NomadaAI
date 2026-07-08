// Hoja de Ajustes: tema (Sistema/Claro/Oscuro), paleta del mapa de calor,
// intensidad y transparencia. Paridad con el menú del panel de escritorio.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import SliderImpl from '@react-native-community/slider';

// Los tipos del slider aún no están alineados con React 19; el runtime es correcto.
const Slider = SliderImpl as unknown as React.ComponentType<Record<string, unknown>>;

import { HEAT_PALETTES, type HeatPaletteKey } from '@/constants/map';
import { Colors } from '@/constants/theme';
import { useResolvedScheme, useSettings, type ThemePref } from '@/lib/settings';

const THEMES: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'Sistema' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
];

// Vehículos con datos en el modelo (B.6.1): opcional y cambiable por viaje.
export const VEHICLES = [
  { key: 'moto', label: 'Moto', icon: '🏍' },
  { key: 'car', label: 'Carro', icon: '🚗' },
  { key: 'bus', label: 'Bus', icon: '🚌' },
  { key: 'truck', label: 'Camión', icon: '🚚' },
] as const;

export default function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const { settings, set } = useSettings();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>Ajustes</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>

        <Text style={[styles.sec, { color: c.textSecondary }]}>TEMA</Text>
        <View style={styles.row}>
          {THEMES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => set('theme', t.key)}
              style={[
                styles.opt,
                { borderColor: settings.theme === t.key ? c.accent : c.border,
                  backgroundColor: settings.theme === t.key ? c.backgroundSelected : 'transparent' },
              ]}
            >
              <Text style={{ color: settings.theme === t.key ? c.accent : c.text, fontSize: 13, fontWeight: '600' }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sec, { color: c.textSecondary }]}>TU VEHÍCULO</Text>
        <View style={styles.row}>
          {VEHICLES.map((v) => {
            const on = settings.vehicle === v.key;
            return (
              <Pressable
                key={v.key}
                onPress={() => set('vehicle', on ? null : v.key)}
                style={[
                  styles.opt,
                  { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.backgroundSelected : 'transparent' },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{v.icon}</Text>
                <Text style={{ color: on ? c.accent : c.text, fontSize: 11, fontWeight: '600' }}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15 }}>
          Opcional: indicar tu vehículo mejora la precisión (calles según el tipo). Se puede
          cambiar en cada viaje.
        </Text>

        <Text style={[styles.sec, { color: c.textSecondary }]}>RECORRIDO Y ALERTAS</Text>
        <Pressable onPress={() => set('autoTrip', !settings.autoTrip)} style={[styles.switchRow, { borderColor: c.border }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: c.text, fontSize: 14 }}>Recorrido libre automático</Text>
            <Text style={{ color: c.textSecondary, fontSize: 11 }}>
              Al detectar que te mueves (~15 km/h), la protección se activa sola.
            </Text>
          </View>
          <View style={[styles.sw, { backgroundColor: settings.autoTrip ? c.accent : c.backgroundSelected, borderColor: settings.autoTrip ? c.accent : c.border }]}>
            <Text style={{ color: settings.autoTrip ? '#fff' : c.textSecondary, fontSize: 10, fontWeight: '800' }}>
              {settings.autoTrip ? 'ON' : 'OFF'}
            </Text>
          </View>
        </Pressable>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLbl, { color: c.textSecondary }]}>
            Umbral de alerta · {Math.round(settings.threshold * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.3} maximumValue={0.95} step={0.05}
            value={settings.threshold}
            onValueChange={(v: number) => set('threshold', v)}
            minimumTrackTintColor={c.accent} maximumTrackTintColor={c.border} thumbTintColor={c.accent}
          />
        </View>

        <Text style={[styles.sec, { color: c.textSecondary }]}>MAPA Y CAPAS</Text>
        {([['Satelital', 'satellite'], ['Riesgo', 'riskOn'], ['Lugares', 'poisOn']] as const).map(([lbl, key]) => {
          const on = settings[key];
          return (
            <Pressable
              key={key}
              onPress={() => set(key, !on)}
              style={[styles.switchRow, { borderColor: c.border }]}
            >
              <Text style={{ color: c.text, fontSize: 14 }}>{lbl}</Text>
              <View style={[styles.sw, { backgroundColor: on ? c.accent : c.backgroundSelected, borderColor: on ? c.accent : c.border }]}>
                <Text style={{ color: on ? '#fff' : c.textSecondary, fontSize: 10, fontWeight: '800' }}>
                  {on ? 'ON' : 'OFF'}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <Text style={[styles.sec, { color: c.textSecondary }]}>MAPA DE CALOR</Text>
        <View style={styles.row}>
          {(Object.keys(HEAT_PALETTES) as HeatPaletteKey[]).map((k) => {
            const on = settings.palette === k;
            const cols = HEAT_PALETTES[k].colors;
            return (
              <Pressable
                key={k}
                onPress={() => set('palette', k)}
                style={[
                  styles.opt,
                  { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.backgroundSelected : 'transparent' },
                ]}
              >
                <View style={styles.swatchRow}>
                  {[1, 2, 4].map((i) => (
                    <View key={i} style={[styles.swatch, { backgroundColor: cols[i].replace(/[\d.]+\)$/, '1)') }]} />
                  ))}
                </View>
                <Text style={{ color: on ? c.accent : c.text, fontSize: 12, fontWeight: '600' }}>
                  {HEAT_PALETTES[k].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLbl, { color: c.textSecondary }]}>
            Intensidad · {Math.round(settings.intensity * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0} maximumValue={1} step={0.05}
            value={settings.intensity}
            onValueChange={(v: number) => set('intensity', v)}
            minimumTrackTintColor={c.accent} maximumTrackTintColor={c.border} thumbTintColor={c.accent}
          />
        </View>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLbl, { color: c.textSecondary }]}>
            Opacidad de la capa · {Math.round(settings.opacity * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.1} maximumValue={1} step={0.05}
            value={settings.opacity}
            onValueChange={(v: number) => set('opacity', v)}
            minimumTrackTintColor={c.accent} maximumTrackTintColor={c.border} thumbTintColor={c.accent}
          />
        </View>

        </ScrollView>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Listo</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  scroll: { maxHeight: 460 },
  sec: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8 },
  opt: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 5 },
  swatchRow: { flexDirection: 'row', gap: 3 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12,
  },
  sw: { borderWidth: 1, borderRadius: 999, paddingVertical: 3, width: 44, alignItems: 'center' },
  sliderRow: { marginTop: 4 },
  sliderLbl: { fontSize: 12, marginBottom: 2 },
  slider: { width: '100%', height: 32 },
  close: { marginTop: 8, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
