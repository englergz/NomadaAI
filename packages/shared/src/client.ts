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
} from "./types";

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
      throw new Error(`API ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  health() {
    return this.req<HealthResponse>("/health");
  }

  /**
   * Borrado de los datos del usuario en el SERVIDOR (Ley 1581: derecho de
   * supresión). Con token borra los del usuario autenticado; sin él, los del
   * identificador anónimo del dispositivo.
   */
  deleteMyData(userId: string, city = "tumaco", token?: string | null) {
    const q = new URLSearchParams({ city, user_id: userId });
    return this.req<{ ok?: boolean; error?: string }>(`/history?${q}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

  riskZones(bbox?: [number, number, number, number], city?: string) {
    const q = new URLSearchParams();
    if (bbox) q.set("bbox", bbox.join(","));
    if (city) q.set("city", city);
    const qs = q.toString();
    return this.req<RiskZonesResponse>(`/risk/zones${qs ? `?${qs}` : ""}`);
  }

  // Ciudades con superficie de riesgo disponible (U3).
  riskCities() {
    return this.req<{ cities: string[] }>("/risk/cities");
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

  reportIncident(body: IncidentReport, token?: string | null) {
    return this.req<IncidentResponse>("/incidents/report", {
      method: "POST",
      body: JSON.stringify(body),
      ...(token ? { headers: { "content-type": "application/json", Authorization: `Bearer ${token}` } } : {}),
    });
  }
}
