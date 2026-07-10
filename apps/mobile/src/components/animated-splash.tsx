// Splash animado de arranque en frío (~3 s, mientras la app carga detrás):
// una retícula de calles tenue, la RUTA se dibuja sola (strokeDashoffset) con la
// silueta de una «N» de calles, y el punto azul del usuario la recorre; al llegar,
// el punto vuela a convertirse en el «.» de Nómada.AI y el wordmark aparece.
// Solo en arranque (se monta una vez en el layout raíz), nunca durante un viaje.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

// `collapsable` evita que Android optimice la vista y rompa measureInWindow;
// en web no existe como atributo DOM y React se queja — solo se pasa en nativo.
const NO_COLLAPSE = Platform.OS === 'web' ? {} : { collapsable: false as const };
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { BRAND_FONT } from '@/components/brand';
import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/lib/settings';

// Nota: NO usar Animated.createAnimatedComponent(Path) — inyecta `collapsable`
// y el Path de react-native-svg en web lo pasa al DOM (warning de React).
// El trazo se anima con un listener del progreso → estado.

// EL LOGO REAL de Nómada.AI («app/logo app.png», viewBox 243×243): una N de un
// solo trazo cuyo brazo derecho se enrosca en el pin de ubicación. La ruta que se
// dibuja ES el logo — no una forma inventada.
const PATH_D =
  'M 57 214 L 57 150 C 57 133 73 128 84 140 L 155 199 C 165 207 173 202 173 190 ' +
  'L 173 118 C 173 85 158 40 124 40 C 88 40 74 68 74 96 C 74 122 96 132 114 130 ' +
  'C 132 128 146 116 152 104';
// Waypoints (aprox. lineal del trazo) para el recorrido del punto.
const PTS: [number, number][] = [
  [57, 214], [57, 150], [70, 133], [84, 140], [155, 199], [170, 203], [173, 190],
  [173, 118], [168, 62], [124, 40], [82, 62], [74, 96], [90, 125], [114, 130], [140, 120], [152, 104],
];
const SCALE = 0.95; // tamaño de render vs. viewBox 243
const SIZE = { w: 243 * SCALE, h: 243 * SCALE };

function segLen(a: [number, number], b: [number, number]) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
const TOTAL = PTS.slice(1).reduce((s, p, i) => s + segLen(PTS[i], p), 0);
// El path real (con curvas) es más largo que la poligonal: margen para que cierre.
const DASH = TOTAL * 1.35;
// Fracciones acumuladas → inputRange del interpolado del punto.
const FRACS = PTS.map((_, i) =>
  PTS.slice(1, i + 1).reduce((s, p, j) => s + segLen(PTS[j], p), 0) / TOTAL);

