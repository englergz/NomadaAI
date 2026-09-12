// PANEL DE ADMINISTRACIÓN (U6). Solo se monta si /admin/me confirmó el rol EN
// SERVIDOR (token Clerk + allowlist ADMIN_USER_IDS); aquí no se decide nada de
// seguridad, solo se consume la API admin con el Bearer.
//
// Forma: superficie propia a pantalla completa con MENÚ LATERAL, como cualquier
// panel de administración — antes eran pestañas dentro de un modal estrecho y no
// cabía nada. Secciones: Resumen · Ciudades · Configuración · Reportes · Opiniones.
//
// Regla de honestidad: lo que no se puede cambiar desde aquí se muestra como
// lectura y se explica por qué. Los pesos de riesgo son el caso claro: cambiarlos
// exige re-correr el pipeline offline y regenerar la malla, así que el panel los
// enseña con su motivo en vez de fingir un formulario que no haría nada.
import { useCallback, useEffect, useState } from "react";

const base = () => import.meta.env.VITE_API_URL ?? "";

type Section = "resumen" | "ciudades" | "config" | "reportes" | "opiniones";

interface Report {
  id: number; created_at: string; city: string; user_id: string;
  category: string; description: string | null; lon: number; lat: number; hour: number | null;
}
interface AppCfg { protection_levels: number[]; ads_enabled: boolean }
interface Factor {
  name: string; enabled: boolean; weight: number;
  temporal_profile?: string; fuente?: string; motivo?: string;
}
interface CityInfo {
  city: string;
  risk: { available: boolean; cells?: number; hours?: number; max_risk?: number };
  routing: { available: boolean; source?: string; loaded?: boolean; nodes?: number; edges?: number; artifact_mb?: number };
  prediction: { available: boolean; train?: number; test?: number };
  config: { night_floor?: number; factors: Factor[]; active: number; weight_sum: number } | null;
}

const SECTIONS: { key: Section; label: string; hint: string }[] = [
  { key: "resumen", label: "Resumen", hint: "Uso y aportes de la comunidad" },
  { key: "ciudades", label: "Ciudades", hint: "Qué tiene cada una y qué le falta" },
  { key: "config", label: "Configuración", hint: "Producto: protección y publicidad" },
  { key: "reportes", label: "Reportes", hint: "Moderación de reportes ciudadanos" },
  { key: "opiniones", label: "Opiniones", hint: "Formulario de la app" },
];

const nf = (n: unknown) => (typeof n === "number" ? n.toLocaleString("es-CO") : "—");

