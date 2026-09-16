// Cliente API tipado — consumido por web y (futuro) móvil.
import type {
  BuildRouteRequest,
  BuildRouteResponse,
  HealthResponse,
  OnlineRequest,
  OnlineResponse,
  PredictRequest,
  PredictResponse,
  FeatureCollection,
  RouteRequest,
  RouteResponse,
  RiskZonesResponse,
  IncidentReport,
  IncidentResponse,
  TripsResponse,
  DemoResponse,
  FeedbackIn,
  FeedbackResponse,
  DataDeletionResponse,
  HistorySummary,
  TripLogIn,
} from "./types";
import { DEVICE_KEY_HEADER, historyHeaders, type HistoryAuth } from "./history";

/** Con prueba de identidad, el uid anónimo anterior que traiga un cuerpo encolado sobra: no se envía. */
function withoutLegacyId<T extends { device_id?: string }>(body: T, auth?: HistoryAuth | null): T {
  if (Object.keys(historyHeaders(auth)).length === 0) return body;
  const copy = { ...body };
  delete copy.device_id;
  return copy;
}

/**
 * El servidor RESPONDIÓ y rechazó (4xx/5xx). Se distingue de «sin red» (fetch lanza
 * TypeError) porque las consecuencias son opuestas: un 4xx ya no se reintenta —hubo
 * veredicto—, un fallo de red o un 5xx sí. `detail` es el texto que manda el servidor
 * (p. ej. el aviso de límite por hora), apto para mostrar.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  constructor(status: number, bodyText: string) {
    super(`API ${status}: ${bodyText}`);
    this.name = "ApiError";
    this.status = status;
    let detail: string | null = null;
    try {
      const parsed = JSON.parse(bodyText) as { detail?: unknown };
      if (typeof parsed?.detail === "string") detail = parsed.detail;
    } catch { /* cuerpo no JSON: sin detalle */ }
    this.detail = detail;
  }
  /** El servidor no está o falló (5xx): tiene sentido reintentar más tarde. */
  get retryable(): boolean { return this.status >= 500; }
}

export class NomadaApi {
  constructor(private baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "content-type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return res.json() as Promise<T>;
  }

  health() {
    return this.req<HealthResponse>("/health");
  }

  // --- Histórico «Tu protección» ---
  // La identidad va SIEMPRE en cabeceras (token o llave del dispositivo, ver ./history):
  // el servidor ignora cualquier user_id, y en la URL acabaría en los logs de acceso.

  /**
   * Agregados del histórico: `me` (exige sesión o llave) o `global` (sin identidad).
   * null si el servidor no responde 2xx, o si se pide `me` sin credenciales.
   */
  async historySummary(
    auth: HistoryAuth | null,
    opts: { city?: string; scope?: "me" | "global" } = {},
  ): Promise<HistorySummary | null> {
    const scope = opts.scope ?? "me";
    const headers = scope === "me" ? historyHeaders(auth) : {};
    if (scope === "me" && Object.keys(headers).length === 0) return null;
    const q = new URLSearchParams({ scope });
    if (opts.city) q.set("city", opts.city);
    const res = await fetch(`${this.baseUrl}/history/summary?${q}`, { headers });
    if (!res.ok) return null;
    const body = (await res.json()) as HistorySummary;
    // Un backend anterior ignora `scope` y, sin user_id, responde lo de todos: nunca se
    // muestra como propio. Sin base de datos llega `available: false`, sin scope.
    return body.available === false || body.scope === scope ? body : null;
  }

  /** Registra un viaje. Devuelve el status HTTP; solo lanza si no hubo respuesta (sin red). */
  async logTrip(auth: HistoryAuth | null, trip: TripLogIn): Promise<number> {
    // Lo encolado por versiones anteriores puede traer `user_id`: no se envía.
    const body: Record<string, unknown> = { ...trip };
    delete body.user_id;
    const res = await fetch(`${this.baseUrl}/history/trip`, {
      method: "POST",
      headers: { "content-type": "application/json", ...historyHeaders(auth) },
      body: JSON.stringify(body),
    });
    return res.status;
  }

  /**
   * Borra el histórico de quien lo pide: en todas las ciudades, o solo en `city`.
   * Es también el borrado del servidor del derecho de supresión (Ley 1581). Lanza si
   * el servidor no acepta (401 sin credenciales válidas).
   *
   * Antes pregunta a /health si el servidor verifica la identidad del histórico. Contra
   * un backend anterior, este mismo DELETE (sin user_id) borraba la ciudad entera: si la
   * app se actualiza antes que el servidor, no se borra nada.
   */
  async deleteHistory(auth: HistoryAuth, city?: string) {
    const health = await this.health();
    if (health.history_identity !== true) {
      throw new Error("El servidor aún no verifica la identidad del histórico: no se borra nada");
    }
    const q = city ? `?${new URLSearchParams({ city })}` : "";
    return this.req<{ ok?: boolean; deleted?: number; error?: string }>(`/history${q}`, {
      method: "DELETE",
      headers: historyHeaders(auth),
    });
  }

