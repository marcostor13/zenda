import { edadLegible, normalizarBusqueda } from './edad';

describe('edadLegible', () => {
  const haceMeses = (meses: number) => {
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - meses);
    return fecha.toISOString();
  };

  it('debería devolver null sin fecha o con una fecha inválida o futura', () => {
    expect(edadLegible(undefined)).toBeNull();
    expect(edadLegible('no-es-fecha')).toBeNull();
    expect(edadLegible(new Date(Date.now() + 86_400_000 * 40).toISOString())).toBeNull();
  });

  it('debería expresar en meses a los cachorros y en años a los adultos', () => {
    expect(edadLegible(haceMeses(5))).toBe('5 meses');
    expect(edadLegible(haceMeses(13))).toBe('1 año');
    expect(edadLegible(haceMeses(40))).toBe('3 años');
  });

  it('debería pasar el texto por el traductor recibido', () => {
    const t = jest.fn().mockReturnValue('traducido');
    expect(edadLegible(haceMeses(40), t)).toBe('traducido');
    expect(t).toHaveBeenCalledWith('{n} años', { n: 3 });
  });
});

describe('normalizarBusqueda', () => {
  it('debería ignorar mayúsculas y tildes', () => {
    expect(normalizarBusqueda('  Ruíz ÑANDÚ ')).toBe('ruiz nandu');
  });
});
