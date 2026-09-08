// Stub propio (no el Proxy compartido): asi un jest.mock('expo-crypto') registra su
// fabrica en una ruta distinta de react-native/async-storage y no las pisa.
module.exports = { AESEncryptionKey: {}, AESSealedData: {}, aesEncryptAsync: async () => { throw new Error('stub'); }, aesDecryptAsync: async () => { throw new Error('stub'); } };