  /** Pasa a la llave el histórico guardado con el uid anterior (ver claimLegacyHistoryOnce). */
  claimLegacyHistory(deviceKey: string, legacyId: string) {
    return this.req<{ ok?: boolean; moved?: number; error?: string }>("/history/claim", {
      method: "POST",
      headers: { "content-type": "application/json", [DEVICE_KEY_HEADER]: deviceKey },
      body: JSON.stringify({ legacy_id: legacyId }),
    });
  }

  /**
   * «Borrar mis datos» en el servidor (Ley 1581): borra el histórico y los reportes de quien lo
   * pide y desvincula sus opiniones, en una sola petición. Cuenta y dispositivo son identidades
   * distintas: se llama con cada una. Lanza si el servidor no acepta (401 sin credenciales
   * válidas) o si aún no ofrece este borrado: nunca se da por hecho un borrado que no existe.
   */
  async deleteMyData(auth: HistoryAuth) {
    const health = await this.health();
    if (health.data_deletion !== true || health.history_identity !== true) {
      throw new Error("El servidor aún no permite borrar reportes y opiniones: no se borra nada");
    }
    return this.req<DataDeletionResponse>("/me/data", {
      method: "DELETE",
      headers: historyHeaders(auth),
    });
  }

  /**
   * Config de producto que fija el panel admin (niveles de protección, etc.).
   * La consumen la app móvil y el escritorio: un solo sitio para cambiarlos.
   */
  appConfig() {
    return this.req<{ protection_levels: number[]; ads_enabled: boolean }>("/config/app");
  }

  predictDestination(body: PredictRequest) {
    return this.req<PredictResponse>("/predict/destination", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  tripsSample(n = 24) {
    return this.req<TripsResponse>(`/trajectories/sample?n=${n}`);
  }

  tripDemo(id: string, topk = 3) {
    return this.req<DemoResponse>(
      `/trajectories/${encodeURIComponent(id)}/demo?topk=${topk}`
    );
  }

  corridors(bbox?: [number, number, number, number], limit?: number) {
    const q = new URLSearchParams();
    if (bbox) q.set("bbox", bbox.join(","));
    if (limit) q.set("limit", String(limit));
    const qs = q.toString();
    return this.req<FeatureCollection>(`/corridors${qs ? `?${qs}` : ""}`);
  }

  // `hour` (0-23): sin él el servidor responde la hora 19 por defecto, y la app
  // mostraba siempre esa capa aunque fueran las 3 de la mañana.
  riskZones(bbox?: [number, number, number, number], city?: string, hour?: number) {
    const q = new URLSearchParams();
    if (bbox) q.set("bbox", bbox.join(","));
    if (city) q.set("city", city);
    if (hour !== undefined) q.set("hour", String(hour));
    const qs = q.toString();
    return this.req<RiskZonesResponse>(`/risk/zones${qs ? `?${qs}` : ""}`);
  }

  /**
   * Catálogo de ciudades que el usuario puede ENCONTRAR (lo edita el panel admin).
   * Estar aquí no da cobertura: eso lo dicen `riskCities()` y `routeCities()`.
   */
  citiesCatalog() {
    return this.req<{ cities: { key: string; label: string; country: string; center: [number, number]; zoom: number }[] }>(
      "/cities/catalog",
    );
  }

  // Ciudades con superficie de riesgo disponible.
  riskCities() {
    return this.req<{ cities: string[] }>("/risk/cities");
  }

  /**
   * Ciudades que pueden trazar RUTA SEGURA. Es un subconjunto de `riskCities`: el ruteo
   * exige además el grafo vial. Se consulta en vez de codificarlo, para que abrir una
   * ciudad nueva no obligue a publicar una versión del cliente.
   */
  routeCities() {
    return this.req<{ cities: string[] }>("/route/cities");
  }

  predictOnline(body: OnlineRequest) {
    return this.req<OnlineResponse>("/predict/online", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  buildRoute(body: BuildRouteRequest) {
    return this.req<BuildRouteResponse>("/route/build", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  pois(limit?: number) {
    const q = limit ? `?limit=${limit}` : "";
    return this.req<FeatureCollection>(`/pois${q}`);
  }

  safeRoute(body: RouteRequest) {
    return this.req<RouteResponse>("/route/safe", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Reporte ciudadano. La identidad va en cabeceras (token o llave, ver ./history): así «Borrar mis
   * datos» lo alcanza y el límite por hora es por persona.
   */
  reportIncident(body: IncidentReport, auth?: HistoryAuth | null) {
    return this.req<IncidentResponse>("/incidents/report", {
      method: "POST",
      headers: { "content-type": "application/json", ...historyHeaders(auth) },
      body: JSON.stringify(withoutLegacyId(body, auth)),
    });
  }

  /**
   * Opinión del usuario → servidor, no correo. La consumen móvil y escritorio; el panel
   * admin la lee agregada. Si el servidor no acepta, el cliente decide el respaldo.
   */
  sendFeedback(body: FeedbackIn, auth?: HistoryAuth | null) {
    return this.req<FeedbackResponse>("/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", ...historyHeaders(auth) },
      body: JSON.stringify(withoutLegacyId(body, auth)),
    });
  }
}
