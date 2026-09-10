// ARRANQUE REAL: qué ha cargado la app y qué no.
//
// La animación de bienvenida no es decoración: debe durar lo que dura la carga
// (ajustes, ubicación, capa de riesgo) y salir en cuanto todo está, con un tope de
// 4 s para no retener nunca al usuario. Este módulo es la única fuente de verdad
// de ese estado; el splash lo lee y las pantallas lo van marcando.
import { useSyncExternalStore } from 'react';

export type BootStep = 'settings' | 'location' | 'risk';

const ORDER: BootStep[] = ['settings', 'location', 'risk'];
const state: Record<BootStep, boolean> = { settings: false, location: false, risk: false };
const subs = new Set<() => void>();

/** Marca un paso como terminado (con éxito o con fallo: lo que importa es que ya no se espera). */
export function markBootReady(step: BootStep): void {
  if (state[step]) return;
  state[step] = true;
  subs.forEach((f) => f());
}

export function bootReady(): boolean {
  return ORDER.every((s) => state[s]);
}

/** Primer paso pendiente, para contarle al usuario qué se está haciendo. */
export function bootStep(): BootStep | null {
  return ORDER.find((s) => !state[s]) ?? null;
}

function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}

// Un solo valor primitivo por snapshot: useSyncExternalStore exige identidad estable.
function snapshot(): string {
  return ORDER.map((s) => (state[s] ? '1' : '0')).join('');
}

export function useBoot(): { ready: boolean; step: BootStep | null } {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return { ready: bootReady(), step: bootStep() };
}

/** Solo pruebas. */
export function _resetBootForTests(): void {
  for (const s of ORDER) state[s] = false;
}