export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const scheme = useResolvedScheme();
  const c = Colors[scheme];
  const progress = useRef(new Animated.Value(0)).current;  // ruta + punto
  const wordmark = useRef(new Animated.Value(0)).current;  // opacidad del nombre
  const flight = useRef(new Animated.Value(0)).current;    // punto → «.» del nombre
  const fade = useRef(new Animated.Value(1)).current;      // salida del splash
  const [slot, setSlot] = useState<{ x: number; y: number } | null>(null);
  const [dashOffset, setDashOffset] = useState(DASH);
  const grid = useRef(new Animated.Value(1)).current; // la retícula se va al final
  const [gridOp, setGridOp] = useState(1);
  const slotRef = useRef<View>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const sub = progress.addListener(({ value }) => setDashOffset(DASH * (1 - value)));
    const gsub = grid.addListener(({ value }) => setGridOp(value));
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(flight, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(wordmark, { toValue: 1, duration: 500, useNativeDriver: false }),
        // El fondo de calles desaparece: queda SOLO el logo con las letras.
        Animated.timing(grid, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]),
      Animated.delay(500),
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: false }),
    ]).start(() => { grid.removeListener(gsub); doneRef.current(); });
    // Posición del hueco del «.» (destino del vuelo del punto).
    const t = setTimeout(() => {
      slotRef.current?.measureInWindow((x, y) => setSlot({ x, y }));
    }, 900);
    return () => { clearTimeout(t); progress.removeListener(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Punto viajero: posición a lo largo de la ruta (interpolación por tramos).
  const routeX = progress.interpolate({ inputRange: FRACS, outputRange: PTS.map((p) => p[0] * SCALE) });
  const routeY = progress.interpolate({ inputRange: FRACS, outputRange: PTS.map((p) => p[1] * SCALE) });

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: c.background, opacity: fade, pointerEvents: 'none' }]}>
      <View style={{ width: SIZE.w, height: SIZE.h }}>
        <Svg width={SIZE.w} height={SIZE.h} viewBox="0 0 243 243">
          <Defs>
            {/* Oscuro: degradado claro intenso; claro: el logo luce oscuro/negro. */}
            <LinearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={scheme === 'dark' ? '#e8edf3' : '#17212c'} />
              <Stop offset="1" stopColor={scheme === 'dark' ? '#7fb2ff' : '#0b1220'} />
            </LinearGradient>
          </Defs>
          {/* retícula tenue: la ciudad de fondo (desaparece al final) */}
          {[45, 95, 145, 195].map((y) => (
            <Line key={`h${y}`} x1="14" y1={y} x2="229" y2={y} stroke={c.border} strokeWidth="1" opacity={0.5 * gridOp} />
          ))}
          {[45, 105, 165, 220].map((x) => (
            <Line key={`v${x}`} x1={x} y1="20" x2={x} y2="225" stroke={c.border} strokeWidth="1" opacity={0.5 * gridOp} />
          ))}
          {/* la ruta que se dibuja ES el logo de Nómada.AI */}
          <Path
            d={PATH_D}
            stroke="url(#logoGrad)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${DASH}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
        {/* punto azul del usuario recorriendo la ruta; al final vuela al «.» */}
        <TravelDot routeX={routeX} routeY={routeY} flight={flight} slot={slot} size={SIZE} accent={c.accent} />
      </View>

      {/* Wordmark: el «.» es el hueco donde aterriza el punto */}
      <Animated.View style={[styles.wordRow, { opacity: wordmark }]}>
        <Text style={[styles.word, { color: c.text }]}>Nómada</Text>
        <View ref={slotRef} {...NO_COLLAPSE} style={styles.dotSlot}>
          <Animated.View style={[styles.slotDot, { backgroundColor: c.accent, opacity: flight }]} />
        </View>
        <Text style={[styles.word, { color: c.accent }]}>AI</Text>
      </Animated.View>
    </Animated.View>
  );
}

// El punto: sigue la ruta con progress; con `slot` medido, el vuelo final lo lleva
// (en coordenadas de ventana) hasta el lugar exacto del «.» del wordmark.
function TravelDot({ routeX, routeY, flight, slot, size, accent }: {
  routeX: Animated.AnimatedInterpolation<number>;
  routeY: Animated.AnimatedInterpolation<number>;
  flight: Animated.Value;
  slot: { x: number; y: number } | null;
  size: { w: number; h: number };
  accent: string;
}) {
  const selfRef = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    selfRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  }, []);
  // Desplazamiento extra del vuelo: del final de la ruta al hueco del «.».
  const end = PTS[PTS.length - 1];
  const dx = slot && origin ? slot.x - (origin.x + end[0] * SCALE) + 2 : 0;
  const dy = slot && origin ? slot.y - (origin.y + end[1] * SCALE) + 5 : 26;
  const fx = flight.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const fy = flight.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const scale = flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const op = flight.interpolate({ inputRange: [0, 0.92, 1], outputRange: [1, 1, 0] });
  return (
    <View ref={selfRef} {...NO_COLLAPSE} style={[StyleSheet.absoluteFill, { width: size.w, height: size.h, pointerEvents: 'none' }]}>
      <Animated.View
        style={[styles.dot, {
          backgroundColor: accent, opacity: op,
          transform: [
            { translateX: Animated.add(routeX, fx) as unknown as number },
            { translateY: Animated.add(routeY, fy) as unknown as number },
            { scale: scale as unknown as number },
          ],
        }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 9999,
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  dot: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8, top: -8, left: -8,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  wordRow: { flexDirection: 'row', alignItems: 'baseline' },
  word: { fontFamily: BRAND_FONT, fontSize: 32, letterSpacing: 0.3 },
  dotSlot: { width: 12, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
  slotDot: { width: 7, height: 7, borderRadius: 4 },
});
