// CÍRCULOS DE CUIDADO — la hoja donde se crean, se comparten y se atienden.
//
// Principio que se ve en cada pantalla: por defecto NADIE comparte ubicación. Solo cuando
// alguien pide ayuda (o salta uno de SUS disparadores) su círculo ve dónde está, y al decir
// «estoy bien» ese rastro desaparece del servidor.
//
// Lo que esta versión no hace, y la hoja lo dice sin rodeos: avisar a quien tiene la app
// cerrada. Eso necesita push desde el servidor, pendiente de decisión.
import {
  DEFAULT_CIRCLE_TRIGGERS, formatCircleCode, normalizeCircleCode,
  type CircleMember, type CircleOpenEvent, type CirclePrefs, type CircleSummary, type CircleTriggers,
} from '@nomadaai/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import BaseSheet from '@/components/base-sheet';
import IOSSwitch from '@/components/ios-switch';
import { Colors, Radii } from '@/constants/theme';
import { api } from '@/lib/api';
import { authToken, authUserId } from '@/lib/auth';
import { startSharing, stopSharing, useSharingState } from '@/lib/circle-sharing';
import { confirmDestructive, notify } from '@/lib/confirm';
import { useT, type TKey } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

type Vista = 'lista' | 'crear' | 'unirse' | 'detalle';
const CLASES = ['familia', 'pareja', 'amigos', 'trabajo'] as const;
const DISPARADORES: (keyof CircleTriggers)[] = ['riesgo', 'precaucion', 'inactividad', 'desvio'];
/** Cada cuánto se refresca quién está pidiendo ayuda mientras la hoja está abierta. */
const REFRESCO_MS = 15_000;

