// Vista principal de la app de usuario (Fase 1): mapa en vivo + capa de riesgo +
// ubicación. El permiso de ubicación se pide EN CONTEXTO (al tocar el botón), nunca al abrir.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import type { RiskZonesResponse } from '@nomadaai/shared';

import RiskMap from '@/components/risk-map';
import { Colors } from '@/constants/theme';
import { api } from '@/lib/api';

export default function MapScreen() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const c = Colors[dark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const [riskOn, setRiskOn] = useState(true);
  const [riskData, setRiskData] = useState<RiskZonesResponse | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);

  // Capa de riesgo (el backend modula por franja horaria; hora/ciudad llegan en Fase 5).
  useEffect(() => {
    let alive = true;
    api.riskZones()
      .then((d) => { if (alive) setRiskData(d); })
      .catch(() => { /* sin riesgo no bloqueamos el mapa */ });
    return () => { alive = false; };
  }, []);

  async function locate() {
    setLocMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocMsg('Sin permiso de ubicación. Puedes activarlo en Ajustes.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc([pos.coords.longitude, pos.coords.latitude]);
    } catch {
      setLocMsg('No se pudo obtener tu ubicación.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <RiskMap dark={dark} riskOn={riskOn} riskData={riskData} userLocation={userLoc} />

      {/* Controles flotantes (mismos tokens que la web) */}
      <View style={[styles.top, { top: insets.top + 12 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.chip, { backgroundColor: c.backgroundElement, borderColor: c.border }]}
        >
          <Text style={[styles.chipText, { color: c.text }]}>‹ Volver</Text>
        </Pressable>
        <Pressable
          onPress={() => setRiskOn((v) => !v)}
          style={[
            styles.chip,
            { backgroundColor: c.backgroundElement, borderColor: riskOn ? c.accent : c.border },
          ]}
        >
          <Text style={[styles.chipText, { color: riskOn ? c.accent : c.text }]}>
            Riesgo {riskOn ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 16 }]}>
        {locMsg && (
          <View style={[styles.msg, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>{locMsg}</Text>
          </View>
        )}
        <Pressable
          onPress={locate}
          style={({ pressed }) => [
            styles.locBtn,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.locText}>{userLoc ? 'Actualizar mi ubicación' : 'Mi ubicación'}</Text>
        </Pressable>
        {Platform.OS === 'web' && (
          <Text style={[styles.hintWeb, { color: c.textSecondary }]}>
            En el navegador la ubicación usa el diálogo del propio navegador.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 13, fontWeight: '600' },
  bottom: { position: 'absolute', left: 16, right: 16, gap: 8, alignItems: 'center' },
  msg: { borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  locBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', alignSelf: 'stretch' },
  locText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hintWeb: { fontSize: 11 },
});
