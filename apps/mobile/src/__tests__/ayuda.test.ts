// Ayuda en los dos idiomas. Bug real: con la app en inglés, la ayuda salía en español porque
// solo existía en un idioma. Esto impide que una sección nueva vuelva a quedar a medias.
import { helpFor, helpLead } from '@nomadaai/shared';

describe('ayuda bilingüe', () => {
  for (const superficie of ['mobile', 'web'] as const) {
    it(`${superficie}: misma estructura en español e inglés, sin textos vacíos`, () => {
      const es = helpFor(superficie, 'es');
      const en = helpFor(superficie, 'en');
      expect(en.length).toBe(es.length);
      es.forEach((sec, i) => {
        expect(en[i].items.length).toBe(sec.items.length);
        expect(sec.title && en[i].title).toBeTruthy();
        sec.items.forEach((it, j) => {
          expect(it.body.length).toBeGreaterThan(0);
          expect(en[i].items[j].body.length).toBeGreaterThan(0);
          // Si un texto es idéntico en los dos idiomas, casi seguro se olvidó traducir.
          expect(en[i].items[j].body).not.toBe(it.body);
        });
      });
    });
  }

  it('la entrada también está en los dos idiomas', () => {
    expect(helpLead('en')).not.toBe(helpLead('es'));
    expect(helpLead('en').length).toBeGreaterThan(0);
  });
});
