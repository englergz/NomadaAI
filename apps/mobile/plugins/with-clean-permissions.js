// Quita permisos que NO usamos y que llegan heredados de librerías al fusionar
// manifiestos. Importa por dos razones:
//   1. SEGURIDAD/PRIVACIDAD: SYSTEM_ALERT_WINDOW («dibujar sobre otras apps») es
//      un permiso sensible que pide React Native para su menú de desarrollo; en
//      una app publicada no hace falta y en una auditoría es una señal de alarma.
//      READ/WRITE_EXTERNAL_STORAGE son de la era anterior al almacenamiento por
//      ámbitos y tampoco los usamos: HOY no hay adjuntar foto en los reportes.
//      CUANDO se añada (galería/cámara para incidentes), NO se recuperan estos:
//      expo-image-picker pide CAMERA y READ_MEDIA_IMAGES (Android 13+), que son
//      los permisos correctos y de grano fino. Los de aquí son los legados, que
//      dan acceso a TODO el almacenamiento del usuario y no queremos pedirlos.
//   2. CONFIANZA: la pantalla de permisos que ve el usuario debe contener SOLO lo
//      que la app realmente necesita para cuidarlo en el camino.
//
// Se usa `tools:node="remove"`, que elimina la entrada durante la fusión aunque
// la declare una dependencia.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const REMOVE = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

module.exports = function withCleanPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    // Fuera las declaraciones propias…
    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (p) => !REMOVE.includes(p.$['android:name']),
    );
    // …y se marcan para que tampoco entren desde las librerías.
    for (const name of REMOVE) {
      manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }
    return cfg;
  });
};
