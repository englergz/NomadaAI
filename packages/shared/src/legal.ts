// TÉRMINOS DE USO y POLÍTICA DE PRIVACIDAD — fuente única para app y escritorio.
//
// Al cambiar el texto hay que SUBIR `LEGAL_VERSION`: la app guarda qué versión
// aceptó cada usuario y volverá a pedir aceptación si no coincide. Cambiar el
// texto sin subir la versión deja a la gente aceptando algo que ya no dice lo
// mismo, que es justo lo que la ley pretende evitar.

/** Se incrementa SIEMPRE que cambie el contenido legal. */
export const LEGAL_VERSION = '1.1.0';
/** Fecha de vigencia que se muestra al usuario y queda registrada. */
export const LEGAL_EFFECTIVE_DATE = '2026-09-15';

export interface LegalBlock {
  title: string;
  body: string;
}

export interface LegalDoc {
  id: 'terms' | 'privacy';
  title: string;
  intro: string;
  blocks: LegalBlock[];
}

export const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Términos de uso',
  intro:
    'Al usar Nómada.AI aceptas estos términos. Están escritos para entenderse, no para esconder nada.',
  blocks: [
    {
      title: 'Qué es Nómada.AI',
      body:
        'Una aplicación de navegación consciente del riesgo: estima qué tan expuesta está cada zona a distintas horas y propone rutas que reducen esa exposición, avisándote antes de llegar.',
    },
    {
      title: 'Es orientativo, no una garantía',
      body:
        'El índice de riesgo es una referencia RELATIVA construida con datos y modelos que pueden equivocarse. No garantiza seguridad ni sustituye tu criterio ni a las autoridades. Nunca tomes una decisión que consideres peligrosa solo porque la app sugiera una ruta.',
    },
    {
      title: 'La app es gratuita',
      body:
        'Nómada.AI es gratuita y la intención es que siga siéndolo. En el futuro existirá un canal de donaciones voluntarias para sostener la operación y las mejoras. Donar NO habilita funciones ni da ventajas: quien no done tendrá exactamente la misma aplicación.',
    },
    {
      title: 'Uso responsable',
      body:
        'No manipules los reportes ciudadanos ni envíes información falsa: alimentan el mapa que usan los demás. Manipular el sistema puede llevar al bloqueo del acceso.',
    },
    {
      title: 'Conduce con atención',
      body:
        'No manipules el teléfono mientras conduces. Configura tu recorrido antes de arrancar y usa soporte o guía por voz. Tu atención en la vía está por encima de cualquier aviso de la app.',
    },
    {
      title: 'Disponibilidad',
      body:
        'El servicio puede interrumpirse por mantenimiento, fallos o falta de cobertura en tu zona. Cuando el servicio falle, la app te lo dirá con claridad y seguirá funcionando con los datos que ya tenga descargados.',
    },
  ],
};

