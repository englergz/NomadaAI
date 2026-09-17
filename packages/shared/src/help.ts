// FUENTE ÚNICA del contenido de ayuda («¿Cómo funciona?»).
// Cada sección declara en qué superficies aplica: el escritorio es un simulador y
// tiene apartados propios; el móvil es uso real y tiene los suyos. Lo conceptual
// (qué significan los colores, la protección, las alertas) se escribe UNA vez.
//
// Está en los dos idiomas de la app: antes solo existía en español y, con la app en
// inglés, la ayuda seguía saliendo en español (verificado en el emulador).
//
// Regla: si añades ayuda, va aquí y en los dos idiomas. No se copia texto en las apps.

export type HelpSurface = 'web' | 'mobile';
export type HelpLang = 'es' | 'en';

interface Texto { es: string; en: string }

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

interface ItemFuente { term?: Texto; body: Texto }
interface SeccionFuente { title: Texto; surfaces: HelpSurface[]; items: ItemFuente[] }

const LEAD: Texto = {
  es: 'Nómada.AI predice a dónde vas mientras te mueves y te avisa de las zonas de riesgo antes de llegar, proponiendo la ruta que menos te expone.',
  en: 'Nómada.AI predicts where you are heading as you move and warns you about risk zones before you get there, suggesting the route that exposes you the least.',
};

