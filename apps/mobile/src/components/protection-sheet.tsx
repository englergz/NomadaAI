// «Tu protección»: lo que Nómada.AI hizo por el usuario — anónimo, sin registro.
// Paridad con la tarjeta del panel de escritorio: riesgo evitado, viajes, alertas
// a tiempo, contexto de comunidad y reinicio del histórico propio.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileSection from '@/components/profile-section';
import { Colors, Radii } from '@/constants/theme';
import { CLERK_ENABLED } from '@/lib/auth';
import { fetchSummaries, resetHistory, type HistorySummary } from '@/lib/history';
import { useDateLocale, useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

// Confirmación previa a acciones destructivas: Alert nativo; confirm() del navegador en web.
function confirmDestructive(message: string, confirmLabel: string, cancelLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert(confirmLabel, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function ProtectionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useDateLocale();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [mine, setMine] = useState<HistorySummary | null>(null);
  const [all, setAll] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    fetchSummaries()
      .then((r) => { if (alive) { setMine(r.mine); setAll(r.all); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible]);

  const red = mine?.proteccion?.exposure_reduction_avg_pct ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: winH * 0.9, paddingBottom: insets.bottom + 16, backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('prot.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>{t('prot.subtitle')}</Text>

        {/* Contenido scrollable: en pantallas cortas el perfil no cabía y no había
            forma de llegar a «Listo». */}
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
        {/* U4: sesión y perfil (solo si hay clave de Clerk; si no, invitado puro) */}
        {CLERK_ENABLED && <ProfileSection />}

        {loading ? (
          <ActivityIndicator size="small" color={c.accent} style={{ marginVertical: 24 }} />
        ) : mine?.available && mine.trips > 0 ? (
          <>
            {red != null && (
              <View style={[styles.hero, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}>
                <Text style={[styles.heroBig, { color: c.ok }]}>−{red.toFixed(1)}%</Text>
                <Text style={{ color: c.text, fontSize: 12.5, textAlign: 'center' }}>
                  {t('prot.hero')}
                  {mine.proteccion ? t('prot.heroAvg', { n: mine.proteccion.n }) : ''}
                </Text>
              </View>
            )}
            <View style={styles.statsRow}>
              {([
                [String(mine.trips), t('prot.trips')],
                [String(mine.alerts), t('prot.alerts')],
                [red != null ? `−${red.toFixed(1)}%` : '—', t('prot.avoided')],
              ] as const).map(([big, lbl]) => (
                <View key={lbl} style={[styles.stat, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}>
                  <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{big}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>{lbl}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 16 }}>
              {t('prot.range', { since: fmtDate(mine.since, locale), updated: fmtDate(mine.updated, locale) })}
            </Text>
          </>
        ) : (
          <Text style={{ color: c.textSecondary, fontSize: 13, marginVertical: 16, lineHeight: 19 }}>
            {t('prot.empty')}
          </Text>
        )}

        {all?.available && all.trips > 0 && (
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>
            {t('prot.community', { trips: all.trips, users: all.users, s: all.users === 1 ? '' : 's', alerts: all.alerts })}
          </Text>
        )}
        </ScrollView>

        <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: c.accent, borderColor: c.accent }]}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{t('prot.done')}</Text>
        </Pressable>
        {/* Reiniciar historial: acción rara — enlace discreto, no botón protagonista */}
        {mine?.available && mine.trips > 0 && (
          <Pressable
            hitSlop={8}
            onPress={() => confirmDestructive(t('prot.confirmReset'), t('common.confirm'), t('common.cancel'), async () => {
              await resetHistory();
              const r = await fetchSummaries();
              setMine(r.mine); setAll(r.all);
            })}
          >
            <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center', textDecorationLine: 'underline' }}>
              {t('prot.reset')}
            </Text>
          </Pressable>
        )}
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
  hero: { borderWidth: 1, borderRadius: Radii.card, padding: 14, alignItems: 'center', gap: 4 },
  heroBig: { fontSize: 30, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: Radii.control, paddingVertical: 10, alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  sec: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  alertList: { maxHeight: 180 },
  alertRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderBottomWidth: 1, paddingVertical: 7,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  btn: { borderWidth: 1, borderRadius: Radii.pill, paddingVertical: 11, alignItems: 'center', marginTop: 2 },
});
