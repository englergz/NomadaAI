// Panel de administración (U6). Solo se monta si /admin/me confirmó el rol EN
// SERVIDOR (token Clerk + allowlist ADMIN_USER_IDS); aquí no se decide nada de
// seguridad, solo se consume la API admin con el Bearer.
//
// Pestañas: Configuración (niveles de protección del producto, publicidad),
// Reportes (moderación de reportes ciudadanos) y BI (uso agregado).
import { useCallback, useEffect, useState } from "react";

const base = () => import.meta.env.VITE_API_URL ?? "";

interface Report {
  id: number; created_at: string; city: string; user_id: string;
  category: string; description: string | null; lon: number; lat: number; hour: number | null;
}
interface AppCfg { protection_levels: number[]; ads_enabled: boolean }

export default function AdminPanel({ getToken, onClose, onConfigSaved }: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onConfigSaved: (cfg: AppCfg) => void;
}) {
  const [tab, setTab] = useState<"config" | "reports" | "bi">("config");
  const [cfg, setCfg] = useState<AppCfg | null>(null);
  const [levelsTxt, setLevelsTxt] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [bi, setBi] = useState<any>(null);
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
    call("/config/app").then((c: AppCfg) => { setCfg(c); setLevelsTxt(c.protection_levels.join(", ")); }).catch(() => setMsg("No se pudo cargar la configuración."));
    call("/admin/reports?limit=200").then((r) => setReports(r.reports)).catch(() => { /* pestaña lo reintenta */ });
    call("/admin/summary").then(setBi).catch(() => { /* idem */ });
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
      setMsg("✓ Guardado: aplica a apps y escritorio.");
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

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal admin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="help-x" onClick={onClose} title="Cerrar">✕</button>
        <h2>Panel de administración</h2>
        <div className="admin-tabs">
          {([["config", "Configuración"], ["reports", `Reportes (${reports.length})`], ["bi", "BI"]] as const).map(([k, lbl]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{lbl}</button>
          ))}
        </div>
        {msg && <p className="admin-msg">{msg}</p>}

        {tab === "config" && cfg && (
          <div className="admin-sec">
            <label className="lbl">Niveles de protección (% separados por coma, 2–7 valores ascendentes)</label>
            <input className="select" value={levelsTxt} onChange={(e) => setLevelsTxt(e.target.value)} />
            <p className="counts-cap">Se mapean a λ del ruteo (pct/20). Aplica a la app móvil y al escritorio al recargar.</p>
            <label className="admin-check">
              <input type="checkbox" checked={cfg.ads_enabled} onChange={(e) => setCfg({ ...cfg, ads_enabled: e.target.checked })} />
              Publicidad sutil habilitada (U7-BIZ; mantener apagada hasta publicar en tiendas)
            </label>
            <button onClick={saveConfig} disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
          </div>
        )}

        {tab === "reports" && (
          <div className="admin-sec">
            {reports.length === 0 ? <p className="hint">Sin reportes (o sin base de datos configurada).</p> : (
              <div className="admin-table">
                {reports.map((r) => (
                  <div className="admin-row" key={r.id}>
                    <div className="admin-row-main">
                      <b>#{r.id}</b> · {new Date(r.created_at).toLocaleString("es-CO")} · {r.city} · <b>{r.category}</b>
                      {r.description ? <div className="admin-desc">{r.description}</div> : null}
                      <div className="admin-meta">({r.lat.toFixed(4)}, {r.lon.toFixed(4)}) · hora {r.hour ?? "—"} · usuario {r.user_id.slice(0, 14)}…</div>
                    </div>
                    <button className="secondary admin-del" onClick={() => removeReport(r.id)}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "bi" && (
          <div className="admin-sec">
            {!bi ? <p className="hint">Cargando…</p> : (
              <>
                <h3>Reportes ciudadanos</h3>
                <p className="hint">Total: <b>{bi.reports?.total ?? 0}</b></p>
                {bi.reports?.by_category && Object.entries(bi.reports.by_category).map(([k, v]) => (
                  <p className="hint" key={k}>· {k}: <b>{String(v)}</b></p>
                ))}
                <h3>Uso (histórico global)</h3>
                <pre className="admin-pre">{JSON.stringify(bi.history, null, 2)}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
