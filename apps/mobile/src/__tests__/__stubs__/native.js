// Sustitutos mínimos de los módulos nativos. Las pruebas cubren LÓGICA PURA
// (umbrales, geometría, vigencia del viaje); no necesitan el runtime de React
// Native, y arrastrarlo haría las pruebas lentas y frágiles.
module.exports = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'Platform') return { OS: 'android', select: (o) => o.android ?? o.default };
    if (prop === '__esModule') return true;
    return () => undefined;
  },
});
