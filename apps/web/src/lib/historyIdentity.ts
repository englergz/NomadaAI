// Identidad del histórico en el escritorio. Lo común (formato de la llave, cabeceras y
// reclamo del uid anterior) está en @nomadaai/shared; aquí solo lo del navegador.
import { claimLegacyHistoryOnce, isDeviceKey, newDeviceKey, type FlagStore } from "@nomadaai/shared";
import { api } from "./api";

const DEVICE_KEY = "nomadaai_devkey_v1";
/** uid anónimo que el escritorio usaba antes de la llave: solo se lee para reclamar lo suyo. */
const LEGACY_UID = "nomadaai_uid";

/**
 * Llave del dispositivo, o null si el navegador no deja guardarla o no tiene generador
 * criptográfico: sin llave no hay histórico propio en el servidor, pero nunca una débil.
 */
export function getDeviceKey(): string | null {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (isDeviceKey(saved)) return saved;
    const fresh = newDeviceKey((n) => crypto.getRandomValues(new Uint8Array(n)));
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

const flags: FlagStore = {
  get: async (k) => localStorage.getItem(k),
  set: async (k, v) => { localStorage.setItem(k, v); },
};

/** Reclama una vez el histórico guardado con el uid anterior de este navegador. */
export async function claimLegacyHistory(): Promise<boolean> {
  let legacy: string | null = null;
  try { legacy = localStorage.getItem(LEGACY_UID); } catch { /* sin almacenamiento */ }
  return claimLegacyHistoryOnce(api, getDeviceKey(), legacy, flags);
}