function Kpi({ value, label, tone }: { value: string; label: string; tone?: "accent" | "ok" | "amber" }) {
  return (
    <div className={`adm-kpi${tone ? ` t-${tone}` : ""}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Estado de un ingrediente de la ciudad (riesgo · ruteo · predicción). */
function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={`adm-chip${on ? " on" : ""}`}>{children}</span>;
}

export default function AdminPanel({ getToken, onClose, onConfigSaved }: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onConfigSaved: (cfg: AppCfg) => void;
}) {
  const [sec, setSec] = useState<Section>("resumen");
  const [cfg, setCfg] = useState<AppCfg | null>(null);
  const [levelsTxt, setLevelsTxt] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [cities, setCities] = useState<CityInfo[] | null>(null);
  const [bi, setBi] = useState<any>(null);
  const [fb, setFb] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    const res = await fetch(`${base()}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? `HTTP ${res.status}`);
    return res.json();
  }, [getToken]);

  useEffect(() => {
    call("/config/app").then((c: AppCfg) => { setCfg(c); setLevelsTxt(c.protection_levels.join(", ")); })
      .catch(() => setMsg("No se pudo cargar la configuración."));
    call("/admin/reports?limit=200").then((r) => setReports(r.reports)).catch(() => { /* la sección lo dice */ });
    call("/admin/summary").then(setBi).catch(() => { /* idem */ });
    call("/admin/feedback?limit=200").then(setFb).catch(() => { /* idem */ });
    call("/admin/cities").then((r) => setCities(r.cities)).catch(() => setCities([]));
  }, [call]);

  async function saveConfig() {
    if (!cfg) return;
    const levels = levelsTxt.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    setBusy(true); setMsg("");
    try {
      const saved = await call("/admin/config/app", {
        method: "PUT",
        body: JSON.stringify({ protection_levels: levels, ads_enabled: cfg.ads_enabled }),
      });
      setCfg(saved); setLevelsTxt(saved.protection_levels.join(", "));
      onConfigSaved(saved);
      setMsg("✓ Guardado: aplica a la app móvil y al escritorio al recargar.");
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  async function removeReport(id: number) {
    if (!window.confirm(`¿Eliminar el reporte #${id}? Esta acción no se puede deshacer.`)) return;
    try {
      await call(`/admin/reports/${id}`, { method: "DELETE" });
      setReports((p) => p.filter((r) => r.id !== id));
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
  }

  const shown = cityFilter ? reports.filter((r) => r.city === cityFilter) : reports;
  const cityOptions = [...new Set(reports.map((r) => r.city))].sort();

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-shell" onClick={(e) => e.stopPropagation()}>
        <aside className="adm-side">
          <div className="adm-brand">Administración</div>
          <nav>
            {SECTIONS.map((s) => (
              <button key={s.key} className={sec === s.key ? "on" : ""} onClick={() => setSec(s.key)}>
                <b>{s.label}</b>
                <span>{s.hint}</span>
              </button>
            ))}
          </nav>
          <div className="adm-side-foot">
            Los cambios de configuración aplican a la app y al escritorio.
          </div>
        </aside>

        <main className="adm-main">
          <header className="adm-head">
            <h2>{SECTIONS.find((s) => s.key === sec)?.label}</h2>
            <button className="adm-x" onClick={onClose} title="Cerrar">✕</button>
          </header>
          {msg && <p className="adm-msg">{msg}</p>}

          {sec === "resumen" && (
            <section className="adm-sec">
              <div className="adm-kpis">
                <Kpi value={nf(bi?.history?.trips)} label="viajes registrados" tone="accent" />
                <Kpi value={nf(bi?.history?.users)} label="personas / dispositivos" />
                <Kpi value={nf(bi?.history?.alerts)} label="alertas emitidas" tone="amber" />
                <Kpi value={nf(bi?.reports?.total)} label="reportes ciudadanos" tone="ok" />
                <Kpi value={nf(fb?.summary?.total)} label="opiniones recibidas" />
              </div>
              {bi?.history?.proteccion && (
                <p className="adm-note">
                  Exposición evitada de media: <b>{bi.history.proteccion.exposure_reduction_avg_pct} %</b>{" "}
                  sobre {nf(bi.history.proteccion.n)} rutas con comparación.
                </p>
              )}
              <h3>Reportes por categoría</h3>
              {!bi?.reports?.by_category || Object.keys(bi.reports.by_category).length === 0 ? (
                <p className="adm-empty">Todavía no hay reportes.</p>
              ) : (
                <div className="adm-bars">
                  {Object.entries(bi.reports.by_category as Record<string, number>)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const max = Math.max(...Object.values(bi.reports.by_category as Record<string, number>));
                      return (
                        <div className="adm-bar" key={k}>
                          <span className="adm-bar-lbl">{k}</span>
                          <span className="adm-bar-track"><i style={{ width: `${(v / max) * 100}%` }} /></span>
                          <b>{v}</b>
                        </div>
                      );
                    })}
                </div>
              )}
              <h3>Por ciudad</h3>
              {!bi?.reports?.by_city || Object.keys(bi.reports.by_city).length === 0 ? (
                <p className="adm-empty">Sin datos.</p>
              ) : (
                <p className="adm-note">
                  {Object.entries(bi.reports.by_city as Record<string, number>)
                    .map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </p>
              )}
            </section>
          )}

          {sec === "ciudades" && (
            <section className="adm-sec">
              <p className="adm-note">
                Una ciudad necesita TRES ingredientes independientes: capa de riesgo, red vial para
                trazar rutas y modelo de predicción. Con solo riesgo ya protege durante el recorrido;
                la red vial se descarga de OpenStreetMap; la predicción exige recoger trayectorias.
              </p>
              {cities === null ? <p className="adm-empty">Cargando…</p> : cities.length === 0 ? (
                <p className="adm-empty">No se pudo consultar el estado de las ciudades.</p>
              ) : cities.map((c) => (
                <article className="adm-city" key={c.city}>
                  <div className="adm-city-head">
                    <h3>{c.city}</h3>
                    <div className="adm-chips">
                      <Chip on={c.risk.available}>
                        Riesgo{c.risk.available ? ` · ${nf(c.risk.cells)} celdas` : " · no"}
                      </Chip>
                      <Chip on={c.routing.available}>
                        Rutas{c.routing.available ? ` · ${c.routing.source === "osm" ? "OSM" : "trayectorias"}` : " · no"}
                      </Chip>
                      <Chip on={c.prediction.available}>
                        Predicción{c.prediction.available ? ` · ${nf(c.prediction.train)} entren.` : " · no"}
                      </Chip>
                    </div>
                  </div>
                  <p className="adm-meta">
                    {c.risk.available && <>Malla de {nf(c.risk.cells)} celdas · {c.risk.hours} horas · máximo {c.risk.max_risk}. </>}
                    {c.routing.available && (
                      c.routing.loaded
                        ? <>Grafo en memoria: {nf(c.routing.nodes)} nodos y {nf(c.routing.edges)} aristas. </>
                        : <>Red vial en disco ({c.routing.artifact_mb ?? "—"} MB), se carga en la primera ruta. </>
                    )}
                    {!c.prediction.available && <>Sin predicción: no hay alerta anticipada sin destino declarado.</>}
                  </p>
                  {c.config && (
                    <>
                      <div className="adm-factors-head">
                        <span>Factores del índice de riesgo</span>
                        <span className="adm-meta">
                          {c.config.active} activos · suma de pesos {c.config.weight_sum} · piso nocturno {c.config.night_floor}
                        </span>
                      </div>
                      <div className="adm-factors">
                        {c.config.factors.map((f) => (
                          <div className={`adm-factor${f.enabled ? "" : " off"}`} key={f.name}>
                            <span className="adm-f-name">{f.name}</span>
                            <span className="adm-f-weight">{f.enabled ? f.weight : "—"}</span>
                            <span className="adm-f-src">{f.fuente ?? ""}</span>
                            {f.motivo && <span className="adm-f-why">{f.motivo}</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              ))}
              <p className="adm-note adm-ro">
                Los pesos son de solo lectura: cambiarlos obliga a re-correr el pipeline offline y a
                regenerar la malla de la ciudad, con su golden test. Editarlos en caliente daría un
                mapa que no corresponde a ningún artefacto verificable.
              </p>
            </section>
          )}

          {sec === "config" && cfg && (
            <section className="adm-sec">
              <h3>Niveles de protección</h3>
              <p className="adm-note">
                Porcentajes separados por coma (de 2 a 7, ascendentes). Son los topes de la barra de
                protección y se traducen a λ del ruteo (porcentaje ÷ 20).
              </p>
              <input className="select adm-input" value={levelsTxt} onChange={(e) => setLevelsTxt(e.target.value)} />
              <h3>Publicidad</h3>
              <label className="adm-check">
                <input
                  type="checkbox"
                  checked={cfg.ads_enabled}
                  onChange={(e) => setCfg({ ...cfg, ads_enabled: e.target.checked })}
                />
                Publicidad sutil habilitada (mantener apagada hasta publicar en tiendas)
              </label>
              <div><button className="adm-save" onClick={saveConfig} disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button></div>
            </section>
          )}

          {sec === "reportes" && (
            <section className="adm-sec">
              <div className="adm-toolbar">
                <span className="adm-meta">{shown.length} de {reports.length} reportes</span>
                <select className="select adm-filter" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                  <option value="">Todas las ciudades</option>
                  {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {shown.length === 0 ? (
                <p className="adm-empty">Sin reportes (o sin base de datos configurada).</p>
              ) : (
                <div className="adm-list">
                  {shown.map((r) => (
                    <div className="adm-item" key={r.id}>
                      <div className="adm-item-main">
                        <div className="adm-item-top">
                          <b>{r.category}</b>
                          <span className="adm-meta">#{r.id} · {new Date(r.created_at).toLocaleString("es-CO")} · {r.city}</span>
                        </div>
                        {r.description && <div className="adm-item-body">{r.description}</div>}
                        <div className="adm-meta">
                          ({r.lat.toFixed(4)}, {r.lon.toFixed(4)}) · hora {r.hour ?? "—"} · usuario {String(r.user_id).slice(0, 14)}…
                        </div>
                      </div>
                      <button className="secondary adm-del" onClick={() => removeReport(r.id)}>Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {sec === "opiniones" && (
            <section className="adm-sec">
              {!fb ? <p className="adm-empty">Cargando…</p> : !fb.summary?.available ? (
                <p className="adm-empty">Sin base de datos configurada.</p>
              ) : (
                <>
                  <div className="adm-kpis">
                    {([["useful", "Utilidad"], ["on_time", "Alertas a tiempo"], ["trust", "Confianza de noche"], ["recommend", "Recomendaría"]] as const).map(([k, lbl]) => (
                      <Kpi key={k} value={String(fb.summary.promedios?.[k] ?? "—")} label={`${lbl} (1–5)`} tone="accent" />
                    ))}
                  </div>
                  <p className="adm-note">
                    {nf(fb.summary.total)} opiniones · {nf(fb.summary.ultimos_30_dias)} en 30 días ·{" "}
                    {nf(fb.summary.con_comentario)} con comentario ·{" "}
                    {Object.entries(fb.summary.por_plataforma ?? {}).map(([p, n]) => `${p} ${n}`).join(" · ") || "sin plataforma"}
                  </p>
                  <h3>Comentarios recientes</h3>
                  {(fb.recent ?? []).filter((r: any) => r.comment).length === 0 ? (
                    <p className="adm-empty">Sin comentarios todavía.</p>
                  ) : (
                    <div className="adm-list">
                      {(fb.recent ?? []).filter((r: any) => r.comment).map((r: any) => (
                        <div className="adm-item" key={r.id}>
                          <div className="adm-item-main">
                            <div className="adm-item-top">
                              <b>{r.useful}/{r.on_time}/{r.trust}/{r.recommend}</b>
                              <span className="adm-meta">#{r.id} · {new Date(r.created_at).toLocaleString("es-CO")} · {r.city} · {r.platform ?? "?"}</span>
                            </div>
                            <div className="adm-item-body">{r.comment}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
