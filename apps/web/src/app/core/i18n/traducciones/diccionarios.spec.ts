import { IDIOMAS_SOPORTADOS, IdiomaSoportado } from 'shared';
import type { Diccionario } from '../diccionario';
import en from './en';
import de from './de';
import fr from './fr';
import italiano from './it';
import pt from './pt';
import pl from './pl';
import nl from './nl';

/**
 * Red de seguridad de los diccionarios. Con clave natural, una cadena sin
 * traducir sale en español y no rompe nada; lo que sí rompe la pantalla es una
 * traducción vacía o que pierda una marca de interpolación, y eso se caza aquí.
 */
describe('Diccionarios de traducción', () => {
  const traducidos: Record<Exclude<IdiomaSoportado, 'es'>, Diccionario> =
    { en, de, fr, it: italiano, pt, pl, nl };

  const marcas = (texto: string): string[] => (texto.match(/\{\w+\}/g) ?? []).sort();

  /** El inglés hace de referencia: es el idioma que siempre se traduce primero. */
  const clavesDeReferencia = Object.keys(en).sort();

  it('debería haber un diccionario por cada idioma soportado salvo el español', () => {
    // El español no lleva diccionario: su texto es la propia clave.
    expect(Object.keys(traducidos).sort()).toEqual(
      IDIOMAS_SOPORTADOS.map((i) => i.codigo).filter((c) => c !== 'es').slice().sort(),
    );
  });

  for (const [codigo, diccionario] of Object.entries(traducidos)) {
    describe(`"${codigo}"`, () => {
      it('no debería tener ningún texto vacío', () => {
        const vacias = Object.entries(diccionario)
          .filter(([, texto]) => texto.trim() === '')
          .map(([clave]) => clave);
        expect(vacias).toEqual([]);
      });

      it('debería conservar las marcas de interpolación del español', () => {
        const desajustadas = Object.entries(diccionario)
          .filter(([clave, texto]) => marcas(clave).join() !== marcas(texto).join())
          .map(([clave]) => clave);
        expect(desajustadas).toEqual([]);
      });

      it('debería cubrir exactamente las mismas cadenas que el resto de idiomas', () => {
        // El invariante que de verdad importa: que ningún idioma se quede atrás
        // al añadir una cadena nueva. Una entrada idéntica al español NO es un
        // fallo —«Agenda», «Aviso» o «(opcional)» se escriben igual en
        // portugués—, así que no se comprueba eso.
        expect(Object.keys(diccionario).sort()).toEqual(clavesDeReferencia);
      });
    });
  }
});
