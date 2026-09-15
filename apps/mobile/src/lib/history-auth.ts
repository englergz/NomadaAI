// Credenciales del histórico: el token si hay sesión; si no, la llave del dispositivo.
// Módulo aparte para que el puente de sesión (lib/auth) no dependa del almacén del
// dispositivo, y para que lib/history y la cola de escrituras no se importen entre sí.
import type { HistoryAuth } from '@nomadaai/shared';

import { authToken } from '@/lib/auth';
import { getDeviceKey } from '@/lib/uid';

export async function historyAuth(): Promise<HistoryAuth> {
  const token = await authToken();
  return token ? { token } : { deviceKey: await getDeviceKey() };
}
