// Códigos de invitación a un círculo. Se dictan por teléfono o se pegan de un mensaje, así que
// lo que importa es aceptar las formas razonables de escribirlos y rechazar pronto lo que
// nunca podría ser un código, sin preguntar al servidor.
import {
  CIRCLE_CODE_ALPHABET, CIRCLE_CODE_LENGTH, DEFAULT_CIRCLE_TRIGGERS, formatCircleCode, normalizeCircleCode,
} from '@nomadaai/shared';

describe('código de círculo', () => {
  it('acepta el código tal cual', () => {
    expect(normalizeCircleCode('ABCDEFGH')).toBe('ABCDEFGH');
  });

  it('acepta minúsculas, espacios y el guion con que se muestra', () => {
    expect(normalizeCircleCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizeCircleCode(' ab cd ef gh ')).toBe('ABCDEFGH');
  });

  it('rechaza lo que no mide 8', () => {
    expect(normalizeCircleCode('ABCDEFG')).toBeNull();
    expect(normalizeCircleCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeCircleCode('')).toBeNull();
  });

  it('rechaza los caracteres que se confunden al dictar (0/O y 1/I/L no existen en el alfabeto)', () => {
    expect(normalizeCircleCode('ABCDEFG0')).toBeNull();
    expect(normalizeCircleCode('ABCDEFG1')).toBeNull();
    expect(normalizeCircleCode('ABCDEFGI')).toBeNull();
    expect(normalizeCircleCode('ABCDEFGL')).toBeNull();
    expect(normalizeCircleCode('ABCDEFGO')).toBeNull();
  });

  it('el alfabeto de verdad no trae esos caracteres', () => {
    for (const ch of '01ILO') expect(CIRCLE_CODE_ALPHABET.includes(ch)).toBe(false);
    expect(CIRCLE_CODE_LENGTH).toBe(8);
  });

  it('se muestra en dos bloques para dictarlo, y lo mostrado vuelve a leerse igual', () => {
    const mostrado = formatCircleCode('ABCDEFGH');
    expect(mostrado).toBe('ABCD-EFGH');
    expect(normalizeCircleCode(mostrado)).toBe('ABCDEFGH');
  });
});

describe('disparadores de fábrica', () => {
  it('solo el riesgo alto viene encendido: compartir es por excepción', () => {
    expect(DEFAULT_CIRCLE_TRIGGERS).toEqual({ riesgo: true, precaucion: false, inactividad: false, desvio: false });
  });
});
