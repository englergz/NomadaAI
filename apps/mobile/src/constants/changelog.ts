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
    date: '2026-09-10',
    items: [
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
      { es: 'Tu histórico local queda cifrado en el teléfono.',
        en: 'Your local history is now encrypted on the phone.' },
      { es: 'Las actualizaciones avisan cuando están listas y nunca se aplican durante un recorrido.',
        en: 'Updates let you know when they are ready and never apply during a trip.' },
    ],
  },
];
