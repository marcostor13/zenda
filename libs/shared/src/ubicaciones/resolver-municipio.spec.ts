import {
  canonizarUbicacion, clavesDeMunicipio, coincideUbicacion, provinciaDe, resolverMunicipio,
} from './resolver-municipio';
import { MUNICIPIOS_ES } from './municipios';
import { claveUbicacion } from './normalizar-ubicacion';

describe('resolverMunicipio', () => {
  it('debería reconocer el nombre canónico', () => {
    const resuelto = resolverMunicipio('Valencia');

    expect(resuelto?.municipio.nombre).toBe('Valencia');
    expect(resuelto?.origen).toBe('exacta');
  });

  it('debería reconocer la población aunque se escriba sin tildes ni mayúsculas', () => {
    expect(resolverMunicipio('malaga')?.municipio.nombre).toBe('Málaga');
    expect(resolverMunicipio('ALCORCON')?.municipio.nombre).toBe('Alcorcón');
  });

  /** El caso que destapó todo: el comercio guardado como «villa-real». */
  it('debería unir Vila-real, Villarreal, Villareal y villa-real', () => {
    for (const forma of ['Vila-real', 'Villarreal', 'Villareal', 'villa-real', 'VILA REAL']) {
      expect(resolverMunicipio(forma)?.municipio.nombre).toBe('Vila-real');
    }
  });

  it('debería reconocer los nombres oficiales en otras lenguas', () => {
    expect(resolverMunicipio('Elx')?.municipio.nombre).toBe('Elche');
    expect(resolverMunicipio('Donostia')?.municipio.nombre).toBe('San Sebastián');
    expect(resolverMunicipio('Alacant')?.municipio.nombre).toBe('Alicante');
    expect(resolverMunicipio('Gerona')?.municipio.nombre).toBe('Girona');
    expect(resolverMunicipio('La Coruña')?.municipio.nombre).toBe('A Coruña');
  });

  it('debería marcar como alias lo que no es el nombre canónico', () => {
    expect(resolverMunicipio('Villarreal')?.origen).toBe('alias');
  });

  it('debería tolerar el artículo inicial que sobra o que falta', () => {
    expect(resolverMunicipio('Ejido')?.municipio.nombre).toBe('El Ejido');
    expect(resolverMunicipio('Hospitalet de Llobregat')?.municipio.nombre).toBe("L'Hospitalet de Llobregat");
  });

  it('debería corregir una errata de una letra en nombres largos', () => {
    const resuelto = resolverMunicipio('Barcelna');

    expect(resuelto?.municipio.nombre).toBe('Barcelona');
    expect(resuelto?.origen).toBe('aproximada');
  });

  it('no debería adivinar con nombres cortos: una letra cambia de municipio', () => {
    // «Vera» (Almería) no está en el catálogo y se parece a varios que sí.
    expect(resolverMunicipio('Vera')).toBeNull();
  });

  it('no debería adivinar cuando hay dos candidatos a la misma distancia', () => {
    // «nerida» está a una letra de Mérida y de Lérida: elegir una sería enseñar
    // resultados de otra provincia sin que el usuario entienda por qué.
    expect(resolverMunicipio('nerida')).toBeNull();
  });

  it('no debería confundir dos poblaciones que se parecen pero existen las dos', () => {
    expect(resolverMunicipio('Palencia')?.municipio.nombre).toBe('Palencia');
    expect(resolverMunicipio('Valencia')?.municipio.nombre).toBe('Valencia');
  });

  it('debería aguantar un texto ausente sin romperse', () => {
    expect(resolverMunicipio(undefined as unknown as string)).toBeNull();
  });

  it('debería devolver null para una población que no está en el catálogo', () => {
    expect(resolverMunicipio('Riola')).toBeNull();
    expect(resolverMunicipio('')).toBeNull();
  });

  it('debería ofrecer todas las claves con las que puede estar guardada', () => {
    const claves = resolverMunicipio('Villarreal')!.claves;

    expect(claves).toContain('vilareal');
    expect(claves).toContain('villarreal');
    expect(claves).toContain('villareal');
  });
});

describe('canonizarUbicacion', () => {
  it('debería devolver el nombre canónico y la provincia de una población conocida', () => {
    expect(canonizarUbicacion('villa-real')).toEqual({
      ciudad: 'Vila-real',
      ciudadNormalizada: 'vila real',
      ciudadClave: 'vilareal',
      provincia: 'Castellón',
    });
  });

  it('debería aguantar un texto ausente sin romperse', () => {
    expect(canonizarUbicacion(undefined as unknown as string)).toEqual({
      ciudad: '', ciudadNormalizada: '', ciudadClave: '', provincia: undefined,
    });
  });

  it('debería respetar una población desconocida, sólo limpiando los espacios', () => {
    expect(canonizarUbicacion('  Riola  ')).toEqual({
      ciudad: 'Riola',
      ciudadNormalizada: 'riola',
      ciudadClave: 'riola',
      provincia: undefined,
    });
  });
});

describe('catálogo de municipios', () => {
  it('no debería tener dos municipios con la misma clave', () => {
    const vistas = new Map<string, string>();
    const chocan: string[] = [];

    for (const municipio of MUNICIPIOS_ES) {
      for (const clave of clavesDeMunicipio(municipio)) {
        const previo = vistas.get(clave);
        if (previo && previo !== municipio.nombre) chocan.push(`${clave}: ${previo} / ${municipio.nombre}`);
        vistas.set(clave, municipio.nombre);
      }
    }

    expect(chocan).toEqual([]);
  });

  it('debería poder resolver todos sus nombres y alias', () => {
    const fallan = MUNICIPIOS_ES
      .flatMap((m) => [m.nombre, ...m.alias])
      .filter((forma) => resolverMunicipio(forma)?.municipio.nombre !== resolverMunicipio(claveUbicacion(forma))?.municipio.nombre);

    expect(fallan).toEqual([]);
  });
});

describe('coincideUbicacion', () => {
  it('debería casar por cualquiera de las formas del nombre', () => {
    expect(coincideUbicacion('Vila-real', 'villareal')).toBe(true);
    expect(coincideUbicacion('Alicante', 'alacant')).toBe(true);
    expect(coincideUbicacion('Málaga', 'malaga')).toBe(true);
  });

  it('debería casar por el principio del nombre, que es como se teclea', () => {
    expect(coincideUbicacion('Castellón de la Plana', 'castell')).toBe(true);
  });

  it('debería descartar lo que no se parece', () => {
    expect(coincideUbicacion('Madrid', 'barcelona')).toBe(false);
  });

  it('debería casar por el texto tal cual si la población no está en el catálogo', () => {
    expect(coincideUbicacion('Riola', 'rio')).toBe(true);
    expect(coincideUbicacion('Riola', 'sueca')).toBe(false);
  });

  it('debería aceptarlo todo con el campo vacío: la lista se enseña entera', () => {
    expect(coincideUbicacion('Madrid', '')).toBe(true);
  });
});

describe('provinciaDe', () => {
  it('debería devolver la provincia de una población conocida', () => {
    expect(provinciaDe('Vila-real')).toBe('Castellón');
    expect(provinciaDe('villareal')).toBe('Castellón');
  });

  it('debería devolver undefined para lo que no está en el catálogo', () => {
    expect(provinciaDe('Riola')).toBeUndefined();
  });
});
