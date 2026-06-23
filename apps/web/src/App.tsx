import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  FeatureCollection as ApiFC,
  HealthResponse,
  DemoResponse,
  TripSummary,
} from "@nomadaai/shared";
import { api } from "./lib/api";
import { osmStyle, TUMACO_CENTER, TUMACO_ZOOM } from "./lib/mapStyle";

const TYPE_LABEL: Record<string, string> = {
  mot: "Motocicleta",
  car: "Carro",
  bus: "Bus",
  truck: "Camión",
  taxi: "Taxi",
};

export default function App() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [demo, setDemo] = useState<DemoResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "observando" | "prediciendo" | "listo">("idle");

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: osmStyle,
      center: TUMACO_CENTER,
      zoom: TUMACO_ZOOM,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("load", async () => {
      try {
        const fc = (await api.corridors(undefined, 8000)) as ApiFC;
        map.addSource("corridors", { type: "geojson", data: fc as never });
        map.addLayer({
          id: "corridors",
          type: "line",
          source: "corridors",
          paint: { "line-color": "#9aa7b2", "line-width": 1, "line-opacity": 0.35 },
        });
      } catch (e) {
        console.error("corredores:", e);
      }
      // capas de la demo (vacías al inicio)
      addLine(map, "truth", { "line-color": "#22c55e", "line-width": 4, "line-opacity": 0.5, "line-dasharray": [2, 2] });
      addLine(map, "prefix", { "line-color": "#2f81f7", "line-width": 5 });
      addLine(map, "pred", { "line-color": "#f97316", "line-width": 5 });
      addPoint(map, "cursor", { "circle-radius": 8, "circle-color": "#f97316", "circle-stroke-color": "#fff", "circle-stroke-width": 2 });
      addPoint(map, "dest", { "circle-radius": 9, "circle-color": "#22c55e", "circle-stroke-color": "#fff", "circle-stroke-width": 2 });
    });

    api.health().then(setHealth).catch(console.error);
    api.tripsSample(40).then((r) => setTrips(r.trips)).catch(console.error);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.remove();
    };
  }, []);

  function clearLayers() {
    const map = mapRef.current!;
    for (const id of ["truth", "prefix", "pred"]) setLine(map, id, []);
    for (const id of ["cursor", "dest"]) setPoint(map, id, null);
  }

  async function runDemo(tripId?: string) {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (!trips.length) return;
    const id = tripId ?? trips[Math.floor(Math.random() * trips.length)].id;
    setBusy(true);
    setDemo(null);
    setPhase("idle");
    try {
      clearLayers();
    } catch {
      /* el mapa puede no estar listo aún */
    }

    // 1) Traer los datos (esto es lo que bloquea el botón)
    let d: DemoResponse;
    try {
      d = await api.tripDemo(id, 3);
    } catch (e) {
      console.error(e);
      alert("Error: " + (e as Error).message);
      setBusy(false);
      return;
    }
    setDemo(d);
    setBusy(false);

    // 2) Dibujar y animar (best-effort: requiere el mapa cargado)
    const map = mapRef.current;
    if (!map) return;
    try {
      const all = [...d.prefix, ...d.truth];
      const b = all.reduce(
        (acc, [lon, lat]) => [
          Math.min(acc[0], lon),
          Math.min(acc[1], lat),
          Math.max(acc[2], lon),
          Math.max(acc[3], lat),
        ],
        [180, 90, -180, -90]
      );
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 80, duration: 800, maxZoom: 16 }
      );
      setLine(map, "truth", d.truth.length ? [d.prefix[d.prefix.length - 1], ...d.truth] : []);
      const pred = d.candidates[0]?.coordinates ?? [];
      await animate(map, d.prefix, "prefix", "cursor", 1600, () => setPhase("observando"));
      setPhase("prediciendo");
      await animate(map, [d.prefix[d.prefix.length - 1], ...pred], "pred", "cursor", 1800);
      if (pred.length) setPoint(map, "dest", pred[pred.length - 1]);
      setPhase("listo");
    } catch (e) {
      console.error("animación:", e);
    }
  }

  // animación por interpolación de distancia (velocidad constante)
  function animate(
    map: maplibregl.Map,
    coords: [number, number][],
    lineId: string,
    cursorId: string,
    durationMs: number,
    onStart?: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const pts = coords.filter(Boolean) as [number, number][];
      if (pts.length < 2) {
        setLine(map, lineId, pts);
        resolve();
        return;
      }
      onStart?.();
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs);
        const { line, point } = sliceByT(pts, t);
        setLine(map, lineId, line);
        setPoint(map, cursorId, point);
        if (t < 1) {
          animRef.current = requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      animRef.current = requestAnimationFrame(step);
    });
  }

  return (
    <>
      <div id="map" ref={containerRef} />
      <div className="panel">
        <h1>NómadaAI</h1>
        <p className="subtitle">Gestión segura de rutas urbanas · Tumaco, Nariño</p>

        <div className="status">
          {health
            ? `${health.n_trajectories.toLocaleString()} viajes · ${health.n_corridors.toLocaleString()} corredores`
            : "Conectando…"}
        </div>

        <h2>Predicción de destino (OE1)</h2>
        <p className="hint">
          Elige un viaje real. El mapa muestra el{" "}
          <b style={{ color: "#2f81f7" }}>recorrido observado</b> y el sistema predice su{" "}
          <b style={{ color: "#f97316" }}>continuación</b>, comparándola con el{" "}
          <b style={{ color: "#22c55e" }}>recorrido real</b>.
        </p>

        <button onClick={() => runDemo()} disabled={busy || !trips.length}>
          {busy ? "Calculando…" : "▶ Predecir un viaje (aleatorio)"}
        </button>

        <div className="row">
          <select
            className="select"
            value={demo?.id ?? ""}
            onChange={(e) => e.target.value && runDemo(e.target.value)}
            disabled={busy || !trips.length}
          >
            <option value="">…o elige uno de la lista</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {TYPE_LABEL[t.type] ?? t.type} · {t.id} ({t.n_points} pts)
              </option>
            ))}
          </select>
        </div>

        {demo && (
          <div className="result">
            <div className="result-row">
              <span className="dot blue" /> Observado: <b>{demo.id}</b> ({TYPE_LABEL[demo.type] ?? demo.type})
            </div>
            <div className="result-row">
              <span className="dot orange" /> Predicción por analogía (vecino{" "}
              <b>{demo.candidates[0]?.neighbor_id ?? "—"}</b>)
            </div>
            <div className="result-row">
              <span className="dot green" /> Recorrido real (lo oculto)
            </div>
            {demo.fde_m != null && (
              <div className="metric">
                Acierto: predicho a <b>{demo.fde_m.toFixed(0)} m</b> del punto real
                {demo.horizon_m ? ` (horizonte ${demo.horizon_m.toFixed(0)} m)` : ""}
              </div>
            )}
            <div className="badge" style={{ marginTop: 6 }}>
              {phase === "observando" && "Observando recorrido…"}
              {phase === "prediciendo" && "Prediciendo destino…"}
              {phase === "listo" && "✓ Predicción completa"}
            </div>
          </div>
        )}

        <h2>Capa de riesgo (OE2)</h2>
        <p className="badge">Pendiente — próxima fase con datos de incidentes.</p>
      </div>
    </>
  );
}

