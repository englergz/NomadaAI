// COMPARTIR POSICIÓN CON UN CÍRCULO, solo mientras hay un evento abierto.
//
// Cuando alguien pide ayuda (o salta un disparador), su círculo necesita saber dónde está
// y hacia dónde va. Aquí vive ese «mientras»: qué evento está abierto y el reloj que manda
// la posición cada poco. En cuanto el evento se cierra —porque la persona dice que está
// bien o porque el servidor lo cerró— se deja de mandar, y el servidor borra el rastro.
//
// Qué se guarda en el teléfono: SOLO qué evento está abierto (círculo, evento, desde
// cuándo). Nunca posiciones: esas van directo al servidor y viven lo que vive el evento.
//
// Alcance de esta versión, dicho claro: manda con la app abierta. Con la app cerrada, el
// aviso a los miembros necesita push desde el servidor, pendiente de decisión.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '@nomadaai/shared';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { authToken } from '@/lib/auth';

const KEY = 'nomadaai.circles.sharing';
/** Cada cuánto se manda la posición: lo bastante seguido para seguir a alguien que se mueve. */
export const SHARE_EVERY_MS = 15_000;

export interface SharingState {
  circleId: number;
  eventId: number;
  since: number;
}

type Listener = (s: SharingState | null) => void;
const listeners = new Set<Listener>();

async function read(): Promise<SharingState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SharingState) : null;
  } catch {
    return null;
  }
}

function notify(s: SharingState | null) {
  listeners.forEach((l) => l(s));
}

export async function currentSharing(): Promise<SharingState | null> {
  return read();
}

export async function startSharing(circleId: number, eventId: number): Promise<void> {
  const s: SharingState = { circleId, eventId, since: Date.now() };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sigue en memoria */ }
  notify(s);
}

export async function stopSharing(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ya no estaba */ }
  notify(null);
}

/** Estado vivo de lo que se comparte, para pintar «estás compartiendo» donde haga falta. */
export function useSharingState(): SharingState | null {
  const [state, setState] = useState<SharingState | null>(null);
  useEffect(() => {
    let alive = true;
    read().then((s) => { if (alive) setState(s); });
    listeners.add(setState);
    return () => { alive = false; listeners.delete(setState); };
  }, []);
  return state;
}

async function posicionActual(): Promise<{ lon: number; lat: number; acc: number | null } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const p = (await Location.getLastKnownPositionAsync({ maxAge: 30_000 }))
      ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lon: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy ?? null };
  } catch {
    return null;
  }
}

/**
 * Manda la posición al círculo cada `SHARE_EVERY_MS` mientras haya un evento abierto.
 * Se monta UNA vez en la pantalla principal. Si el servidor responde que el evento ya no
 * está abierto (409), se deja de compartir sin preguntar: nadie debe seguir mandando
 * ubicación a un evento cerrado.
 */
export function useCircleSharing(): void {
  const state = useSharingState();
  useEffect(() => {
    if (!state || Platform.OS === 'web') return;
    let alive = true;
    const enviar = async () => {
      const token = await authToken();
      const pos = await posicionActual();
      if (!alive || !token || !pos) return;
      try {
        await api.sendCirclePosition({ token }, state.circleId, state.eventId, pos);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 409 || e.status === 404)) await stopSharing();
        // Otros fallos (sin señal): se reintenta en la siguiente vuelta.
      }
    };
    void enviar();
    const reloj = setInterval(() => { void enviar(); }, SHARE_EVERY_MS);
    return () => { alive = false; clearInterval(reloj); };
  }, [state?.circleId, state?.eventId]);   // eslint-disable-line react-hooks/exhaustive-deps
}
