// «Tu protección»: lo que Nómada.AI hizo por el usuario — anónimo, sin registro.
// Paridad con la tarjeta del panel de escritorio: riesgo evitado, viajes, alertas
// a tiempo, contexto de comunidad y reinicio del histórico propio.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { fetchSummaries, resetHistory, type HistorySummary } from '@/lib/history';
import { useResolvedScheme } from '@/lib/settings';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function ProtectionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const [mine, setMine] = useState<HistorySummary | null>(null);
  const [all, setAll] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(false);

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
      <View style={[styles.sheet, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>Tu protección</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          Lo que Nómada.AI hizo por ti · anónimo, sin registro
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={c.accent} style={{ marginVertical: 24 }} />
        ) : mine?.available && mine.trips > 0 ? (
          <>
            {red != null && (
              <View style={[styles.hero, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}>
                <Text style={[styles.heroBig, { color: c.ok }]}>−{red.toFixed(1)}%</Text>
                <Text style={{ color: c.text, fontSize: 12.5, textAlign: 'center' }}>
                  de exposición al riesgo evitada eligiendo la ruta segura
                  {mine.proteccion ? ` · promedio de ${mine.proteccion.n} rutas` : ''}
                </Text>
              </View>
            )}
            <View style={styles.statsRow}>
              {([
                [String(mine.trips), 'viajes'],
                [String(mine.alerts), 'alertas a tiempo'],
                [red != null ? `−${red.toFixed(1)}%` : '—', 'riesgo evitado'],
              ] as const).map(([big, lbl]) => (
                <View key={lbl} style={[styles.stat, { backgroundColor: c.backgroundSelected, borderColor: c.border }]}>
                  <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{big}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>{lbl}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 16 }}>
              Desde {fmtDate(mine.since)} · última {fmtDate(mine.updated)}
            </Text>
          </>
        ) : (
          <Text style={{ color: c.textSecondary, fontSize: 13, marginVertical: 16, lineHeight: 19 }}>
            Aún no tienes viajes registrados. Genera una ruta segura o inicia un recorrido
            libre para ver cuánto riesgo evitas.
          </Text>
        )}

        {all?.available && all.trips > 0 && (
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>
            En toda la comunidad: {all.trips} viajes de {all.users} persona{all.users === 1 ? '' : 's'} · {all.alerts} alertas
          </Text>
        )}

        <View style={styles.row}>
          <Pressable
            onPress={async () => { await resetHistory(); const r = await fetchSummaries(); setMine(r.mine); setAll(r.all); }}
            style={[styles.btn, { borderColor: c.border }]}
          >
            <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>Reiniciar mi histórico</Text>
          </Pressable>
          <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: c.accent, borderColor: c.accent }]}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Listo</Text>
          </Pressable>
        </View>
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
  hero: { borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  heroBig: { fontSize: 30, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
});
