// Hoja de Ajustes (B8): VEHÍCULO / RECORRIDO Y ALERTAS / TEMA / MAPA Y CAPAS / RIESGO
// (categoría propia: toggle de capa + heatmap dentro, deshabilitado si la capa está OFF).
// Paridad con el menú del panel de escritorio.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import SliderImpl from '@react-native-community/slider';

// Los tipos del slider aún no están alineados con React 19; el runtime es correcto.
const Slider = SliderImpl as unknown as React.ComponentType<Record<string, unknown>>;

import { HEAT_PALETTES, type HeatPaletteKey } from '@/constants/map';
import { Colors, Radii } from '@/constants/theme';
import IOSSwitch from '@/components/ios-switch';
import { systemLangUnsupported, useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme, useSettings, type LangPref, type ThemePref } from '@/lib/settings';

const THEMES: { key: ThemePref; tKey: TKey }[] = [
  { key: 'system', tKey: 'settings.theme.system' },
  { key: 'light', tKey: 'settings.theme.light' },
  { key: 'dark', tKey: 'settings.theme.dark' },
];

// Idiomas (U2): el rótulo del idioma va en SU idioma, no se traduce.
const LANGS: { key: LangPref; label?: string; tKey?: TKey }[] = [
  { key: 'system', tKey: 'settings.lang.system' },
  { key: 'es', label: 'Español' },
  { key: 'en', label: 'English' },
];

// Vehículos con datos en el modelo (B.6.1): opcional y cambiable por viaje.
export const VEHICLES = [
  { key: 'moto', tKey: 'settings.vehicle.moto', icon: '🏍' },
  { key: 'car', tKey: 'settings.vehicle.car', icon: '🚗' },
  { key: 'bus', tKey: 'settings.vehicle.bus', icon: '🚌' },
  { key: 'truck', tKey: 'settings.vehicle.truck', icon: '🚚' },
] as const;

export default function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const { settings, set } = useSettings();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('settings.title')}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('settings.vehicle')}</Text>
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
                <Text style={{ color: on ? c.accent : c.text, fontSize: 11, fontWeight: '600' }}>{t(v.tKey)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15 }}>{t('settings.vehicle.help')}</Text>

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('settings.trip')}</Text>
        <View style={[styles.switchRow, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{t('settings.autoTrip')}</Text>
          <IOSSwitch
            value={settings.autoTrip}
            onValueChange={async (next) => {
              if (next) {
                // Diálogos NATIVOS: ubicación y «Permitir siempre» (segundo plano),
                // que es lo que la detección necesita para funcionar de verdad.
                try {
                  const fg = await Location.requestForegroundPermissionsAsync();
                  if (!fg.granted) return;
                  await Location.requestBackgroundPermissionsAsync().catch(() => { /* opcional */ });
                } catch { return; }
              }
              set('autoTrip', next);
            }}
          />
        </View>
        {/* Explicación breve DEBAJO del control (menos texto, más claro) */}
        <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15, marginTop: -2 }}>
          {t('settings.autoTrip.help')}
        </Text>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLbl, { color: c.textSecondary }]}>
            {t('settings.threshold')} · {Math.round(settings.threshold * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.3} maximumValue={0.95} step={0.05}
            value={settings.threshold}
            onValueChange={(v: number) => set('threshold', v)}
            minimumTrackTintColor={c.accent} maximumTrackTintColor={c.border} thumbTintColor={c.accent}
          />
        </View>

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('settings.theme')}</Text>
        <View style={styles.row}>
          {THEMES.map((th) => (
            <Pressable
              key={th.key}
              onPress={() => set('theme', th.key)}
              style={[
                styles.opt,
                { borderColor: settings.theme === th.key ? c.accent : c.border,
                  backgroundColor: settings.theme === th.key ? c.backgroundSelected : 'transparent' },
              ]}
            >
              <Text style={{ color: settings.theme === th.key ? c.accent : c.text, fontSize: 13, fontWeight: '600' }}>
                {t(th.tKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('settings.lang')}</Text>
        <View style={styles.row}>
          {LANGS.map((l) => (
            <Pressable
              key={l.key}
              onPress={() => set('lang', l.key)}
              style={[
                styles.opt,
                { borderColor: settings.lang === l.key ? c.accent : c.border,
                  backgroundColor: settings.lang === l.key ? c.backgroundSelected : 'transparent' },
              ]}
            >
              <Text style={{ color: settings.lang === l.key ? c.accent : c.text, fontSize: 13, fontWeight: '600' }}>
                {l.tKey ? t(l.tKey) : l.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Honestidad: con «Sistema» y un idioma de dispositivo que aún no cubrimos, se avisa */}
        {settings.lang === 'system' && systemLangUnsupported() && (
          <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15 }}>
            {t('settings.lang.unavailable')}
          </Text>
        )}

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('settings.layers')}</Text>
        {([[t('settings.satellite'), 'satellite'], [t('settings.pois'), 'poisOn']] as const).map(([lbl, key]) => {
          const on = settings[key];
          return (
            <View key={key} style={[styles.switchRow, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{lbl}</Text>
              <IOSSwitch value={on} onValueChange={(v) => set(key, v)} />
            </View>
          );
        })}

        {/* B8: RIESGO como categoría propia — toggle de la capa + su mapa de calor dentro;
            la personalización se deshabilita cuando la capa está OFF. */}
        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('settings.risk')}</Text>
        <View style={[styles.switchRow, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{t('settings.riskLayer')}</Text>
          <IOSSwitch value={settings.riskOn} onValueChange={(v) => set('riskOn', v)} />
        </View>
        <View
          style={{ gap: 10, opacity: settings.riskOn ? 1 : 0.4, pointerEvents: settings.riskOn ? 'auto' : 'none' }}
        >
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
                  {t(`settings.palette.${k}` as TKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLbl, { color: c.textSecondary }]}>
            {t('settings.intensity')} · {Math.round(settings.intensity * 100)}%
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
            {t('settings.opacity')} · {Math.round(settings.opacity * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.1} maximumValue={1} step={0.05}
            value={settings.opacity}
            onValueChange={(v: number) => set('opacity', v)}
            minimumTrackTintColor={c.accent} maximumTrackTintColor={c.border} thumbTintColor={c.accent}
          />
        </View>
        </View>

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
  // B3: el backdrop cubre TODA la pantalla (también detrás de las esquinas curvas de la
  // hoja); antes terminaba en el borde superior de la hoja y se veía una línea recta.
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    marginTop: 'auto',
    borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  scroll: { maxHeight: 460 },
  sec: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8 },
  // Radios del sistema (Radii): controles seleccionables 14, botones píldora.
  opt: { flex: 1, borderWidth: 1, borderRadius: Radii.control, paddingVertical: 10, alignItems: 'center', gap: 5 },
  swatchRow: { flexDirection: 'row', gap: 3 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: Radii.control, paddingVertical: 9, paddingHorizontal: 12,
  },
  sw: { borderWidth: 1, borderRadius: Radii.pill, paddingVertical: 3, width: 44, alignItems: 'center' },
  sliderRow: { marginTop: 4 },
  sliderLbl: { fontSize: 12, marginBottom: 2 },
  slider: { width: '100%', height: 32 },
  close: { marginTop: 8, borderRadius: Radii.pill, paddingVertical: 12, alignItems: 'center' },
});
