// Hoja de NOTIFICACIONES (historial de alertas, antes vivía en el perfil):
// hora / zona / acción, filtros por tipo y limpieza con confirmación. Al abrirla
// se marca todo como visto (el puntico del FAB desaparece hasta la próxima).
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BaseSheet from '@/components/base-sheet';
import { Colors, Radii } from '@/constants/theme';
import { clearAlerts, getAlerts, markAlertsSeen, type AlertRecord } from '@/lib/alert-log';
import { useDateLocale, useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

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

function fmtDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useDateLocale();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'proximidad' | 'anticipada'>('all');
  const shown = filter === 'all' ? alerts : alerts.filter((a) => a.kind === filter);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    getAlerts().then((a) => { if (alive) setAlerts(a); });
    markAlertsSeen();
    return () => { alive = false; };
  }, [visible]);

  return (
    <BaseSheet visible={visible} onClose={onClose} maxHeightPct={null} sheetStyle={{ paddingBottom: 26 }}>
        <View style={styles.secRow}>
          <Text style={[styles.title, { color: c.text }]}>{t('prot.alertLog')}</Text>
          {alerts.length > 0 && (
            <Pressable
              hitSlop={8}
              onPress={() => confirmDestructive(t('prot.confirmClear'), t('common.confirm'), t('common.cancel'), async () => {
                await clearAlerts();
                setAlerts([]);
              })}
            >
              <Text style={{ color: c.coral, fontSize: 12, fontWeight: '600' }}>{t('prot.clearAlerts')}</Text>
            </Pressable>
          )}
        </View>

        {alerts.length > 0 && (
          <View style={styles.filterRow}>
            {([['all', t('prot.filter.all')], ['proximidad', t('prot.filter.prox')], ['anticipada', t('prot.filter.pre')]] as const).map(([k, lbl]) => (
              <Pressable
                key={k}
                onPress={() => setFilter(k)}
                style={[styles.filterChip, {
                  borderColor: filter === k ? c.accent : c.border,
                  backgroundColor: filter === k ? c.backgroundSelected : 'transparent',
                }]}
              >
                <Text style={{ color: filter === k ? c.accent : c.textSecondary, fontSize: 11.5, fontWeight: '600' }}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {shown.length === 0 ? (
          <Text style={{ color: c.textSecondary, fontSize: 12.5, lineHeight: 18 }}>{t('prot.alertLog.empty')}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {shown.map((a, i) => (
              <View key={`${a.t}-${i}`} style={[styles.alertRow, { borderColor: c.border }]}>
                <View style={[styles.alertDot, { backgroundColor: a.level === 'atencion' ? c.coral : c.amber }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 12.5, fontWeight: '600' }}>
                    {fmtDate(a.t, locale)} · {t('prot.alertLog.zone')} {a.zone} ·{' '}
                    {a.level === 'atencion' ? t('map.level.attention') : t('map.level.caution')}
                    {a.kind === 'anticipada' ? t('prot.alertLog.pre') : ''}
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 15 }}>{a.action}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: c.accent }]}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{t('prot.done')}</Text>
        </Pressable>
    </BaseSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { borderWidth: 1, borderRadius: Radii.pill, paddingVertical: 5, paddingHorizontal: 12 },
  alertRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderBottomWidth: 1, paddingVertical: 7 },
  alertDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  btn: { borderRadius: Radii.pill, paddingVertical: 11, alignItems: 'center', marginTop: 2 },
});
