import { EstadoModeracion, TipoLugar } from 'shared';
import {
  detalleEntreParentesis,
  lugaresDeMunicipio,
  normalizarMunicipio,
  pareceNombrePropio,
  type FilaMunicipio,
} from './municipios-cv';

describe('municipios-cv', () => {
  /** Fila del censo con lo mínimo; cada test añade el recurso que le interesa. */
  const fila = (extra: Partial<FilaMunicipio> = {}): FilaMunicipio => ({
    provincia: 'Alicante',
    comarca: "Alacantí, L'",
    municipio: 'Alicante',
    ...extra,
  });

  describe('normalizarMunicipio', () => {
    it('debería mover el artículo del INE al principio', () => {
      // El INE escribe "Campello, el" para ordenar por el sustantivo; en pantalla
      // la persona busca "El Campello".
      expect(normalizarMunicipio('Campello, el')).toBe('El Campello');
      expect(normalizarMunicipio("Vall d'Uixó, la")).toBe("La Vall d'Uixó");
    });

    it('debería dejar intacto un nombre sin artículo pospuesto', () => {
      expect(normalizarMunicipio('València')).toBe('València');
      expect(normalizarMunicipio('  Dénia  ')).toBe('Dénia');
    });

    it('no debería tocar un nombre con más de una coma', () => {
      expect(normalizarMunicipio('Uno, dos, tres')).toBe('Uno, dos, tres');
    });
  });

  describe('detalleEntreParentesis', () => {
    it('debería extraer el texto del paréntesis', () => {
      expect(detalleEntreParentesis('Sí (Cala Rocío)')).toBe('Cala Rocío');
    });

    it('debería devolver null si no hay paréntesis', () => {
      expect(detalleEntreParentesis('Sí')).toBeNull();
    });
  });

  describe('pareceNombrePropio', () => {
    it('debería reconocer un nombre propio por su mayúscula inicial', () => {
      expect(pareceNombrePropio('Cala Rocío')).toBe(true);
      expect(pareceNombrePropio('Parque de la Canaleta')).toBe(true);
    });

    it('no debería tomar por nombre una aclaración de dónde está', () => {
      // "junto a la playa canina" describe la ubicación; como título de la
      // ficha quedaría absurdo.
      expect(pareceNombrePropio('junto a la playa canina')).toBe(false);
      expect(pareceNombrePropio('varios: Parque de Cabecera')).toBe(false);
    });

    it('no debería aceptar un texto que no cabe en el título', () => {
      expect(pareceNombrePropio('A'.repeat(61))).toBe(false);
    });
  });

  describe('lugaresDeMunicipio', () => {
    it('no debería generar nada para un municipio sin recursos', () => {
      // El censo lista los 542 municipios; /explora sólo enseña sitios a los que ir.
      expect(lugaresDeMunicipio(fila())).toEqual([]);
    });

    it('no debería generar nada sin nombre de municipio', () => {
      expect(lugaresDeMunicipio(fila({ municipio: '  ', playaCanina: 'Sí' }))).toEqual([]);
    });

    it('debería generar una ficha por cada recurso declarado', () => {
      const lugares = lugaresDeMunicipio(fila({
        municipio: 'Campello, el',
        playaCanina: 'Sí (Platja del Riu Sec)',
        rio: 'Vinalopó',
        pipican: 'Sí (junto a la playa canina)',
      }));

      expect(lugares.map((l) => l.tipo)).toEqual([
        TipoLugar.PLAYA, TipoLugar.RIO, TipoLugar.PARQUE,
      ]);
      expect(lugares.every((l) => l.ubicacion.ciudad === 'El Campello')).toBe(true);
    });

    it('debería publicar las fichas directamente, sin pasar por moderación', () => {
      // La moderación es para lo que aporta la comunidad; esto es un censo
      // revisado que se carga desde el servidor.
      const [playa] = lugaresDeMunicipio(fila({ playaCanina: 'Sí' }));

      expect(playa.estado).toBe(EstadoModeracion.PUBLICADO);
    });

    it('debería conservar provincia, comarca y la procedencia del dato', () => {
      const [playa] = lugaresDeMunicipio(fila({ playaCanina: 'Sí' }));

      expect(playa.ubicacion.provincia).toBe('Alicante');
      expect(playa.atributos['comarca']).toBe("Alacantí, L'");
      expect(playa.atributos['fuente']).toBe('municipios_final.xlsx');
    });

    describe('playa canina', () => {
      it('debería usar el nombre de la cala cuando la hoja lo indica', () => {
        const [playa] = lugaresDeMunicipio(fila({ playaCanina: 'Sí (Cala Rocío)' }));

        expect(playa.nombre).toBe('Cala Rocío');
      });

      it('debería componer un nombre con el municipio si no hay cala', () => {
        const [playa] = lugaresDeMunicipio(fila({ municipio: 'Calp', playaCanina: 'Sí' }));

        expect(playa.nombre).toBe('Playa canina de Calp');
      });

      it('debería avisar cuando el acceso es parcial', () => {
        // Sin el aviso, alguien conduce hasta allí en agosto y se lo encuentra cerrado.
        const [playa] = lugaresDeMunicipio(fila({ playaCanina: 'Parcial (sólo en invierno)' }));

        expect(playa.atributos['accesoParcial']).toBe(true);
        expect(playa.descripcion).toContain('Acceso parcial');
      });

      it('no debería marcar como parcial un acceso normal', () => {
        const [playa] = lugaresDeMunicipio(fila({ playaCanina: 'Sí' }));

        expect(playa.atributos['accesoParcial']).toBe(false);
        expect(playa.descripcion).not.toContain('Acceso parcial');
      });

      it('debería mover a la descripción un detalle demasiado largo para el nombre', () => {
        const largo = 'varias calas repartidas por todo el término municipal con acceso señalizado';
        const [playa] = lugaresDeMunicipio(fila({ municipio: 'Dénia', playaCanina: `Sí (${largo})` }));

        expect(playa.nombre).toBe('Playa canina de Dénia');
        expect(playa.descripcion).toContain('Varias calas repartidas');
      });
    });

    describe('río', () => {
      it('debería nombrar el río y el municipio por el que pasa', () => {
        const [rio] = lugaresDeMunicipio(fila({ municipio: 'Villena', rio: 'Vinalopó' }));

        expect(rio.nombre).toBe('Río Vinalopó a su paso por Villena');
        expect(rio.atributos['rio']).toBe('Vinalopó');
      });

      it('debería recordar comprobar el cauce antes de bañar al perro', () => {
        const [rio] = lugaresDeMunicipio(fila({ rio: 'Turia' }));

        expect(rio.descripcion).toContain('normativa local');
      });
    });

    describe('pipicán', () => {
      it('debería tratar como aclaración un detalle que no es un nombre', () => {
        // "junto a la playa canina" dice dónde está, no cómo se llama.
        const [pipican] = lugaresDeMunicipio(fila({
          municipio: 'Campello, el', pipican: 'Sí (junto a la playa canina)',
        }));

        expect(pipican.nombre).toBe('Zona canina de El Campello');
        expect(pipican.descripcion).toContain('Junto a la playa canina.');
      });

      it('debería usar el nombre del parque cuando la hoja lo indica', () => {
        const [pipican] = lugaresDeMunicipio(fila({ pipican: 'Sí (Parque de la Canaleta)' }));

        expect(pipican.nombre).toBe('Parque de la Canaleta');
        expect(pipican.tipo).toBe(TipoLugar.PARQUE);
        expect(pipican.atributos['vallado']).toBe(true);
      });

      it('debería componer un nombre corto cuando la hoja lista muchas zonas', () => {
        // València enumera cinco parques y 19 zonas de socialización: eso no cabe
        // en el título de una tarjeta.
        const muchas = 'varios: Parque de Cabecera, Parque Central, Jardín del Turia, Patraix, y 19 zonas de socialización canina';
        const [pipican] = lugaresDeMunicipio(fila({ municipio: 'València', pipican: `Sí (${muchas})` }));

        expect(pipican.nombre).toBe('Zona canina de València');
        expect(pipican.descripcion).toContain('19 zonas de socialización');
        expect(pipican.descripcion).toContain('Parque de Cabecera');
      });

      it('debería componer un nombre genérico si no hay detalle', () => {
        const [pipican] = lugaresDeMunicipio(fila({ municipio: 'Mislata', pipican: 'Sí' }));

        expect(pipican.nombre).toBe('Zona canina de Mislata');
      });
    });
  });
});