const SECCIONES: SeccionFuente[] = [
  {
    title: { es: 'El mapa de riesgo', en: 'The risk map' },
    surfaces: ['web', 'mobile'],
    items: [
      { term: { es: 'Colores', en: 'Colors' },
        body: { es: 'El riesgo por zona y hora. Verde = bajo, amarillo/naranja = medio, rojo = alto. Cambia según la hora: no es lo mismo ir a las 06:00 que a las 20:00.',
                en: 'Risk by zone and time. Green = low, yellow/orange = medium, red = high. It changes with the time of day: 06:00 is not the same as 20:00.' } },
      { term: { es: 'Es orientativo', en: 'It is a guide' },
        body: { es: 'Es un índice de referencia relativo construido con datos: orienta tu decisión, no garantiza seguridad.',
                en: 'It is a relative reference index built from data: it guides your decision, it does not guarantee safety.' } },
    ],
  },
  {
    title: { es: 'Tu protección', en: 'Your protection' },
    surfaces: ['web', 'mobile'],
    items: [
      { term: { es: 'La barra', en: 'The bar' },
        body: { es: 'De mínima a máxima. En mínima buscamos la ruta más corta; en máxima rodeamos el riesgo aunque el camino sea más largo.',
                en: 'From minimal to maximum. At minimal we look for the shortest route; at maximum we go around risk even if the way is longer.' } },
      { term: { es: 'Umbral de alerta', en: 'Alert threshold' },
        body: { es: 'A partir de qué nivel de riesgo quieres que te avisemos.',
                en: 'The risk level from which you want to be warned.' } },
      { term: { es: 'Evitar o avisar', en: 'Avoid or warn' },
        body: { es: 'Si hay una alternativa más segura, te la proponemos. Si el tramo de riesgo es inevitable, no lo escondemos: te avisamos para que extremes cuidado.',
                en: 'If there is a safer alternative, we suggest it. If a risky stretch cannot be avoided, we do not hide it: we warn you so you take extra care.' } },
    ],
  },
  {
    title: { es: 'Durante el recorrido', en: 'During your trip' },
    surfaces: ['mobile'],
    items: [
      { term: { es: 'Recorrido libre', en: 'Free ride' },
        body: { es: 'Puedes andar sin decir a dónde vas: te avisamos igual. Y si eliges destino a mitad de camino, trazamos la ruta segura desde donde estés. También funciona sin conexión, con el mapa de riesgo guardado.',
                en: 'You can move without saying where you are going: we still warn you. If you pick a destination halfway, we build the safe route from where you are. It also works offline, with the saved risk map.' } },
      { term: { es: 'Si te desvías', en: 'If you go off route' },
        body: { es: 'Recalculamos la ruta segura automáticamente.',
                en: 'We recalculate the safe route automatically.' } },
      { term: { es: 'Con la pantalla apagada', en: 'With the screen off' },
        body: { es: 'La protección sigue activa aunque bloquees el teléfono o cambies de app, con una notificación permanente para que sepas que está funcionando.',
                en: 'Protection stays on even if you lock your phone or switch apps, with a persistent notification so you know it is working.' } },
      { term: { es: 'Protección automática', en: 'Automatic protection' },
        body: { es: 'Si la activas en Ajustes, el recorrido empieza solo cuando detectamos que arrancaste.',
                en: 'If you turn it on in Settings, the trip starts by itself when we detect you have set off.' } },
    ],
  },
  {
    title: { es: 'Tu privacidad', en: 'Your privacy' },
    surfaces: ['web', 'mobile'],
    items: [
      { term: { es: 'Sin cuenta también funciona', en: 'It works without an account' },
        body: { es: 'Iniciar sesión sirve para conservar tu histórico entre dispositivos y para usar Círculos.',
                en: 'Signing in keeps your history across devices and lets you use Circles.' } },
      { term: { es: 'Tus ubicaciones', en: 'Your locations' },
        body: { es: 'El recorrido se guarda en tu teléfono mientras dura el viaje y se borra al terminarlo. Solo tus Círculos ven dónde estás, y solo mientras pides ayuda o salta uno de tus disparadores.',
                en: 'Your trip is kept on your phone while it lasts and deleted when it ends. Only your Circles see where you are, and only while you ask for help or one of your triggers fires.' } },
      { term: { es: 'Tus reportes', en: 'Your reports' },
        body: { es: 'Alimentan el mapa de forma agregada y nunca se publican uno a uno ni con tu nombre. Puedes borrarlos con «Borrar mis datos».',
                en: 'They feed the map in aggregate and are never published one by one or with your name. You can delete them with “Delete my data”.' } },
    ],
  },
  {
    title: { es: 'Aportar a la comunidad', en: 'Helping the community' },
    surfaces: ['web', 'mobile'],
    items: [
      { term: { es: 'Reportar incidentes', en: 'Report incidents' },
        body: { es: 'Cada reporte mejora el mapa para todos los que pasen por ahí después. Toma diez segundos.',
                en: 'Each report improves the map for everyone who passes by later. It takes ten seconds.' } },
      { term: { es: 'La app es gratuita', en: 'The app is free' },
        body: { es: 'Y la intención es que siga siéndolo. Si quieres apoyar el proyecto habrá un canal de donaciones voluntarias; donar no habilita funciones.',
                en: 'And the intention is to keep it that way. If you want to support the project there will be a voluntary donations channel; donating does not unlock features.' } },
    ],
  },
  {
    title: { es: 'Este espacio de demostración', en: 'This demo space' },
    surfaces: ['web'],
    items: [
      { term: { es: 'Viaje no visto', en: 'Unseen trip' },
        body: { es: 'Reproduce un viaje real que el modelo nunca vio: sirve para comprobar si de verdad acierta.',
                en: 'Replays a real trip the model never saw: it shows whether it really gets it right.' } },
      { term: { es: 'Ruta nueva', en: 'New route' },
        body: { es: 'Marca en el mapa dónde estás y a dónde vas, y el sistema arma la ruta y la simula.',
                en: 'Mark on the map where you are and where you are going, and the system builds and simulates the route.' } },
      { term: { es: 'Velocidad del reloj', en: 'Clock speed' },
        body: { es: 'Qué tan rápido corre la simulación (×1 = tiempo real).',
                en: 'How fast the simulation runs (×1 = real time).' } },
      { term: { es: 'Medir efectividad', en: 'Measure effectiveness' },
        body: { es: 'Cuánto acierta la predicción frente a «seguir en línea recta», y con cuántos metros de anticipación llega la alerta.',
                en: 'How often the prediction beats “keep going straight”, and how many meters ahead the alert arrives.' } },
    ],
  },
];

/** Frase de entrada de la ayuda, en el idioma pedido. */
export function helpLead(lang: HelpLang = 'es'): string {
  return LEAD[lang];
}

/** Compatibilidad: la entrada en español. */
export const HELP_LEAD = LEAD.es;

/** Secciones que aplican a una superficie concreta, en el idioma pedido. */
export function helpFor(surface: HelpSurface, lang: HelpLang = 'es'): HelpSection[] {
  return SECCIONES.filter((s) => s.surfaces.includes(surface)).map((s) => ({
    title: s.title[lang],
    surfaces: s.surfaces,
    items: s.items.map((it) => ({ term: it.term?.[lang], body: it.body[lang] })),
  }));
}
