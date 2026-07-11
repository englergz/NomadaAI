// U2 · Idioma: diccionario es/en + detección del idioma del dispositivo
// (expo-localization) con selector manual en Ajustes ('system' | 'es' | 'en').
// t() interpola {var}. Español es la fuente de verdad; en es traducción.
import { getLocales } from 'expo-localization';

import { useSettings } from '@/lib/settings';

export type Lang = 'es' | 'en';

const es = {
  // Home
  'home.tagline': 'Navegación consciente del riesgo',
  'home.online': '· servicio en línea',
  'home.offline': 'Sin conexión con el servicio',
  'home.connecting': 'Conectando…',
  'home.cta': 'Ir seguro',
  'home.hint': 'Elige a dónde vas o inicia un recorrido libre: te avisamos antes del riesgo.',

  // Mapa: banners y flujo
  'map.searchPlaceholder': '¿A dónde vas?',
  'map.noResults': 'Sin resultados cerca. Prueba con otro nombre o una dirección.',
  'map.vehicle': 'Vehículo',
  'map.priority': 'Protección',
  'map.prio.min': 'Mínima',
  'map.prio.balanced': 'Equilibrada',
  'map.prio.max': 'Máxima',
  'map.cta.go': 'Ir seguro',
  'map.cta.startTrip': 'Iniciar recorrido',
  'map.cta.freeTrip': 'Recorrido libre',
  'map.cta.endTrip': 'Finalizar',
  'map.level.clear': 'Despejado',
  'map.level.caution': 'Precaución',
  'map.level.attention': 'Atención',
  'map.banner.noPermission': 'Sin permiso de ubicación. Actívalo en Ajustes.',
  'map.banner.noLocation': 'No se pudo obtener tu ubicación.',
  'map.banner.noCoverage': 'Aún no hay cobertura en tu zona. Te mostramos {city} como demostración.',
  'map.banner.riskLoadError': 'No se pudo cargar la capa de riesgo. Revisa tu conexión.',
  'map.banner.routing': 'Generando ruta segura…',
  'map.banner.routeOk': 'Ruta con protección {prio}: {km} km · −{red}% de exposición vs. la directa.',
  'map.banner.routeNoAlt': 'Sin alternativa más segura para este viaje ({km} km · −{red}%): el tramo de riesgo es inevitable, mantente atento.',
  'map.banner.routeError': 'No se pudo trazar la ruta (¿destino fuera de la red vial?).',
  'map.banner.tripNeedsLocation': 'El recorrido necesita tu ubicación. Actívala en Ajustes.',
  'map.banner.locating': 'Obteniendo tu ubicación…',
  'map.banner.tripAutoEnd': 'Recorrido finalizado por inactividad.',
  'map.idle.title': '¿Sigues en viaje?',
  'map.idle.body': 'Llevas un rato sin moverte. Si ya llegaste, podemos finalizar tu recorrido.',
  'map.idle.continue': 'Sigo en viaje',
  'map.idle.end': 'Finalizar',
  'map.banner.tripStarted': 'Recorrido iniciado. Te avisaremos solo cuando haga falta.',
  'map.banner.autoTrip': 'Detectamos que vas en camino: protección activada automáticamente.',
  'map.pre.title.caution': 'Precaución',
  'map.pre.title.attention': 'Atención',
  'map.pre.body': 'Tu camino pasa por un tramo de riesgo{eta}. Puedes ajustar la ruta o extremar cuidado.',
  'map.pre.etaMin': ' en ~{min} min',
  'map.pre.etaAhead': ' más adelante',
  'map.pre.notifTitle': '{title}: riesgo{eta}',
  'map.disclaimer': 'Índice de referencia relativo: orienta tu decisión, no garantiza seguridad.',
  'map.webHint': 'En el navegador la ubicación usa el diálogo del propio navegador.',

  // Alertas por acción (proximidad)
  'alert.caution.title': 'Precaución en este tramo',
  'alert.caution.body': 'Mantén el ritmo y evita detenerte; lleva el teléfono en soporte o guía por voz, no en la mano.',
  'alert.attention.title': 'Atención en este tramo',
  // El consejo se adapta al vehículo EFECTIVO del viaje (el elegido en el viaje o el predeterminado).
  'alert.attention.body': 'Sigue la ruta sin paradas, no exhibas el teléfono y comparte tu recorrido con alguien.',
  'alert.attention.body.car': 'Sigue la ruta sin paradas, ventanas arriba y puertas aseguradas; comparte tu recorrido con alguien.',
  'alert.attention.body.moto': 'Sigue la ruta sin paradas, casco puesto y sin exhibir el teléfono; comparte tu recorrido con alguien.',

  // Ajustes
  'settings.title': 'Ajustes',
  'settings.vehicle': 'TU VEHÍCULO',
  'settings.vehicle.moto': 'Moto',
  'settings.vehicle.car': 'Carro',
  'settings.vehicle.bus': 'Bus',
  'settings.vehicle.truck': 'Camión',
  'settings.vehicle.help': 'Opcional: indicar tu vehículo mejora la precisión (calles según el tipo). Se puede cambiar en cada viaje.',
  'settings.trip': 'RECORRIDO Y ALERTAS',
  'settings.autoTrip': 'Protección automática',
  'settings.autoTrip.help': 'Se activa sola cuando empiezas a moverte. Requiere permiso de ubicación «siempre»; solo la usamos para cuidarte en el camino.',
  'settings.threshold': 'Umbral de alerta',
  'settings.theme': 'TEMA',
  'settings.theme.system': 'Sistema',
  'settings.theme.light': 'Claro',
  'settings.theme.dark': 'Oscuro',
  'settings.lang': 'IDIOMA',
  'settings.lang.system': 'Sistema',
  'settings.lang.unavailable': 'El idioma de tu dispositivo aún no está disponible; mientras tanto usamos español.',
  'settings.layers': 'MAPA Y CAPAS',
  'settings.satellite': 'Satelital',
  'settings.pois': 'Lugares',
  'settings.risk': 'RIESGO',
  'settings.riskLayer': 'Capa de riesgo',
  'settings.palette.calor': 'Calor',
  'settings.palette.semaforo': 'Semáforo',
  'settings.palette.frio': 'Frío',
  'settings.intensity': 'Intensidad',
  'settings.opacity': 'Opacidad de la capa',
  'settings.done': 'Listo',

  // Reporte ciudadano
  'report.title': 'Reportar incidente',
  'report.intro': 'Se envía de forma anónima con tu ubicación actual y la hora. Los reportes se agregan al modelo; nunca se publican individualmente.',
  'report.cat.robo': 'Robo',
  'report.cat.riña': 'Riña',
  'report.cat.iluminación dañada': 'Iluminación dañada',
  'report.cat.presencia sospechosa': 'Presencia sospechosa',
  'report.placeholder': 'Descripción (opcional, máx. 500)',
  'report.cooldown': 'Acabas de enviar un reporte. Espera unos minutos.',
  'report.ok': 'Reporte recibido. Gracias: tu aporte mejora el mapa de todos.',
  'report.rejected': 'El reporte no fue aceptado.',
  'report.offline': 'Sin conexión con el servicio. Intenta de nuevo.',
  'report.send': 'Enviar reporte',

  // Tu protección
  'prot.title': 'Tu protección',
  'prot.subtitle': 'Lo que Nómada.AI hizo por ti · con o sin registro, tú decides',
  'prot.hero': 'de exposición al riesgo evitada eligiendo la ruta segura',
  'prot.heroAvg': ' · promedio de {n} rutas',
  'prot.trips': 'viajes',
  'prot.alerts': 'alertas a tiempo',
  'prot.avoided': 'riesgo evitado',
  'prot.range': 'Desde {since} · última {updated}',
  'prot.empty': 'Aún no tienes viajes registrados. Genera una ruta segura o inicia un recorrido libre para ver cuánto riesgo evitas.',
  'prot.alertLog': 'HISTORIAL DE ALERTAS',
  'prot.alertLog.empty': 'Sin alertas registradas. Cuando un recorrido pase cerca de una zona de riesgo, quedará aquí con la hora y la recomendación.',
  'prot.alertLog.zone': 'zona',
  'prot.alertLog.pre': ' (anticipada)',
  'prot.filter.all': 'Todas',
  'prot.filter.prox': 'En zona',
  'prot.filter.pre': 'Anticipadas',
  'prot.clearAlerts': 'Limpiar',
  'prot.confirmClear': '¿Borrar todas las alertas guardadas? Esta acción no se puede deshacer.',
  'prot.community': 'En toda la comunidad: {trips} viajes de {users} persona{s} · {alerts} alertas',
  'prot.reset': 'Reiniciar historial',
  'prot.confirmReset': '¿Reiniciar tu historial de viajes? Esta acción no se puede deshacer.',
  'prot.done': 'Listo',
  'common.cancel': 'Cancelar',
  'common.confirm': 'Confirmar',

  // Recorrido de bienvenida (primera vez)
  'wel.skip': 'Omitir',
  'wel.next': 'Siguiente',
  'wel.start': 'Comenzar',
  'wel.1.title': 'Te cuidamos en el camino',
  'wel.1.body': 'Nómada.AI es navegación consciente del riesgo: no solo te lleva, te protege mientras te mueves por la ciudad.',
  'wel.2.title': 'Mapa de riesgo vivo',
  'wel.2.body': 'La ciudad dividida en zonas con su nivel de riesgo según la hora. Tú eliges qué capas ver y cómo se pintan.',
  'wel.3.title': 'Rutas con protección',
  'wel.3.body': 'Compara la ruta directa con la protegida y decide cuánto desvío aceptas: protección mínima, equilibrada o máxima.',
  'wel.4.title': 'Alertas a tiempo',
  'wel.4.body': 'En recorrido libre, la app predice tu camino y te avisa antes de un tramo de riesgo. Y lo que veas, lo puedes reportar.',

  // Sesión y perfil (U4 · Clerk)
  'auth.google': 'Continuar con Google',
  'auth.guest': 'Continuar como invitado',
  'auth.signin': 'Iniciar sesión con Google',
  'auth.signout': 'Cerrar sesión',
  'auth.error': 'No se pudo iniciar sesión. Intenta de nuevo.',
  'auth.profile': 'PERFIL',
  'auth.guestNote': 'Estás como invitado: tu histórico vive solo en este dispositivo. Con sesión, te sigue a donde vayas.',
  'auth.dob': 'Fecha de nacimiento',
  'auth.day': 'Día',
  'auth.month': 'Mes',
  'auth.year': 'Año',
  'auth.nationality': 'Nacionalidad',
  'auth.searchCountry': 'Buscar país…',
  'auth.save': 'Guardar perfil',
  'auth.saved': 'Perfil guardado.',
  'auth.saveError': 'No se pudo guardar. Intenta de nuevo.',
  'auth.consent': 'Opcional. Al guardarlos das tu consentimiento (Ley 1581 de 2012, Colombia) para usarlos SOLO en estadísticas agregadas de seguridad; puedes borrarlos cuando quieras.',

  // Ciudad (U3, estilo inDrive)
  'city.title': 'Ciudad',
  'city.subtitle': 'Ciudades con mapa de riesgo disponible',
  'city.areYouIn': '¿Estás en {city}? Podemos cambiar el mapa.',
  'city.switch': 'Sí, cambiar',
  'city.stay': 'No, seguir aquí',
  'city.riskOnly': 'En {city} hoy verás el mapa de riesgo. La predicción y las rutas seguras llegan cuando el pipeline de esta ciudad esté listo.',
  'city.full': 'Riesgo, predicción y rutas',
  'city.partial': 'Solo mapa de riesgo',

  // Lugares (POIs): categorías visibles al tocar un icono
  'poi.cat.seguridad': 'Seguridad',
  'poi.cat.salud': 'Salud',
  'poi.cat.educación': 'Educación',
  'poi.cat.combustible': 'Combustible',
  'poi.cat.banco': 'Banco',
  'poi.cat.transporte': 'Transporte',
  'poi.cat.comercio': 'Comercio',
  'poi.cat.culto': 'Culto',
  'poi.cat.default': 'Lugar',
} as const;

