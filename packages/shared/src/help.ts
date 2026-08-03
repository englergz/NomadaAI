// FUENTE ÚNICA del contenido de ayuda («¿Cómo funciona?»).
// Cada sección declara en qué superficies aplica: el escritorio es un simulador y
// tiene apartados propios; el móvil es uso real y tiene los suyos. Lo conceptual
// (qué significan los colores, la protección, las alertas) se escribe UNA vez.
//
// Regla: si añades ayuda, va aquí. No se copia texto en las apps.

export type HelpSurface = 'web' | 'mobile';

export interface HelpItem {
  /** Texto en negrita al inicio (opcional): «Mapa de colores:». */
  term?: string;
  body: string;
}

export interface HelpSection {
  title: string;
  surfaces: HelpSurface[];
  items: HelpItem[];
}

export const HELP_LEAD =
  'Nómada.AI predice a dónde vas mientras te mueves y te avisa de las zonas de riesgo antes de llegar, proponiendo la ruta que menos te expone.';

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'El mapa de riesgo',
    surfaces: ['web', 'mobile'],
    items: [
      { term: 'Colores', body: 'El riesgo por zona y hora. Verde = bajo, amarillo/naranja = medio, rojo = alto. Cambia según la hora: no es lo mismo ir a las 06:00 que a las 20:00.' },
      { term: 'Es orientativo', body: 'Es un índice de referencia relativo construido con datos: orienta tu decisión, no garantiza seguridad.' },
    ],
  },
  {
    title: 'Tu protección',
    surfaces: ['web', 'mobile'],
    items: [
      { term: 'La barra', body: 'De mínima a máxima. En mínima buscamos la ruta más corta; en máxima rodeamos el riesgo aunque el camino sea más largo.' },
      { term: 'Umbral de alerta', body: 'A partir de qué nivel de riesgo quieres que te avisemos.' },
      { term: 'Evitar o avisar', body: 'Si hay una alternativa más segura, te la proponemos. Si el tramo de riesgo es inevitable, no lo escondemos: te avisamos para que extremes cuidado.' },
    ],
  },
  {
    title: 'Durante el recorrido',
    surfaces: ['mobile'],
    items: [
      { term: 'Recorrido libre', body: 'Puedes andar sin decir a dónde vas: te avisamos igual. Y si eliges destino a mitad de camino, trazamos la ruta segura desde donde estés.' },
      { term: 'Si te desvías', body: 'Recalculamos la ruta segura automáticamente.' },
      { term: 'Con la pantalla apagada', body: 'La protección sigue activa aunque bloquees el teléfono o cambies de app, con una notificación permanente para que sepas que está funcionando.' },
      { term: 'Protección automática', body: 'Si la activas en Ajustes, el recorrido empieza solo cuando detectamos que arrancaste.' },
    ],
  },
  {
    title: 'Tu privacidad',
    surfaces: ['web', 'mobile'],
    items: [
      { term: 'Sin cuenta también funciona', body: 'Iniciar sesión solo sirve para conservar tu histórico entre dispositivos.' },
      { term: 'Tus ubicaciones', body: 'El recorrido se guarda en tu teléfono mientras dura el viaje y se borra al terminarlo. No publicamos ubicaciones de nadie.' },
      { term: 'Reportes anónimos', body: 'Los reportes ciudadanos alimentan el modelo de forma agregada; nunca se publican individualmente.' },
    ],
  },
  {
    title: 'Aportar a la comunidad',
    surfaces: ['web', 'mobile'],
    items: [
      { term: 'Reportar incidentes', body: 'Cada reporte mejora el mapa para todos los que pasen por ahí después. Toma diez segundos y es anónimo.' },
      { term: 'La app es gratuita', body: 'Y la intención es que siga siéndolo. Si quieres apoyar el proyecto habrá un canal de donaciones voluntarias; donar no habilita funciones.' },
    ],
  },
  {
    title: 'Este espacio de demostración',
    surfaces: ['web'],
    items: [
      { term: 'Viaje no visto', body: 'Reproduce un viaje real que el modelo nunca vio: sirve para comprobar si de verdad acierta.' },
      { term: 'Ruta nueva', body: 'Marca en el mapa dónde estás y a dónde vas, y el sistema arma la ruta y la simula.' },
      { term: 'Velocidad del reloj', body: 'Qué tan rápido corre la simulación (×1 = tiempo real).' },
      { term: 'Medir efectividad', body: 'Cuánto acierta la predicción frente a «seguir en línea recta», y con cuántos metros de anticipación llega la alerta.' },
    ],
  },
];

/** Secciones que aplican a una superficie concreta. */
export function helpFor(surface: HelpSurface): HelpSection[] {
  return HELP_SECTIONS.filter((s) => s.surfaces.includes(surface));
}
