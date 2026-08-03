// Vista previa de una paleta de riesgo como RAMPA CONTINUA, igual que en el
// escritorio. Los colores salen de @nomadaai/shared (misma fuente que pinta el
// mapa), así que lo que ves aquí es de verdad la escala que verás en el mapa.
//
// En web la rampa es un linear-gradient de CSS; en nativo no existe, así que se
// dibuja con SVG. El contenido es el mismo; solo cambia la técnica de pintado.
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { HEAT_PALETTES, type HeatPaletteKey } from '@nomadaai/shared';

export default function PaletteRamp({
  palette, width = 56, height = 8,
}: {
  palette: HeatPaletteKey;
  width?: number;
  height?: number;
}) {
  // La escala real lleva alfa creciente (para superponerse al mapa); en la vista
  // previa se muestra opaca, si no el primer tramo sería invisible.
  const colors = HEAT_PALETTES[palette].colors.map((c) => c.replace(/[\d.]+\)$/, '1)'));
  const id = `ramp-${palette}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {colors.map((col, i) => (
            <Stop key={col} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={col} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={`url(#${id})`} />
    </Svg>
  );
}
