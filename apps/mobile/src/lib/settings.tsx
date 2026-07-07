// Ajustes del usuario (persistentes): tema, paleta del mapa de calor, intensidad y
// transparencia. Un solo sistema de personalización para toda la app.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'system' | 'light' | 'dark';
export type HeatPalette = 'calor' | 'semaforo' | 'frio';

export interface Settings {
  theme: ThemePref;
  palette: HeatPalette;   // paleta del mapa de calor
  intensity: number;      // 0–1: cuánto “se enciende” el heatmap a igual riesgo
  opacity: number;        // 0–1: transparencia global de la capa
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  palette: 'calor',
  intensity: 0.5,
  opacity: 0.7,
};

const KEY = 'nomadaai_settings_v1';

interface Ctx {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, set: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => { if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) }); })
      .catch(() => { /* sin persistencia seguimos con defaults */ });
  }, []);

  const value = useMemo<Ctx>(() => ({
    settings,
    set: (key, v) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: v };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => { /* ignore */ });
        return next;
      });
    },
  }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

// Tema resuelto: 'system' sigue al SO (y reacciona a sus cambios); claro/oscuro fijos.
export function useResolvedScheme(): 'light' | 'dark' {
  const os = useColorScheme();
  const { settings } = useSettings();
  if (settings.theme === 'system') return os === 'dark' ? 'dark' : 'light';
  return settings.theme;
}
