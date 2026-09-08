// Privacidad: BORRAR MIS DATOS y ENVIAR OPINIÓN.
//
// El borrado es irreversible, así que hay DOS barreras deliberadas: una casilla
// que el usuario debe marcar (nunca premarcada) y, encima, el diálogo del sistema
// pidiendo confirmación. Ningún toque accidental puede borrar nada.
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii } from '@/constants/theme';
import { api } from '@/lib/api';
import { deleteAllMyData } from '@/lib/data-deletion';
import { useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';
import { getUid } from '@/lib/uid';

/** Preguntas del formulario. Cortas y concretas: nadie responde un cuestionario largo. */
const QUESTIONS: { key: TKey; id: string }[] = [
  { id: 'useful', key: 'fb.q.useful' },
  { id: 'onTime', key: 'fb.q.onTime' },
  { id: 'trust', key: 'fb.q.trust' },
  { id: 'recommend', key: 'fb.q.recommend' },
];

const SCALE = [1, 2, 3, 4, 5];

export default function PrivacySheet({
  visible, onClose, city,
}: {
  visible: boolean;
  onClose: () => void;
  city: string;
}) {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  // Las cuatro preguntas son obligatorias tanto para enviar como para borrar los datos;
  // el comentario no. Es la única fuente de aprendizaje sobre quien se va.
  const allAnswered = QUESTIONS.every((q) => Boolean(answers[q.id]));

  async function doDelete() {
    setDeleting(true);
    try {
      const uid = await getUid();
      const r = await deleteAllMyData(uid, city);
      if (r.serverOk && r.localOk) {
        Alert.alert(t('privacy.deleted.title'), t('privacy.deleted.body'));
      } else {
        // Se dice la verdad: qué se borró y qué no.
        Alert.alert(t('privacy.deleted.title'), t('privacy.deleted.partial'));
      }
      setConfirmDelete(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  function askDelete() {
    // Segunda barrera: el diálogo del sistema, con el botón destructivo marcado.
    Alert.alert(t('privacy.delete.confirmTitle'), t('privacy.delete.confirmBody'), [
      { text: t('settings.reset.cancel'), style: 'cancel' },
      { text: t('privacy.delete.confirmYes'), style: 'destructive', onPress: () => { void doDelete(); } },
    ]);
  }

  function abrirCorreo() {
    // Respaldo cuando el servidor no acepta: el correo con las respuestas redactadas,
    // que era el único canal hasta que existió POST /feedback.
    const lines = QUESTIONS.map((q) => `${t(q.key)}: ${answers[q.id] ? `${answers[q.id]}/5` : '—'}`);
    if (comment.trim()) lines.push('', `${t('fb.comment')}: ${comment.trim()}`);
    const body = encodeURIComponent(lines.join('\n'));
    const subject = encodeURIComponent(t('fb.subject'));
    void Linking.openURL(`mailto:englergz@gmail.com?subject=${subject}&body=${body}`);
  }

  async function sendFeedback() {
    if (!allAnswered || sending) return;
    setSending(true);
    try {
      const r = await api.sendFeedback({
        useful: answers.useful, on_time: answers.onTime, trust: answers.trust, recommend: answers.recommend,
        comment: comment.trim() || undefined,
        city,
        platform: Platform.OS,
        device_id: await getUid(),
      });
      if (r.accepted) {
        Alert.alert(t('fb.sent.title'), t('fb.sent.body'));
        setAnswers({}); setComment('');
      } else {
        // El servidor respondió pero no aceptó (sin base de datos, límite por hora…):
        // se dice y se ofrece el correo, no se pierde la opinión en silencio.
        Alert.alert(t('fb.sent.title'), r.note ?? t('fb.sent.fallback'));
        abrirCorreo();
      }
    } catch {
      Alert.alert(t('fb.sent.title'), t('fb.sent.fallback'));
      abrirCorreo();
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.backgroundElement, borderColor: c.border, maxHeight: height * 0.9, paddingBottom: insets.bottom + 14 },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.text }]}>{t('privacy.title')}</Text>

        <ScrollView contentContainerStyle={{ gap: 22, paddingVertical: 6 }} keyboardShouldPersistTaps="handled">
          {/* ── Opinión ─────────────────────────────────────────── */}
          <View style={{ gap: 12 }}>
            <Text style={[styles.section, { color: c.accent }]}>{t('fb.title')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('fb.intro')}</Text>

            {QUESTIONS.map((q) => (
              <View key={q.id} style={{ gap: 7 }}>
                <Text style={{ color: c.text, fontSize: 13 }}>{t(q.key)}</Text>
                <View style={styles.scaleRow}>
                  {SCALE.map((n) => {
                    const on = answers[q.id] === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                        style={[
                          styles.scaleBtn,
                          { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.backgroundSelected : 'transparent' },
                        ]}
                      >
                        <Text style={{ color: on ? c.accent : c.textSecondary, fontWeight: '700', fontSize: 13 }}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t('fb.placeholder')}
              placeholderTextColor={c.textSecondary}
              multiline
              maxLength={800}
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.backgroundSelected }]}
            />
            {!allAnswered && (
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>{t('fb.required')}</Text>
            )}
            <Pressable
              onPress={() => { void sendFeedback(); }}
              disabled={!allAnswered || sending}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: c.accent, opacity: !allAnswered || sending ? 0.4 : pressed ? 0.85 : 1 },
              ]}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.ctaText}>{t('fb.send')}</Text>}
            </Pressable>
          </View>

          {/* ── Borrado ─────────────────────────────────────────── */}
          <View style={{ gap: 12 }}>
            <Text style={[styles.section, { color: c.coral }]}>{t('privacy.delete.title')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('privacy.delete.body')}</Text>

            <Pressable onPress={() => setConfirmDelete((v) => !v)} style={styles.checkRow}>
              <View
                style={[
                  styles.check,
                  { borderColor: confirmDelete ? c.coral : c.border, backgroundColor: confirmDelete ? c.coral : 'transparent' },
                ]}
              >
                {confirmDelete && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={{ color: c.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{t('privacy.delete.check')}</Text>
            </Pressable>

            {!allAnswered && (
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>{t('privacy.delete.needFeedback')}</Text>
            )}
            <Pressable
              onPress={askDelete}
              disabled={!confirmDelete || deleting || !allAnswered}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: c.coral, opacity: !confirmDelete || deleting || !allAnswered ? 0.4 : pressed ? 0.85 : 1 },
              ]}
            >
              {deleting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.ctaText}>{t('privacy.delete.action')}</Text>}
            </Pressable>
          </View>
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.cta, { backgroundColor: c.backgroundSelected, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{t('settings.done')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    marginTop: 'auto', borderWidth: 1, borderBottomWidth: 0,
    borderTopLeftRadius: Radii.sheet, borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 20, paddingTop: 10, gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '800' },
  section: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  scaleRow: { flexDirection: 'row', gap: 8 },
  scaleBtn: { flex: 1, borderWidth: 1, borderRadius: Radii.control, paddingVertical: 9, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: Radii.control, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 4 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cta: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
