// COMPARTIR POSICIÓN CON CÍRCULOS, solo mientras hay un aviso abierto en cada uno.
//
// Cuando alguien pide ayuda —o salta uno de sus disparadores durante el recorrido— cada
// círculo afectado necesita saber dónde está y hacia dónde va. Aquí vive ese «mientras»: qué
// avisos están abiertos (uno por círculo como mucho) y el reloj que manda la posición a todos
// ellos. En cuanto un aviso se cierra —la persona dice que está bien, termina el recorrido
// que lo abrió o el servidor lo cerró— se deja de mandar a ese círculo, y el servidor borra el
// rastro.
//
// Qué se guarda en el teléfono: SOLO qué avisos están abiertos (círculo, aviso, motivo, desde
// cuándo). Nunca posiciones: esas van directo al servidor y viven lo que vive el aviso.
//
// Alcance de esta versión, dicho claro: manda con la app abierta. Con la app cerrada, el
// aviso a los miembros necesita push desde el servidor, pendiente de decisión.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, type CircleEventKind } from '@nomadaai/shared';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { authToken } from '@/lib/auth';

const KEY = 'nomadaai.circles.sharing.v2';
/** Cada cuánto se manda la posición: lo bastante seguido para seguir a alguien que se mueve. */
export const SHARE_EVERY_MS = 15_000;

export interface SharingState {
  circleId: number;
  eventId: number;
  /** Por qué se abrió. Lo automático se cierra al terminar el recorrido; el pánico, no. */
  kind: CircleEventKind;
  since: number;
}

type Listener = (s: SharingState[]) => void;
const listeners = new Set<Listener>();

async function read(): Promise<SharingState[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const lista = raw ? (JSON.parse(raw) as SharingState[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

async function write(lista: SharingState[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(lista)); } catch { /* sigue en memoria */ }
  listeners.forEach((l) => l(lista));
}

export async function currentSharing(): Promise<SharingState[]> {
  return read();
}

/** Empieza (o reemplaza) el aviso abierto de un círculo. */
export async function startSharing(circleId: number, eventId: number, kind: CircleEventKind): Promise<void> {
  const lista = (await read()).filter((s) => s.circleId !== circleId);
  lista.push({ circleId, eventId, kind, since: Date.now() });
  await write(lista);
}

/** Deja de mandar a un círculo; sin círculo, a todos. */
export async function stopSharing(circleId?: number): Promise<void> {
  const lista = circleId === undefined ? [] : (await read()).filter((s) => s.circleId !== circleId);
  await write(lista);
}

/** Estado vivo de lo que se comparte, para pintar «estás compartiendo» donde haga falta. */
export function useSharingState(): SharingState[] {
  const [state, setState] = useState<SharingState[]>([]);
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
 * Manda la posición a cada círculo con aviso abierto, cada `SHARE_EVERY_MS`. Se monta UNA
 * vez en la pantalla principal. Si el servidor responde que un aviso ya no está abierto (409)
 * o el círculo ya no existe para ti (404), se deja de mandar a ese círculo sin preguntar:
 * nadie debe seguir mandando ubicación a un aviso cerrado.
 */
export function useCircleSharing(): void {
  const lista = useSharingState();
  const firma = lista.map((s) => `${s.circleId}:${s.eventId}`).join(',');
  useEffect(() => {
    if (!lista.length || Platform.OS === 'web') return;
    let alive = true;
    const enviar = async () => {
      const token = await authToken();
      const pos = await posicionActual();
      if (!alive || !token || !pos) return;
      for (const s of lista) {
        try {
          await api.sendCirclePosition({ token }, s.circleId, s.eventId, pos);
        } catch (e) {
          if (e instanceof ApiError && (e.status === 409 || e.status === 404)) await stopSharing(s.circleId);
          // Otros fallos (sin señal): se reintenta en la siguiente vuelta.
        }
      }
    };
    void enviar();
    const reloj = setInterval(() => { void enviar(); }, SHARE_EVERY_MS);
    return () => { alive = false; clearInterval(reloj); };
  }, [firma]);   // eslint-disable-line react-hooks/exhaustive-deps
}