export default function CirclesSheet({
  visible, onClose, onRequestSignIn, onShowOnMap,
}: {
  visible: boolean;
  onClose: () => void;
  /** Abre el inicio de sesión: los círculos necesitan cuenta. */
  onRequestSignIn?: () => void;
  /** Lleva el mapa a la última posición de quien pidió ayuda. */
  onShowOnMap?: (lon: number, lat: number) => void;
}) {
  const t = useT();
  const c = Colors[useResolvedScheme()];
  const compartiendo = useSharingState();
  const [conCuenta, setConCuenta] = useState(false);
  const [vista, setVista] = useState<Vista>('lista');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [circulos, setCirculos] = useState<CircleSummary[]>([]);
  const [actual, setActual] = useState<CircleSummary | null>(null);
  const [miembros, setMiembros] = useState<CircleMember[]>([]);
  const [eventos, setEventos] = useState<CircleOpenEvent[]>([]);
  const [prefs, setPrefs] = useState<CirclePrefs | null>(null);
  // Formularios
  const [nombre, setNombre] = useState('');
  const [alias, setAlias] = useState('');
  const [clase, setClase] = useState<(typeof CLASES)[number]>('familia');
  const [codigo, setCodigo] = useState('');

  const auth = useCallback(async () => {
    const token = await authToken();
    if (!token) throw new Error(t('circles.needAccount'));
    return { token };
  }, [t]);

  const explicar = useCallback((e: unknown) => {
    const detalle = (e as { detail?: string | null })?.detail;
    setError(detalle || t('circles.error.generic'));
  }, [t]);

  const cargarLista = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const r = await api.myCircles(await auth());
      setCirculos(r.circles);
    } catch (e) { explicar(e); } finally { setCargando(false); }
  }, [auth, explicar]);

  const cargarDetalle = useCallback(async (circulo: CircleSummary, silencioso = false) => {
    if (!silencioso) { setCargando(true); setError(null); }
    try {
      const a = await auth();
      const [m, ev, p] = await Promise.all([
        api.circleMembers(a, circulo.id), api.circleEvents(a, circulo.id), api.circlePrefs(a, circulo.id),
      ]);
      setMiembros(m.members); setEventos(ev.events); setPrefs(p);
    } catch (e) { if (!silencioso) explicar(e); } finally { if (!silencioso) setCargando(false); }
  }, [auth, explicar]);

  // Al abrir: ¿hay cuenta? Sin ella no se pregunta nada al servidor.
  useEffect(() => {
    if (!visible) return;
    const hay = !!authUserId();
    setConCuenta(hay);
    setVista('lista'); setActual(null); setError(null);
    if (hay) void cargarLista();
  }, [visible, cargarLista]);

  // En el detalle, quién pide ayuda se refresca solo mientras la hoja está abierta.
  useEffect(() => {
    if (!visible || vista !== 'detalle' || !actual) return;
    const reloj = setInterval(() => { void cargarDetalle(actual, true); }, REFRESCO_MS);
    return () => clearInterval(reloj);
  }, [visible, vista, actual, cargarDetalle]);

  function abrir(circulo: CircleSummary) {
    setActual(circulo); setVista('detalle');
    void cargarDetalle(circulo);
  }

  async function crear() {
    if (!nombre.trim() || !alias.trim()) { setError(t('circles.error.fill')); return; }
    setCargando(true); setError(null);
    try {
      const nuevo = await api.createCircle(await auth(), { name: nombre.trim(), kind: clase, alias: alias.trim() });
      setNombre(''); setCodigo('');
      await cargarLista();
      abrir({ ...nuevo, alias: alias.trim(), members: 1, open_events: 0 });
    } catch (e) { explicar(e); } finally { setCargando(false); }
  }

  async function unirse() {
    const normal = normalizeCircleCode(codigo);
    if (!normal) { setError(t('circles.error.code')); return; }
    if (!alias.trim()) { setError(t('circles.error.fill')); return; }
    setCargando(true); setError(null);
    try {
      const circulo = await api.joinCircle(await auth(), { code: normal, alias: alias.trim() });
      setCodigo('');
      await cargarLista();
      abrir({ ...circulo, alias: alias.trim(), members: 0, open_events: 0 });
    } catch (e) { explicar(e); } finally { setCargando(false); }
  }

  async function compartirCodigo(circulo: CircleSummary) {
    try {
      await Share.share({ message: t('circles.shareMessage', { name: circulo.name, code: formatCircleCode(circulo.code) }) });
    } catch { /* la persona canceló */ }
  }

  async function pedirAyuda() {
    if (!actual) return;
    setError(null);
    try {
      const ev = await api.openCircleEvent(await auth(), actual.id, 'panico');
      await startSharing(actual.id, ev.id, 'panico');
      await cargarDetalle(actual, true);
      notify(t('circles.help.sentTitle'), t('circles.help.sentBody'));
    } catch (e) { explicar(e); }
  }

  async function estoyBien() {
    const aqui = actual ? compartiendo.find((s) => s.circleId === actual.id) : undefined;
    if (!actual || !aqui) return;
    try {
      await api.closeCircleEvent(await auth(), aqui.circleId, aqui.eventId);
    } catch { /* aunque falle, se deja de mandar: nadie debe compartir sin querer */ }
    await stopSharing(aqui.circleId);
    await cargarDetalle(actual, true);
  }

  async function cambiarDisparador(k: keyof CircleTriggers, valor: boolean) {
    if (!actual || !prefs) return;
    const siguiente: CirclePrefs = { ...prefs, triggers: { ...DEFAULT_CIRCLE_TRIGGERS, ...prefs.triggers, [k]: valor } };
    setPrefs(siguiente);   // se ve al instante; si el servidor falla, se recarga lo real
    try {
      setPrefs(await api.saveCirclePrefs(await auth(), actual.id, siguiente));
    } catch (e) { explicar(e); void cargarDetalle(actual, true); }
  }

  function salir() {
    if (!actual) return;
    confirmDestructive(t('circles.leave.confirm', { name: actual.name }), t('circles.leave'), t('common.cancel'), async () => {
      try {
        if (compartiendo.some((s) => s.circleId === actual.id)) await estoyBien();
        await api.leaveCircle(await auth(), actual.id);
        setActual(null); setVista('lista');
        await cargarLista();
      } catch (e) { explicar(e); }
    });
  }

  const aliasDe = (pseudonimo: string) => miembros.find((m) => m.pseudonym === pseudonimo)?.alias ?? t('circles.someone');
  const compartiendoAqui = !!actual && compartiendo.some((s) => s.circleId === actual.id);

  // ------------------------------------------------------------------ vistas
  const campo = (valor: string, cambiar: (v: string) => void, placeholder: string, extra?: object) => (
    <TextInput
      value={valor}
      onChangeText={cambiar}
      placeholder={placeholder}
      placeholderTextColor={c.textSecondary}
      style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.backgroundSelected }]}
      {...extra}
    />
  );

  const boton = (texto: string, onPress: () => void, tono: 'accent' | 'coral' | 'plain' = 'accent') => (
    <Pressable
      onPress={onPress}
      disabled={cargando}
      style={({ pressed }) => [
        styles.boton,
        tono === 'plain'
          ? { borderWidth: 1, borderColor: c.border, backgroundColor: 'transparent' }
          : { backgroundColor: tono === 'coral' ? c.coral : c.accent },
        { opacity: cargando ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={{ color: tono === 'plain' ? c.text : '#fff', fontWeight: '700', fontSize: 14 }}>{texto}</Text>
    </Pressable>
  );

  let cuerpo: React.ReactNode;
  if (!conCuenta) {
    cuerpo = (
      <>
        <Text style={[styles.cuerpo, { color: c.textSecondary }]}>{t('circles.needAccount')}</Text>
        {onRequestSignIn && boton(t('circles.signIn'), () => { onClose(); onRequestSignIn(); })}
      </>
    );
  } else if (vista === 'crear') {
    cuerpo = (
      <>
        <Text style={[styles.cuerpo, { color: c.textSecondary }]}>{t('circles.create.help')}</Text>
        {campo(nombre, setNombre, t('circles.create.name'), { maxLength: 40 })}
        {campo(alias, setAlias, t('circles.alias'), { maxLength: 40 })}
        <View style={styles.chips}>
          {CLASES.map((k) => (
            <Pressable
              key={k}
              onPress={() => setClase(k)}
              style={[styles.chip, { borderColor: clase === k ? c.accent : c.border, backgroundColor: clase === k ? c.backgroundSelected : 'transparent' }]}
            >
              <Text style={{ color: clase === k ? c.accent : c.text, fontSize: 12.5, fontWeight: '600' }}>{t(`circles.kind.${k}` as TKey)}</Text>
            </Pressable>
          ))}
        </View>
        {boton(t('circles.create'), crear)}
        {boton(t('common.back'), () => { setVista('lista'); setError(null); }, 'plain')}
      </>
    );
  } else if (vista === 'unirse') {
    cuerpo = (
      <>
        <Text style={[styles.cuerpo, { color: c.textSecondary }]}>{t('circles.join.help')}</Text>
        {campo(codigo, setCodigo, 'ABCD-EFGH', { autoCapitalize: 'characters', maxLength: 9 })}
        {campo(alias, setAlias, t('circles.alias'), { maxLength: 40 })}
        {boton(t('circles.join'), unirse)}
        {boton(t('common.back'), () => { setVista('lista'); setError(null); }, 'plain')}
      </>
    );
  } else if (vista === 'detalle' && actual) {
    cuerpo = (
      <>
        <Pressable onPress={() => compartirCodigo(actual)} style={[styles.codigo, { borderColor: c.border }]}>
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>{t('circles.code')}</Text>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: 2 }}>{formatCircleCode(actual.code)}</Text>
          <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '600' }}>{t('circles.share')}</Text>
        </Pressable>

        {eventos.length > 0 && (
          <View style={[styles.alerta, { borderColor: c.coral }]}>
            {eventos.map((ev) => (
              <View key={ev.id} style={{ gap: 4 }}>
                <Text style={{ color: c.coral, fontWeight: '800', fontSize: 14 }}>
                  {t(`circles.event.${ev.kind}` as TKey, { name: aliasDe(ev.pseudonym) })}
                </Text>
                {ev.last ? (
                  onShowOnMap && (
                    <Pressable onPress={() => { onClose(); onShowOnMap(ev.last!.lon, ev.last!.lat); }}>
                      <Text style={{ color: c.accent, fontWeight: '600', fontSize: 13 }}>{t('circles.event.showOnMap')}</Text>
                    </Pressable>
                  )
                ) : (
                  <Text style={{ color: c.textSecondary, fontSize: 12.5 }}>{t('circles.event.noSignal')}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {compartiendoAqui ? (
          <>
            <Text style={[styles.cuerpo, { color: c.text }]}>{t('circles.help.sharing')}</Text>
            {boton(t('circles.help.imOk'), estoyBien)}
          </>
        ) : (
          <Pressable
            onLongPress={pedirAyuda}
            delayLongPress={800}
            style={({ pressed }) => [styles.boton, { backgroundColor: c.coral, opacity: pressed ? 0.8 : 1 }]}
            accessibilityHint={t('circles.help.hold')}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{t('circles.help')}</Text>
            <Text style={{ color: '#fff', fontSize: 11.5, opacity: 0.9 }}>{t('circles.help.hold')}</Text>
          </Pressable>
        )}

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('circles.triggers')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>{t('circles.triggers.help')}</Text>
        {DISPARADORES.map((k) => (
          <View key={k} style={[styles.fila, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{t(`circles.trigger.${k}` as TKey)}</Text>
            <IOSSwitch
              value={!!(prefs?.triggers?.[k] ?? DEFAULT_CIRCLE_TRIGGERS[k])}
              onValueChange={(v) => cambiarDisparador(k, v)}
            />
          </View>
        ))}

        <Text style={[styles.sec, { color: c.textSecondary }]}>{t('circles.members')}</Text>
        {miembros.map((m) => (
          <View key={m.pseudonym} style={[styles.fila, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{m.alias}</Text>
            {m.role === 'owner' && <Text style={{ color: c.textSecondary, fontSize: 12 }}>{t('circles.owner')}</Text>}
          </View>
        ))}

        {boton(t('circles.leave'), salir, 'plain')}
        {boton(t('common.back'), () => { setActual(null); setVista('lista'); void cargarLista(); }, 'plain')}
      </>
    );
  } else {
    cuerpo = (
      <>
        <Text style={[styles.cuerpo, { color: c.textSecondary }]}>{t('circles.intro')}</Text>
        {circulos.map((ci) => (
          <Pressable key={ci.id} onPress={() => abrir(ci)} style={[styles.circulo, { borderColor: ci.open_events ? c.coral : c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{ci.name}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12.5 }}>{t('circles.membersCount', { n: ci.members })}</Text>
            </View>
            {ci.open_events > 0 && (
              <Text style={{ color: c.coral, fontSize: 12.5, fontWeight: '800' }}>{t('circles.openEvents', { n: ci.open_events })}</Text>
            )}
          </Pressable>
        ))}
        {!cargando && circulos.length === 0 && !error && (
          <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center' }}>{t('circles.empty')}</Text>
        )}
        {boton(t('circles.create'), () => { setError(null); setVista('crear'); })}
        {boton(t('circles.join'), () => { setError(null); setVista('unirse'); }, 'plain')}
        <Text style={{ color: c.textSecondary, fontSize: 11.5, lineHeight: 16 }}>{t('circles.limits')}</Text>
      </>
    );
  }

  return (
    <BaseSheet visible={visible} onClose={onClose} maxHeightPct={0.9}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
        <View style={styles.cabecera}>
          <Text style={[styles.titulo, { color: c.text }]}>
            {vista === 'detalle' && actual ? actual.name : t('circles.title')}
          </Text>
          {cargando && <ActivityIndicator size="small" color={c.accent} />}
        </View>
        {error && <Text style={{ color: c.coral, fontSize: 13 }}>{error}</Text>}
        {cuerpo}
      </ScrollView>
    </BaseSheet>
  );
}

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 18, fontWeight: '800', flex: 1 },
  cuerpo: { fontSize: 13.5, lineHeight: 19 },
  sec: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: Radii.control, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  boton: { borderRadius: Radii.pill, paddingVertical: 13, alignItems: 'center', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  circulo: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radii.card, padding: 14, gap: 10 },
  codigo: { borderWidth: 1, borderRadius: Radii.card, padding: 12, alignItems: 'center', gap: 2 },
  alerta: { borderWidth: 1.5, borderRadius: Radii.card, padding: 12, gap: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 10 },
});
