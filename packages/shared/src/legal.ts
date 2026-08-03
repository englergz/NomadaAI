// TÉRMINOS DE USO y POLÍTICA DE PRIVACIDAD — fuente única para app y escritorio.
//
// Al cambiar el texto hay que SUBIR `LEGAL_VERSION`: la app guarda qué versión
// aceptó cada usuario y volverá a pedir aceptación si no coincide. Cambiar el
// texto sin subir la versión deja a la gente aceptando algo que ya no dice lo
// mismo, que es justo lo que la ley pretende evitar.

/** Se incrementa SIEMPRE que cambie el contenido legal. */
export const LEGAL_VERSION = '1.0.0';
/** Fecha de vigencia que se muestra al usuario y queda registrada. */
export const LEGAL_EFFECTIVE_DATE = '2026-08-03';

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
    'Tu ubicación es el dato más sensible que existe. Esta política explica exactamente qué hacemos con ella. Tratamiento conforme a la Ley 1581 de 2012 (Colombia).',
  blocks: [
    {
      title: 'Responsable del tratamiento',
      body:
        'Nómada.AI — proyecto de investigación (MGTIC). Contacto para ejercer tus derechos: englergz@gmail.com.',
    },
    {
      title: 'Qué recogemos y para qué',
      body:
        'Tu ubicación mientras usas la app, con una única finalidad: mostrarte en el mapa, calcular rutas más seguras y avisarte antes de una zona de riesgo. Si envías un reporte, guardamos su categoría, ubicación y hora de forma anónima.',
    },
    {
      title: 'Dónde vive tu recorrido',
      body:
        'El trayecto en curso se guarda EN TU TELÉFONO mientras dura el viaje y se BORRA al finalizarlo. Solo se retiene un tramo reciente, no el viaje completo. No publicamos ni compartimos la ubicación de nadie.',
    },
    {
      title: 'Funciona sin cuenta',
      body:
        'Puedes usar toda la aplicación sin registrarte. Iniciar sesión sirve únicamente para conservar tu histórico entre dispositivos. Sin cuenta, tus datos se quedan en tu teléfono.',
    },
    {
      title: 'Ubicación en segundo plano',
      body:
        'Si lo autorizas, seguimos tu recorrido con la pantalla apagada para poder avisarte a tiempo. Mientras eso ocurre verás SIEMPRE una notificación permanente: nunca te seguimos sin que lo sepas. El seguimiento se apaga solo al terminar el viaje, tras 30 minutos sin movimiento o a las 4 horas.',
    },
    {
      title: 'Qué NO hacemos',
      body:
        'No vendemos tus datos. No los cedemos a terceros con fines comerciales. No construimos un historial de dónde estuviste para usarlo con otro propósito. No usamos tu ubicación para publicidad.',
    },
    {
      title: 'Tus derechos',
      body:
        'Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización, escribiendo a englergz@gmail.com. Atendemos la solicitud y confirmamos cuando esté hecha.',
    },
    {
      title: 'Los reportes de la comunidad',
      body:
        'Los reportes se usan de forma agregada para mejorar el mapa de riesgo. Nunca se publican individualmente ni se asocian públicamente a quien los envió.',
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY];
