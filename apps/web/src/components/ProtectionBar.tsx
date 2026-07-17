// Barra de PROTECCIÓN (idéntica a la app móvil): riel píldora, topes marcados,
// pulgar que se desliza, azul→morado según el nivel. Reutilizable y configurable:
// los niveles (en %) llegan por props — el panel admin los define para todo el
// producto (GET /config/app).
//
// Geometría: los topes y el pulgar viven en un RAIL interno con margen igual al
// radio del pulgar, así el primero y el último quedan DENTRO del rectángulo
// redondeado (antes 0%/100% + translate(-50%) los dejaba medio afuera).
// Interacción: Pointer Events con setPointerCapture — el arrastre no se pierde
// aunque el mouse salga del riel (el fallo de «a veces no responde»).
import { useCallback, useEffect, useRef } from "react";

// Rampa azul→morado; se muestrea según la fracción del nivel activo.
const RAMP = ["#8fc0ff", "#5fa0fb", "#2f81f7", "#4f6df6", "#6d5cf5"];
const THUMB_R = 14; // px — la mitad del pulgar (26px) + borde

export function levelColor(idx: number, count: number): string {
  const frac = count <= 1 ? 1 : idx / (count - 1);
  return RAMP[Math.round(frac * (RAMP.length - 1))];
}

export default function ProtectionBar({ levels, value, onChange, disabled }: {
  levels: number[];            // topes en % (ascendentes), ej. [0,25,50,75,100]
  value: number;               // % actual (se ancla al tope más cercano)
  onChange: (pct: number) => void;
  disabled?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const idx = levels.reduce((best, lv, i) =>
    Math.abs(lv - value) < Math.abs(levels[best] - value) ? i : best, 0);
  const frac = levels.length <= 1 ? 0 : idx / (levels.length - 1);
  const color = levelColor(idx, levels.length);

  const pick = useCallback((clientX: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const i = Math.round(f * (levels.length - 1));
    if (levels[i] !== value) onChange(levels[i]);
  }, [levels, value, onChange]);

  // Los listeners de movimiento viven en window mientras dura el arrastre.
  useEffect(() => {
    const move = (e: PointerEvent) => { if (draggingRef.current) pick(e.clientX); };
    const up = () => { draggingRef.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [pick]);

  return (
    <div className="prot-slider" aria-disabled={disabled}>
      <div className="prot-labels"><span>Mínima</span><b>Protección</b><span>Máxima</span></div>
      <div
        className={`prot-track ${disabled ? "off" : ""}`}
        onPointerDown={(e) => {
          if (disabled) return;
          draggingRef.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          pick(e.clientX);
        }}
      >
        {/* relleno hasta el pulgar (respeta el margen del rail) */}
        <div
          className="prot-fill"
          style={{ width: `calc(${THUMB_R}px + ${frac} * (100% - ${THUMB_R * 2}px))`, background: color }}
        />
        {/* rail interno: topes y pulgar SIEMPRE dentro del redondeado */}
        <div className="prot-rail" ref={railRef}>
          {levels.map((lv, i) => (
            <span
              key={lv}
              className="prot-stop"
              title={`${lv}%`}
              style={{
                left: `${(levels.length <= 1 ? 0 : i / (levels.length - 1)) * 100}%`,
                background: i <= idx ? "#fff" : "var(--border)",
              }}
            />
          ))}
          <div className="prot-thumb" style={{ left: `${frac * 100}%`, borderColor: color }}>
            <span style={{ background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}