export type TKey = keyof typeof es;

const en: Record<TKey, string> = {
  'home.tagline': 'Risk-aware navigation',
  'home.online': '· service online',
  'home.offline': 'No connection to the service',
  'home.connecting': 'Connecting…',
  'home.cta': 'Go safely',
  'home.hint': 'Pick a destination or start a free ride: we warn you before the risk.',

  'map.searchPlaceholder': 'Where are you going?',
  'map.noResults': 'No nearby results. Try another name or an address.',
  'map.vehicle': 'Vehicle',
  'map.priority': 'Protection',
  'map.prio.min': 'Minimal',
  'map.prio.balanced': 'Balanced',
  'map.prio.max': 'Maximum',
  'map.cta.go': 'Go safely',
  'map.cta.startTrip': 'Start trip',
  'map.cta.freeTrip': 'Free ride',
  'map.cta.endTrip': 'End trip',
  'map.level.clear': 'Clear',
  'map.level.caution': 'Caution',
  'map.level.attention': 'Attention',
  'map.banner.noPermission': 'No location permission. Enable it in Settings.',
  'map.banner.noLocation': 'Could not get your location.',
  'map.banner.noCoverage': 'No coverage in your area yet. Showing {city} as a demo.',
  'map.banner.riskLoadError': 'Could not load the risk layer. Check your connection.',
  'map.banner.routing': 'Building safe route…',
  'map.banner.routeOk': 'Route with {prio} protection: {km} km · −{red}% exposure vs. the direct one.',
  'map.banner.routeNoAlt': 'No safer alternative for this trip ({km} km · −{red}%): the risky stretch is unavoidable, stay alert.',
  'map.banner.routeError': 'Could not build the route (destination off the road network?).',
  'map.banner.tripNeedsLocation': 'The trip needs your location. Enable it in Settings.',
  'map.banner.locating': 'Getting your location…',
  'map.banner.tripAutoEnd': 'Trip ended due to inactivity.',
  'map.idle.title': 'Still on your way?',
  'map.idle.body': 'You have not moved in a while. If you already arrived, we can end your trip.',
  'map.idle.continue': 'Still traveling',
  'map.idle.end': 'End trip',
  'map.banner.tripStarted': 'Trip started. We will only warn you when needed.',
  'map.banner.autoTrip': 'We detected you are on the move: protection enabled automatically.',
  'map.pre.title.caution': 'Caution',
  'map.pre.title.attention': 'Attention',
  'map.pre.body': 'Your path crosses a risky stretch{eta}. You can adjust the route or take extra care.',
  'map.pre.etaMin': ' in ~{min} min',
  'map.pre.etaAhead': ' ahead',
  'map.pre.notifTitle': '{title}: risk{eta}',
  'map.disclaimer': 'Relative reference index: it guides your decision, it does not guarantee safety.',
  'map.webHint': 'In the browser, location uses the browser’s own dialog.',

  'alert.caution.title': 'Caution on this stretch',
  'alert.caution.body': 'Keep moving and avoid stopping; use a phone mount or voice guidance, not your hand.',
  'alert.attention.title': 'Attention on this stretch',
  'alert.attention.body': 'Follow the route without stops, keep your phone out of sight, and share your trip with someone.',
  'alert.attention.body.car': 'Follow the route without stops, windows up and doors locked; share your trip with someone.',
  'alert.attention.body.moto': 'Follow the route without stops, helmet on and phone out of sight; share your trip with someone.',

  'settings.title': 'Settings',
  'settings.vehicle': 'YOUR VEHICLE',
  'settings.vehicle.moto': 'Motorbike',
  'settings.vehicle.car': 'Car',
  'settings.vehicle.bus': 'Bus',
  'settings.vehicle.truck': 'Truck',
  'settings.vehicle.help': 'Optional: setting your vehicle improves accuracy (roads per type). You can change it on each trip.',
  'settings.trip': 'TRIP AND ALERTS',
  'settings.autoTrip': 'Automatic protection',
  'settings.autoTrip.help': 'Turns on by itself when you start moving. Needs “always” location permission; we only use it to keep you safe on the road.',
  'settings.threshold': 'Alert threshold',
  'settings.theme': 'THEME',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.lang': 'LANGUAGE',
  'settings.lang.system': 'System',
  'settings.lang.unavailable': 'Your device language is not available yet; using Spanish in the meantime.',
  'settings.layers': 'MAP AND LAYERS',
  'settings.satellite': 'Satellite',
  'settings.pois': 'Places',
  'settings.risk': 'RISK',
  'settings.riskLayer': 'Risk layer',
  'settings.palette.calor': 'Heat',
  'settings.palette.semaforo': 'Traffic light',
  'settings.palette.frio': 'Cold',
  'settings.intensity': 'Intensity',
  'settings.opacity': 'Layer opacity',
  'settings.done': 'Done',

  'report.title': 'Report an incident',
  'report.intro': 'Sent anonymously with your current location and the time. Reports feed the model; they are never published individually.',
  'report.cat.robo': 'Robbery',
  'report.cat.riña': 'Fight',
  'report.cat.iluminación dañada': 'Broken lighting',
  'report.cat.presencia sospechosa': 'Suspicious presence',
  'report.placeholder': 'Description (optional, max. 500)',
  'report.cooldown': 'You just sent a report. Wait a few minutes.',
  'report.ok': 'Report received. Thanks: your input improves everyone’s map.',
  'report.rejected': 'The report was not accepted.',
  'report.offline': 'No connection to the service. Try again.',
  'report.send': 'Send report',

  'prot.title': 'Your protection',
  'prot.subtitle': 'What Nómada.AI did for you · with or without an account, your call',
  'prot.hero': 'of risk exposure avoided by choosing the safe route',
  'prot.heroAvg': ' · average of {n} routes',
  'prot.trips': 'trips',
  'prot.alerts': 'timely alerts',
  'prot.avoided': 'risk avoided',
  'prot.range': 'Since {since} · last {updated}',
  'prot.empty': 'No trips recorded yet. Build a safe route or start a free ride to see how much risk you avoid.',
  'prot.alertLog': 'ALERT HISTORY',
  'prot.alertLog.empty': 'No alerts recorded. When a trip passes near a risk zone, it will appear here with the time and the recommendation.',
  'prot.alertLog.zone': 'zone',
  'prot.alertLog.pre': ' (predicted)',
  'prot.filter.all': 'All',
  'prot.filter.prox': 'In zone',
  'prot.filter.pre': 'Predicted',
  'prot.clearAlerts': 'Clear',
  'prot.confirmClear': 'Delete all saved alerts? This cannot be undone.',
  'prot.community': 'Across the community: {trips} trips by {users} user{s} · {alerts} alerts',
  'prot.reset': 'Reset history',
  'prot.confirmReset': 'Reset your trip history? This cannot be undone.',
  'prot.done': 'Done',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',

  'wel.skip': 'Skip',
  'wel.next': 'Next',
  'wel.start': 'Get started',
  'wel.1.title': 'We look after your journey',
  'wel.1.body': 'Nómada.AI is risk-aware navigation: it doesn’t just take you there, it protects you as you move around the city.',
  'wel.2.title': 'A living risk map',
  'wel.2.body': 'The city split into zones with their risk level by hour. You choose which layers to see and how they look.',
  'wel.3.title': 'Routes with protection',
  'wel.3.body': 'Compare the direct route with the protected one and decide how much detour you accept: minimal, balanced or maximum protection.',
  'wel.4.title': 'Timely alerts',
  'wel.4.body': 'On a free ride, the app predicts your path and warns you before a risky stretch. And what you see, you can report.',

  'auth.google': 'Continue with Google',
  'auth.guest': 'Continue as guest',
  'auth.signin': 'Sign in with Google',
  'auth.signout': 'Sign out',
  'auth.error': 'Could not sign in. Try again.',
  'auth.profile': 'PROFILE',
  'auth.guestNote': 'You are a guest: your history lives only on this device. With an account, it follows you anywhere.',
  'auth.dob': 'Date of birth',
  'auth.day': 'Day',
  'auth.month': 'Month',
  'auth.year': 'Year',
  'auth.nationality': 'Nationality',
  'auth.searchCountry': 'Search country…',
  'auth.save': 'Save profile',
  'auth.saved': 'Profile saved.',
  'auth.saveError': 'Could not save. Try again.',
  'auth.consent': 'Optional. By saving you consent (Colombian Law 1581 of 2012) to their use ONLY in aggregated safety statistics; you can delete them anytime.',

  'city.title': 'City',
  'city.subtitle': 'Cities with a risk map available',
  'city.areYouIn': 'Are you in {city}? We can switch the map.',
  'city.switch': 'Yes, switch',
  'city.stay': 'No, stay here',
  'city.riskOnly': 'In {city} you currently get the risk map. Prediction and safe routes arrive once this city’s pipeline is ready.',
  'city.full': 'Risk, prediction and routes',
  'city.partial': 'Risk map only',

  'poi.cat.seguridad': 'Security',
  'poi.cat.salud': 'Health',
  'poi.cat.educación': 'Education',
  'poi.cat.combustible': 'Fuel',
  'poi.cat.banco': 'Bank',
  'poi.cat.transporte': 'Transport',
  'poi.cat.comercio': 'Shops',
  'poi.cat.culto': 'Worship',
  'poi.cat.default': 'Place',
};

const DICTS: Record<Lang, Record<TKey, string>> = { es, en };

// Idioma del dispositivo si está soportado; null si aún no lo cubrimos.
export function deviceLang(): Lang | null {
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'en' || code === 'es' ? code : null;
  } catch { return null; }
}

// Con ajuste «Sistema» y un idioma de dispositivo NO soportado, la UI cae a español
// y Ajustes muestra el aviso «aún no disponible» (no fingimos soportarlo).
export function systemLangUnsupported(): boolean {
  return deviceLang() === null;
}

// Idioma resuelto: el ajuste manual manda; 'system' sigue al dispositivo (es si no está soportado).
export function useLang(): Lang {
  const { settings } = useSettings();
  return settings.lang === 'system' ? (deviceLang() ?? 'es') : settings.lang;
}

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string;

export function useT(): Translate {
  const lang = useLang();
  return (key, vars) => {
    let s: string = DICTS[lang][key] ?? es[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

// Locale para fechas (Intl/toLocaleString).
export function useDateLocale(): string {
  return useLang() === 'en' ? 'en-US' : 'es-CO';
}
