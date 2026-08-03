// Divide el APK por arquitectura. El 78 % del APK universal (159 MB medidos) eran
// librerías nativas de CUATRO arquitecturas, cuando un teléfono solo usa UNA:
//   x86_64 34.5 MB · x86 34.1 MB · arm64-v8a 32.7 MB · armeabi-v7a 23.0 MB
// Con splits cada APK lleva solo la suya (~60 MB para arm64, el de cualquier
// teléfono moderno). Para las tiendas se sube un .aab y Google Play hace este
// mismo reparto automáticamente.
//
// Vive como config plugin porque android/ se regenera en cada prebuild: editar
// build.gradle a mano se perdería en la siguiente compilación.
const { withAppBuildGradle } = require('expo/config-plugins');

const SPLITS_BLOCK = `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk false
        }
    }
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes('splits {')) return cfg; // ya aplicado
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^android\s*\{/m,
      (match) => `${match}\n${SPLITS_BLOCK}`,
    );
    return cfg;
  });
};
