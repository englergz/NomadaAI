// Sección PERFIL de la hoja «Tu protección» (U4 · Clerk). Solo se monta cuando hay
// clave de Clerk. Sin sesión: botón de Google + nota de invitado. Con sesión: foto,
// nombre/correo, cerrar sesión y los campos PROPIOS del perfil (fecha de nacimiento
// y nacionalidad) con consentimiento explícito (Ley 1581) → BI agregada.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth, useSSO, useUser } from '@clerk/clerk-expo';

import PickerSheet from '@/components/picker-sheet';
import { COUNTRIES } from '@/constants/countries';
import { Colors, Radii } from '@/constants/theme';
import { useLang, useT } from '@/lib/i18n';
import { useResolvedScheme } from '@/lib/settings';

WebBrowser.maybeCompleteAuthSession();

const MONTHS = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const;
// Los días dependen del mes/año elegidos (nada de 31 de febrero).
// Años: desde 13 años atrás (edad mínima razonable) hasta 1920.
const YEARS = Array.from(
  { length: new Date().getFullYear() - 13 - 1920 + 1 },
  (_, i) => String(new Date().getFullYear() - 13 - i),
);

export default function ProfileSection() {
  const t = useT();
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const { startSSOFlow } = useSSO();
  const lang = useLang();
  const [err, setErr] = useState(false);
  // Fecha de nacimiento por partes (selectores) + nacionalidad (lista de países).
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null); // '1'..'12'
  const [year, setYear] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [picker, setPicker] = useState<'day' | 'month' | 'year' | 'country' | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const months = MONTHS[lang];

  // Carga los campos propios desde el perfil Clerk (unsafeMetadata) al abrir sesión.
  useEffect(() => {
    const m = (user?.unsafeMetadata ?? {}) as { dob?: string; nationality?: string };
    const [y, mo, d] = (m.dob ?? '').split('-');
    setYear(y || null);
    setMonth(mo ? String(Number(mo)) : null);
    setDay(d ? String(Number(d)) : null);
    setNationality(m.nationality ?? null);
  }, [user?.id, user?.unsafeMetadata]);

  // Días válidos según mes/año (bisiestos incluidos); si el día elegido deja de
  // existir al cambiar el mes (31 → febrero), se limpia.
  const maxDay = month ? new Date(Number(year ?? 2000), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1));
  useEffect(() => {
    if (day && Number(day) > maxDay) setDay(null);
  }, [day, maxDay]);

  const dob = day && month && year
    ? `${year}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    : null;

  async function google() {
    setErr(false);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) await setActive({ session: createdSessionId });
      else setErr(true);
    } catch { setErr(true); }
  }

  async function saveProfile() {
    if (!user || saving) return;
    setSaving(true); setSavedMsg(null);
    try {
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata ?? {}),
          dob: dob ?? undefined,
          nationality: nationality ?? undefined,
        },
      });
      setSavedMsg(t('auth.saved'));
    } catch { setSavedMsg(t('auth.saveError')); } finally { setSaving(false); }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sec, { color: c.textSecondary }]}>{t('auth.profile')}</Text>

      {!isSignedIn ? (
        <>
          <Pressable
            onPress={google}
            style={({ pressed }) => [styles.btn, { borderColor: c.accent, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>{t('auth.signin')}</Text>
          </Pressable>
          {err && <Text style={{ color: c.coral, fontSize: 11.5, textAlign: 'center' }}>{t('auth.error')}</Text>}
          <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 15 }}>{t('auth.guestNote')}</Text>
        </>
      ) : (
        <>
          <View style={styles.userRow}>
            {user?.imageUrl
              ? <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
              : <View style={[styles.avatar, { backgroundColor: c.backgroundSelected }]} />}
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {user?.fullName ?? user?.username ?? '—'}
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                {user?.primaryEmailAddress?.emailAddress ?? ''}
              </Text>
            </View>
            <Pressable onPress={() => signOut()} hitSlop={8}>
              <Text style={{ color: c.textSecondary, fontSize: 12, textDecorationLine: 'underline' }}>
                {t('auth.signout')}
              </Text>
            </Pressable>
          </View>

          {/* Campos propios del perfil → BI agregada, con consentimiento explícito */}
          <Text style={{ color: c.textSecondary, fontSize: 11.5 }}>{t('auth.dob')}</Text>
          <View style={styles.dobRow}>
            {([['day', day ?? t('auth.day')],
               ['month', month ? months[Number(month) - 1] : t('auth.month')],
               ['year', year ?? t('auth.year')]] as const).map(([k, lbl]) => (
              <Pressable
                key={k}
                onPress={() => setPicker(k)}
                style={[styles.pickBtn, { flex: 1, borderColor: c.border, backgroundColor: c.backgroundSelected }]}
              >
                <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={1}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setPicker('country')}
            style={[styles.pickBtn, { borderColor: c.border, backgroundColor: c.backgroundSelected }]}
          >
            <Text style={{ color: nationality ? c.text : c.textSecondary, fontSize: 13 }}>
              {nationality ?? t('auth.nationality')}
            </Text>
          </Pressable>

          <PickerSheet
            visible={picker === 'day'} title={t('auth.day')} options={days}
            selected={day} onSelect={setDay} onClose={() => setPicker(null)}
          />
          <PickerSheet
            visible={picker === 'month'} title={t('auth.month')} options={months as unknown as string[]}
            selected={month ? months[Number(month) - 1] : null}
            onSelect={(m) => setMonth(String(months.indexOf(m as never) + 1))}
            onClose={() => setPicker(null)}
          />
          <PickerSheet
            visible={picker === 'year'} title={t('auth.year')} options={YEARS}
            selected={year} onSelect={setYear} onClose={() => setPicker(null)}
          />
          <PickerSheet
            visible={picker === 'country'} title={t('auth.nationality')}
            options={COUNTRIES.map((x) => x[lang])} selected={nationality}
            onSelect={setNationality} onClose={() => setPicker(null)}
            searchable searchPlaceholder={t('auth.searchCountry')}
          />
          <Text style={{ color: c.textSecondary, fontSize: 10.5, lineHeight: 14 }}>{t('auth.consent')}</Text>
          <Pressable
            onPress={saveProfile}
            disabled={saving}
            style={({ pressed }) => [styles.btn, { borderColor: c.border, opacity: saving ? 0.5 : pressed ? 0.8 : 1 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color={c.accent} />
              : <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{t('auth.save')}</Text>}
          </Pressable>
          {savedMsg && <Text style={{ color: c.textSecondary, fontSize: 11.5, textAlign: 'center' }}>{savedMsg}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sec: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: Radii.pill },
  btn: { borderWidth: 1.5, borderRadius: Radii.pill, paddingVertical: 10, alignItems: 'center' },
  dobRow: { flexDirection: 'row', gap: 8 },
  pickBtn: { borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: 14, paddingVertical: 9 },
});