export const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: 'Política de privacidad',
  intro:
    'Tu ubicación es el dato más sensible que existe. Esta política explica exactamente qué guardamos, dónde, quién interviene y cómo borrarlo. Tratamiento conforme a la Ley 1581 de 2012 (Colombia).',
  blocks: [
    {
      title: 'Responsable del tratamiento',
      body:
        'Nómada.AI — proyecto de investigación (MGTIC). Contacto para ejercer tus derechos: englergz@gmail.com.',
    },
    {
      title: 'Qué recogemos y para qué',
      body:
        'Tu ubicación mientras usas la app, con una única finalidad: mostrarte en el mapa, calcular rutas más seguras y avisarte antes de una zona de riesgo. Para calcular una ruta o predecir hacia dónde vas, la app envía al servidor el origen, el destino o el tramo reciente del recorrido: el servidor los procesa en el momento y no los guarda.',
    },
    {
      title: 'Qué guardamos en el servidor',
      body:
        'De cada viaje, un resumen: ciudad, hora, tipo de vehículo, cuántas alertas recibiste, qué tan acertada fue la predicción y cuánto redujo la ruta segura tu exposición, con la distancia de las dos rutas. Nunca el trazado del recorrido. De cada reporte que envíes: categoría, ubicación, hora y la descripción que escribas. De cada opinión: tus respuestas, el comentario si lo dejas, la ciudad y el sistema del teléfono.',
    },
    {
      title: 'A quién quedan asociados',
      body:
        'Si iniciaste sesión, a tu cuenta. Si no, a una llave aleatoria que se crea y se guarda en tu teléfono, o en tu navegador en la versión de escritorio. El servidor solo guarda una huella de esa llave, que no revela quién eres ni sirve para hacerse pasar por ti. Para usar la app sin cuenta no pedimos tu nombre ni tu correo.',
    },
    {
      title: 'Qué queda en tu teléfono',
      body:
        'El trayecto en curso se guarda EN TU TELÉFONO, cifrado, mientras dura el viaje y se BORRA al finalizarlo. Solo se retiene un tramo reciente, no el viaje completo. También quedan cifrados el registro de alertas y lo que no se pudo enviar por falta de señal, que se descarta a los 7 días. No publicamos ni compartimos la ubicación de nadie.',
    },
    {
      title: 'Funciona sin cuenta',
      body:
        'Puedes usar toda la aplicación sin registrarte. Si inicias sesión, tu nombre y tu correo los gestiona Clerk, el servicio de inicio de sesión, y tu histórico te acompaña entre dispositivos. La fecha de nacimiento y la nacionalidad del perfil son opcionales: si las completas, se guardan en tu cuenta y hoy no se usan en ningún análisis.',
    },
    {
      title: 'Ubicación en segundo plano',
      body:
        'Si lo autorizas, seguimos tu recorrido con la pantalla apagada para poder avisarte a tiempo. Mientras eso ocurre verás SIEMPRE una notificación permanente: nunca te seguimos sin que lo sepas. El seguimiento se apaga solo al terminar el viaje, tras 30 minutos sin movimiento o a las 4 horas.',
    },
    {
      title: 'Quién más interviene',
      body:
        'Usamos servicios de terceros con servidores fuera de Colombia: Hugging Face aloja el servidor, Neon guarda la base de datos, Clerk gestiona las cuentas y Expo entrega las actualizaciones de la app. Los mapas se descargan de OpenFreeMap y de Esri, y la búsqueda de direcciones usa Nominatim, de OpenStreetMap: esos servicios ven la zona del mapa o el texto que buscas y la dirección IP de tu conexión, no quién eres en la app. Nuestro servidor, como cualquier servicio web, ve la dirección IP de cada petición: la usa solo para frenar abusos y no la guarda en la base de datos, aunque el alojamiento la anota en sus registros técnicos.',
    },
    {
      title: 'Los reportes de la comunidad',
      body:
        'Los reportes se usan de forma agregada para mejorar el mapa de riesgo y nunca se publican individualmente. Para moderarlos, el administrador ve cada reporte con un seudónimo de quien lo envió, nunca su cuenta ni su identificador, y puede eliminar los que no cumplan las normas.',
    },
    {
      title: 'Qué NO hacemos',
      body:
        'No vendemos tus datos. No los cedemos a terceros con fines comerciales. No construimos un historial de dónde estuviste para usarlo con otro propósito. No usamos tu ubicación para publicidad.',
    },
    {
      title: 'Borrar tus datos',
      body:
        'En Configuración → Más opciones → «Mis datos y opinión» puedes borrarlo todo. En el teléfono se borra todo, salvo la constancia de que aceptaste esta política. En el servidor se borran tu histórico y tus reportes, y tus opiniones se conservan sin nada que las vincule contigo. Los reportes borrados dejan de contar en el mapa. Si el servidor no confirma el borrado, la app te lo dice y conserva lo necesario para que puedas reintentar. Si iniciaste sesión, puedes marcar también «eliminar mi cuenta»: se eliminan tu nombre, tu correo y los datos de tu perfil en Clerk, siempre después de que el servidor confirme el borrado de tus datos, para que no quede nada tuyo sin poder borrarse.',
    },
    {
      title: 'Tus derechos',
      body:
        'Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización, escribiendo a englergz@gmail.com. Si no puedes eliminar tu cuenta desde la app, también la eliminamos por ese medio. Atendemos la solicitud y confirmamos cuando esté hecha.',
    },
    {
      title: 'Cuánto tiempo y cambios',
      body:
        'Conservamos lo que se guarda en el servidor mientras el servicio esté activo o hasta que lo borres. Si esta política cambia, la app te mostrará la versión nueva y te pedirá aceptarla antes de seguir.',
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY];
