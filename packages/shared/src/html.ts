// Escapa texto antes de meterlo en HTML crudo (p. ej. `Popup.setHTML` de MapLibre).
//
// Por qué vive aquí: el escritorio y la versión web de la app pintan popups con
// nombres que vienen de OpenStreetMap, un dato que cualquiera puede editar. Un
// nombre como `<img src=x onerror=…>` se ejecutaría como script (XSS). La web de
// escritorio ya escapaba; la versión web de la app no. Una sola función para las
// dos evita que la próxima pantalla vuelva a olvidarlo.
//
// MapLibre no sanea `setHTML` en la versión que usamos (4.7.1): el saneador que
// cubre el aviso GHSA-jrc7-96c5-q579 no existe en esa rama, así que escapar aquí
// es la defensa real, no un complemento.
const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