// ---------- helpers de geometría / animación ----------
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// devuelve la polilínea recorrida hasta la fracción t (0..1) y el punto actual
function sliceByT(
  pts: [number, number][],
  t: number
): { line: [number, number][]; point: [number, number] } {
  const segs = pts.slice(1).map((p, i) => haversine(pts[i], p));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  const target = t * total;
  let acc = 0;
  const line: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const seg = segs[i - 1];
    if (acc + seg >= target) {
      const f = (target - acc) / (seg || 1);
      const lon = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
      const lat = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
      line.push([lon, lat]);
      return { line, point: [lon, lat] };
    }
    acc += seg;
    line.push(pts[i]);
  }
  return { line, point: pts[pts.length - 1] };
}

// ---------- helpers de mapa ----------
function addLine(map: maplibregl.Map, id: string, paint: Record<string, unknown>) {
  map.addSource(id, { type: "geojson", data: emptyFC() as never });
  map.addLayer({
    id,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint,
  } as never);
}
function addPoint(map: maplibregl.Map, id: string, paint: Record<string, unknown>) {
  map.addSource(id, { type: "geojson", data: emptyFC() as never });
  map.addLayer({ id, type: "circle", source: id, paint } as never);
}
function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}
function setLine(map: maplibregl.Map, id: string, coords: [number, number][]) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  src?.setData(
    coords.length >= 2
      ? ({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} } as never)
      : (emptyFC() as never)
  );
}
function setPoint(map: maplibregl.Map, id: string, coord: [number, number] | null) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  src?.setData(
    coord
      ? ({ type: "Feature", geometry: { type: "Point", coordinates: coord }, properties: {} } as never)
      : (emptyFC() as never)
  );
}
