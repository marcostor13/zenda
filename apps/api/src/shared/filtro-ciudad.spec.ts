import { condicionCiudadGuardada, condicionCiudadTexto } from './filtro-ciudad';

const CAMPOS = {
  clave: 'ubicacion.ciudadClave',
  normalizada: 'ubicacion.ciudadNormalizada',
  texto: 'ubicacion.ciudad',
};

describe('condicionCiudadGuardada', () => {
  const claves = (ciudad: string): string[] => {
    const condicion = condicionCiudadGuardada(ciudad, CAMPOS) as { $or: Record<string, never>[] };
    const porClave = condicion.$or.find((c) => (c[CAMPOS.clave] as { $in?: string[] })?.$in);
    return ((porClave?.[CAMPOS.clave] as unknown as { $in: string[] })?.$in) ?? [];
  };

  it('debería cubrir todas las formas de una población conocida', () => {
    expect(claves('Villareal')).toEqual(expect.arrayContaining(['vilareal', 'villarreal']));
  });

  it('debería devolver null si el texto no tiene letras', () => {
    expect(condicionCiudadGuardada('  ', CAMPOS)).toBeNull();
    expect(condicionCiudadGuardada('—', CAMPOS)).toBeNull();
  });

  it('debería incluir la rama de los documentos sin claves todavía', () => {
    const condicion = condicionCiudadGuardada('Madrid', CAMPOS) as { $or: Record<string, unknown>[] };

    expect(condicion.$or).toContainEqual(expect.objectContaining({
      [CAMPOS.clave]: { $exists: false },
    }));
  });

  it('debería anclar al principio de palabra para no confundir poblaciones', () => {
    const condicion = condicionCiudadGuardada('Vera', CAMPOS) as { $or: Record<string, RegExp>[] };
    const regex = condicion.$or.map((c) => c[CAMPOS.normalizada]).find(Boolean)!;

    expect(regex.test('vera')).toBe(true);
    expect(regex.test('vera de moncayo')).toBe(true);
    expect(regex.test('talavera de la reina')).toBe(false);
  });
});

describe('condicionCiudadTexto', () => {
  const regexDe = (ciudad: string): RegExp =>
    (condicionCiudadTexto(ciudad, 'ubicacion.ciudad') as Record<string, RegExp>)['ubicacion.ciudad'];

  it('debería buscar el nombre canónico y sus variantes', () => {
    const regex = regexDe('Villareal');

    expect(regex.test('Vila-real')).toBe(true);
    expect(regex.test('Villarreal')).toBe(true);
  });

  it('debería usar el texto tal cual para lo que no está en el catálogo', () => {
    const regex = regexDe('Riola');

    expect(regex.test('Riola')).toBe(true);
    expect(regex.test('Sueca')).toBe(false);
  });

  it('debería escapar lo que escribe el usuario', () => {
    const regex = regexDe('(a+)+$');

    expect(regex.source).toContain('\\(');
    expect(regex.test('Madrid')).toBe(false);
  });

  it('debería devolver null con el texto vacío o ausente', () => {
    expect(condicionCiudadTexto('   ', 'ubicacion.ciudad')).toBeNull();
    expect(condicionCiudadTexto(undefined as unknown as string, 'ubicacion.ciudad')).toBeNull();
  });
});
