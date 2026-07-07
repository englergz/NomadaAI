// Cliente de la API Nómada.AI — reutiliza el contrato compartido del monorepo.
import { NomadaApi } from '@nomadaai/shared';

// EXPO_PUBLIC_* se inyecta en build; por defecto apunta a la API en vivo.
const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://englergz-nomadaai.hf.space';

export const api = new NomadaApi(baseUrl);
export { baseUrl };
