// Vehículo ilustrado estilo Uber/Rappi (SVG, react-native-svg): vista cenital con
// un poco de perspectiva, sombra, carrocería por color de tipo, techo/parabrisas y
// ruedas asomando. Rota al rumbo. Se ve como marcador de app de movilidad, no un punto.
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';

export const VEHICLE_COLORS: Record<string, { body: string; roof: string }> = {
  moto: { body: '#f97316', roof: '#c2410c' },
  car: { body: '#2f81f7', roof: '#1e5fc0' },
  bus: { body: '#16a34a', roof: '#0f7a37' },
  truck: { body: '#f59e0b', roof: '#b45309' },
};

// Cada sprite dibuja el vehículo apuntando hacia ARRIBA (norte). El contenedor lo rota.
function Car({ body, roof }: { body: string; roof: string }) {
  return (
    <Svg width={38} height={46} viewBox="0 0 38 46">
      <Ellipse cx="19" cy="40" rx="12" ry="5" fill="#000" opacity={0.22} />
      {/* ruedas */}
      <Rect x="3" y="12" width="5" height="10" rx="2.5" fill="#111827" />
      <Rect x="30" y="12" width="5" height="10" rx="2.5" fill="#111827" />
      <Rect x="3" y="26" width="5" height="10" rx="2.5" fill="#111827" />
      <Rect x="30" y="26" width="5" height="10" rx="2.5" fill="#111827" />
      {/* carrocería */}
      <Rect x="6" y="6" width="26" height="34" rx="11" fill={body} stroke="#fff" strokeWidth={1.5} />
      {/* techo */}
      <Rect x="10" y="15" width="18" height="16" rx="6" fill={roof} />
      {/* parabrisas delantero (claro) */}
      <Path d="M11 15 Q19 9 27 15 L25 19 L13 19 Z" fill="#bfe0ff" />
      {/* luneta trasera */}
      <Path d="M13 31 L25 31 L27 35 Q19 39 11 35 Z" fill="#9fb8d6" opacity={0.7} />
    </Svg>
  );
}

function Moto({ body, roof }: { body: string; roof: string }) {
  return (
    <Svg width={26} height={44} viewBox="0 0 26 44">
      <Ellipse cx="13" cy="38" rx="8" ry="4" fill="#000" opacity={0.22} />
      <Rect x="9" y="3" width="8" height="9" rx="4" fill="#111827" />{/* rueda delantera */}
      <Rect x="9" y="30" width="8" height="9" rx="4" fill="#111827" />{/* rueda trasera */}
      <Rect x="7.5" y="10" width="11" height="22" rx="5.5" fill={body} stroke="#fff" strokeWidth={1.4} />
      <Ellipse cx="13" cy="17" rx="4.5" ry="3.5" fill={roof} />{/* casco/piloto */}
      <Rect x="10" y="22" width="6" height="7" rx="3" fill="#1f2937" />{/* asiento */}
    </Svg>
  );
}

function Bus({ body, roof }: { body: string; roof: string }) {
  return (
    <Svg width={34} height={50} viewBox="0 0 34 50">
      <Ellipse cx="17" cy="44" rx="12" ry="5" fill="#000" opacity={0.22} />
      <Rect x="2" y="12" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="28" y="12" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="2" y="29" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="28" y="29" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="5" y="4" width="24" height="42" rx="7" fill={body} stroke="#fff" strokeWidth={1.5} />
      <Path d="M9 8 Q17 5 25 8 L25 12 L9 12 Z" fill="#bfe0ff" />{/* parabrisas */}
      {[16, 22, 28, 34].map((y) => (
        <Rect key={y} x="9" y={y} width="16" height="4" rx="1.5" fill={roof} />
      ))}
    </Svg>
  );
}

function Truck({ body, roof }: { body: string; roof: string }) {
  return (
    <Svg width={34} height={50} viewBox="0 0 34 50">
      <Ellipse cx="17" cy="45" rx="12" ry="5" fill="#000" opacity={0.22} />
      <Rect x="2" y="14" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="28" y="14" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="2" y="30" width="4" height="9" rx="2" fill="#111827" />
      <Rect x="28" y="30" width="4" height="9" rx="2" fill="#111827" />
      {/* cabina */}
      <Rect x="6" y="4" width="22" height="13" rx="5" fill={roof} stroke="#fff" strokeWidth={1.5} />
      <Path d="M9 7 Q17 4.5 25 7 L24 11 L10 11 Z" fill="#bfe0ff" />
      {/* carga */}
      <Rect x="5" y="17" width="24" height="27" rx="4" fill={body} stroke="#fff" strokeWidth={1.5} />
    </Svg>
  );
}

export default function VehicleSprite3D({ type, heading = 0, scale = 1 }: {
  type: string | null;
  heading?: number;
  scale?: number;
}) {
  const col = VEHICLE_COLORS[type ?? 'car'] ?? VEHICLE_COLORS.car;
  const Body = type === 'moto' ? Moto : type === 'bus' ? Bus : type === 'truck' ? Truck : Car;
  return (
    <G transform={`rotate(${heading}) scale(${scale})`}>
      <Body {...col} />
    </G>
  );
}

// Envoltura para React Native (fuera de un <Svg>): el <G> no puede ir suelto, así que
// esta versión ya trae su propia rotación por transform de View en el llamador.
export function VehicleSpriteView({ type }: { type: string | null }) {
  const col = VEHICLE_COLORS[type ?? 'car'] ?? VEHICLE_COLORS.car;
  if (type === 'moto') return <Moto {...col} />;
  if (type === 'bus') return <Bus {...col} />;
  if (type === 'truck') return <Truck {...col} />;
  return <Car {...col} />;
}
