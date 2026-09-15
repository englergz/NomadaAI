// NOVEDADES que ve el usuario al abrir la app tras una actualización por aire.
//
// La entrada [0] es la versión en curso. Se escribe en los dos idiomas de la app
// y en lenguaje de usuario (qué gana, no qué se tocó por dentro). Al publicar un
// `eas update` con cambios visibles, se añade una entrada arriba.
export interface ChangelogEntry {
  /** Fecha de publicación del update (AAAA-MM-DD). */
  date: string;
  items: { es: string; en: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-09-15',
    items: [
      { es: '«Borrar mis datos» ahora borra también tus reportes en el servidor. La opinión que nos dejes se conserva sin nada que la vincule contigo.',
        en: '“Delete my data” now also deletes your reports on the server. The feedback you leave is kept with nothing linking it to you.' },
      { es: 'Si iniciaste sesión, puedes eliminar también tu cuenta desde la app.',
        en: 'If you are signed in, you can also delete your account from the app.' },
      { es: 'Tu histórico, tus reportes y tus opiniones solo los puedes borrar tú: van protegidos con tu cuenta o con una llave que vive en tu teléfono.',
        en: 'Only you can delete your history, reports and feedback: they are protected by your account or by a key that lives on your phone.' },
      { es: 'Política de privacidad actualizada: dice exactamente qué guardamos, dónde, quién interviene y cómo borrarlo. Te pediremos aceptarla de nuevo.',
        en: 'Updated privacy policy: it says exactly what we keep, where, who is involved and how to delete it. We will ask you to accept it again.' },
    ],
  },
  {
    date: '2026-09-10',
    items: [
      { es: 'Nuevo fondo de mapa (OpenFreeMap, datos de OpenStreetMap): el proveedor anterior dejó de servir sin clave y tapaba el mapa.',
        en: 'New map background (OpenFreeMap, OpenStreetMap data): the previous provider stopped serving without a key and covered the map.' },
      { es: 'Cali ya traza rutas seguras y compara la exposición al riesgo con la ruta directa.',
        en: 'Cali now draws safe routes and compares risk exposure against the direct route.' },
      { es: 'Nuevo recorrido de bienvenida: protección automática, reportes de la comunidad y Círculos (próximamente).',
        en: 'New welcome tour: automatic protection, community reports and Circles (coming soon).' },
      { es: 'Selector de ciudad por país, con lo que hay disponible en cada una.',
        en: 'City picker by country, showing what is available in each one.' },
      { es: 'Los lugares del mapa ahora llevan iconos por categoría, también en Android y iPhone.',
        en: 'Map places now carry icons per category, on Android and iPhone too.' },
      { es: 'La pantalla de arranque refleja la carga real: ajustes, ubicación y mapa de riesgo.',
        en: 'The launch screen now reflects the real loading: settings, location and risk map.' },
      { es: 'Configuración más limpia: ayuda, mis datos, términos y restablecer viven en «Más opciones».',
        en: 'Cleaner Settings: help, my data, terms and reset now live under “More options”.' },
      { es: 'Sin señal la app sigue: muestra el último mapa de riesgo descargado y guarda tus reportes para enviarlos solos al volver la conexión.',
        en: 'No signal? The app keeps going: it shows the last downloaded risk map and saves your reports to send them by itself when you are back online.' },
      { es: 'El mapa de riesgo ahora es el de la hora real del día, no siempre el de las 19:00.',
        en: 'The risk map now matches the real hour of the day, not always 7 pm.' },
      { es: 'Tu histórico local queda cifrado en el teléfono.',
        en: 'Your local history is now encrypted on the phone.' },
      { es: 'Las actualizaciones avisan cuando están listas y nunca se aplican durante un recorrido.',
        en: 'Updates let you know when they are ready and never apply during a trip.' },
    ],
  },
];
