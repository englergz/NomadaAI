// Identidad anónima persistente del dispositivo (mismo esquema que el panel web):
// habilita el histórico «Tu protección» y BI sin registro. Se enlazará al login real
// sin cambiar el esquema (la API prioriza el token cuando existe).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nomadaai_uid';
let cached: string | null = null;

export async function getUid(): Promise<string> {
  if (cached) return cached;
  try {
    let u = await AsyncStorage.getItem(KEY);
    if (!u) {
      u = globalThis.crypto?.randomUUID?.() ?? `u_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(KEY, u);
    }
    cached = u;
    return u;
  } catch {
    return 'anon';
  }
}
