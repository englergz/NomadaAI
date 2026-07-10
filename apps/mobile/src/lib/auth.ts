// Puente de sesión Clerk para módulos no-React (histórico, reportes): un componente
// bajo el ClerkProvider registra aquí el getToken y el userId activos. Sin sesión
// (o sin clave configurada) todo sigue funcionando en modo invitado — igual que en
// el panel de escritorio.
let tokenGetter: (() => Promise<string | null>) | null = null;
let clerkUserId: string | null = null;

export const CLERK_ENABLED = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function registerAuth(
  getToken: (() => Promise<string | null>) | null,
  userId: string | null,
) {
  tokenGetter = getToken;
  clerkUserId = userId;
}

// Token de sesión (o null en invitado). Nunca lanza: el flujo no depende del login.
export async function authToken(): Promise<string | null> {
  try { return tokenGetter ? await tokenGetter() : null; } catch { return null; }
}

// Id de usuario Clerk activo (o null en invitado).
export function authUserId(): string | null {
  return clerkUserId;
}
