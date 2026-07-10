// Ajustes del usuario (persistentes): tema, paleta del mapa de calor, intensidad y
// transparencia. Un solo sistema de personalización para toda la app.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'system' | 'light' | 'dark';
export type LangPref = 'system' | 'es' | 'en';
export type HeatPalette = 'calor' | 'semaforo' | 'frio';

export interface Settings {
  theme: ThemePref;
  lang: LangPref;       // idioma de la UI: sistema / español / inglés (U2)
  palette: HeatPalette;   // paleta del mapa de calor
  intensity: number;      // 0–1: cuánto “se enciende” el heatmap a igual riesgo
  opacity: number;        // 0–1: transparencia global de la capa
  // Capas y mapa (paridad con el menú del panel de escritorio)
  riskOn: boolean;        // capa de riesgo
  satellite: boolean;     // base satelital
  poisOn: boolean;        // lugares (POIs)
  // Viaje y alertas
  vehicle: string | null; // vehículo predeterminado (moto/carro/bus/camion) — opcional (B.6.1)
  threshold: number;      // umbral de alerta anticipada sobre risk_norm (0–1)
  autoTrip: boolean;      // iniciar recorrido libre automáticamente al detectar movimiento
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  lang: 'system',
  palette: 'calor',
  intensity: 0.5,
  opacity: 0.7,
  riskOn: true,
  satellite: false,
  poisOn: false,
  vehicle: null,
  threshold: 0.7,
  autoTrip: false,
};

const KEY = 'nomadaai_settings_v1';

interface Ctx {
  settings: Settings;
  hydrated: boolean; // true cuando ya se leyeron los ajustes persistidos
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, hydrated: false, set: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => { if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); })
      .catch(() => { /* sin persistencia seguimos con defaults */ })
      .finally(() => setHydrated(true));
  }, []);

  const value = useMemo<Ctx>(() => ({
    settings,
    hydrated,
    set: (key, v) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: v };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => { /* ignore */ });
        return next;
      });
    },
  }), [settings, hydrated]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

// Tema del SO EN VIVO: useColorScheme de RN-web no siempre reacciona al cambio del
// sistema sin recargar, así que se escucha Appearance y, en web, matchMedia directo.
function useSystemScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setScheme(colorScheme === 'dark' ? 'dark' : 'light'));
    let mq: MediaQueryList | null = null;
    const onMq = (e: MediaQueryListEvent) => setScheme(e.matches ? 'dark' : 'light');
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      setScheme(mq.matches ? 'dark' : 'light');
      mq.addEventListener('change', onMq);
    }
    return () => { sub.remove(); mq?.removeEventListener('change', onMq); };
  }, []);
  return scheme;
}

// Tema resuelto: 'system' sigue al SO (y reacciona a sus cambios); claro/oscuro fijos.
export function useResolvedScheme(): 'light' | 'dark' {
  const os = useSystemScheme();
  const { settings } = useSettings();
  if (settings.theme === 'system') return os;
  return settings.theme;
}
