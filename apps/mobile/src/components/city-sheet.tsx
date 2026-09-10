// Selector de CIUDAD por PAÍS (estilo inDrive).
//
// Abre en el país de la ciudad activa y lista sus ciudades con nombre oficial y
// ESTADO real, dicho por el servidor (lib/city-status.ts):
//   · Disponible    → riesgo + red vial: se elige y funciona todo.
//   · Próximamente  → ya hay mapa de riesgo, aún sin rutas: se puede elegir, con aviso.
//   · No disponible → en el catálogo para que se encuentre, pero deshabilitada.
// Abajo: «¿Cambiar de país? Ver todas» abre el buscador sobre el catálogo completo.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CITIES, type CityKey, type CountryCode } from '@/constants/map';
import BaseSheet from '@/components/base-sheet';
import { Colors, Radii } from '@/constants/theme';
import { citiesOfCountry, cityStatus, searchCities, sortByStatus, type CityStatus } from '@/lib/city-status';
import { useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

const STATUS_KEY: Record<CityStatus, TKey> = {
  available: 'city.status.available',
  soon: 'city.status.soon',
  unavailable: 'city.status.unavailable',
};

export default function CitySheet({
  visible, current, riskCities, routeCities, onSelect, onClose,
}: {
  visible: boolean;
  current: CityKey;
  /** Ciudades con capa de riesgo publicada (GET /risk/cities). */
  riskCities: readonly string[];
  /** Ciudades con red vial cargada (GET /route/cities). */
  routeCities: readonly string[];
  onSelect: (city: CityKey) => void;
  onClose: () => void;
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const country: CountryCode = CITIES[current].country;
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState('');

  const keys = useMemo(() => {
    const base = all ? searchCities(query) : citiesOfCountry(country);
    return sortByStatus(base, riskCities, routeCities);
  }, [all, query, country, riskCities, routeCities]);

  function close() { setAll(false); setQuery(''); onClose(); }

  const countryName = t(`country.${country}` as TKey);

  return (
    <BaseSheet visible={visible} onClose={close} maxHeightPct={0.85} sheetStyle={{ paddingBottom: 28 }}>
        <Text style={[styles.title, { color: c.text }]}>{t('city.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          {all ? t('city.subtitle') : t('city.inCountry', { country: countryName })}
        </Text>

        {all && (
          <View style={[styles.search, { borderColor: c.border, backgroundColor: c.background }]}>
            <Ionicons name="search" size={16} color={c.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('city.search')}
              placeholderTextColor={c.textSecondary}
              autoCorrect={false}
              style={[styles.input, { color: c.text }]}
            />
          </View>
        )}

        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {keys.length === 0 && (
            <Text style={{ color: c.textSecondary, fontSize: 12.5, textAlign: 'center', paddingVertical: 10 }}>
              {t('city.noMatch')}
            </Text>
          )}
          {keys.map((k) => {
            const on = k === current;
            const st = cityStatus(k, riskCities, routeCities);
            const disabled = st === 'unavailable';
            const badge = st === 'available' ? c.accent : st === 'soon' ? '#f5a524' : c.textSecondary;
            return (
              <Pressable
                key={k}
                disabled={disabled}
                accessibilityState={{ disabled, selected: on }}
                onPress={() => { onSelect(k); close(); }}
                style={[styles.row, {
                  borderColor: on ? c.accent : c.border,
                  backgroundColor: on ? c.backgroundSelected : 'transparent',
                  opacity: disabled ? 0.55 : 1,
                }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: on ? c.accent : c.text, fontSize: 15, fontWeight: '700' }}>
                      {CITIES[k].label}
                    </Text>
                    {all && (
                      <Text style={{ color: c.textSecondary, fontSize: 11.5 }}>
                        {t(`country.${CITIES[k].country}` as TKey)}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: c.textSecondary, fontSize: 11.5 }}>
                    {st === 'available' ? t('city.full') : st === 'soon' ? t('city.status.soonHint') : t('city.status.unavailableHint')}
                  </Text>
                </View>
                <View style={[styles.badge, { borderColor: badge }]}>
                  <Text style={{ color: badge, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                    {t(STATUS_KEY[st]).toUpperCase()}
                  </Text>
                </View>
                {on && <Ionicons name="checkmark-circle" size={20} color={c.accent} />}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable onPress={() => { setAll((v) => !v); setQuery(''); }} hitSlop={6} style={styles.toggle}>
          <Ionicons name={all ? 'chevron-back' : 'globe-outline'} size={15} color={c.accent} />
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>
            {all ? t('city.backCountry', { country: countryName }) : t('city.changeCountry')}
          </Text>
        </Pressable>
    </BaseSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: Radii.control, paddingVertical: 12, paddingHorizontal: 14,
  },
  badge: { borderWidth: 1.5, borderRadius: Radii.pill, paddingVertical: 3, paddingHorizontal: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
});
