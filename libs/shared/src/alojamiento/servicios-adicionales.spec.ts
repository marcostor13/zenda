import {
  CobroServicioAdicional, PLUSES_DIARIOS_SUGERIDOS, TipoPlusAlojamiento, cobroDeServicioAdicional, esPlusDiario,
  lineasServicioAdicional, plusesSugeridosParaPerro, resumenLineasServicioAdicional, tiposPlusSegunPerfil,
  totalServiciosAdicionales, unidadesServicioAdicional,
} from './servicios-adicionales';

const extras = [
  { nombre: 'Peluquería', precio: 25 },
  { nombre: 'Medicación', precio: 3, cobro: CobroServicioAdicional.POR_DIA_PERRO },
  { nombre: 'Paseo extra', precio: 4, cobro: CobroServicioAdicional.POR_DIA },
];

describe('servicios adicionales del alojamiento', () => {
  it('debería leer como cobro único un extra sin modo o con un modo desconocido', () => {
    expect(cobroDeServicioAdicional({})).toBe(CobroServicioAdicional.UNICO);
    expect(cobroDeServicioAdicional({ cobro: 'raro' })).toBe(CobroServicioAdicional.UNICO);
    expect(cobroDeServicioAdicional({ cobro: 'por_dia' })).toBe(CobroServicioAdicional.POR_DIA);
  });

  it('debería contar las unidades según el modo de cobro', () => {
    const estancia = { dias: 7, perros: 2 };
    expect(unidadesServicioAdicional(CobroServicioAdicional.UNICO, estancia)).toBe(1);
    expect(unidadesServicioAdicional(CobroServicioAdicional.POR_DIA, estancia)).toBe(7);
    expect(unidadesServicioAdicional(CobroServicioAdicional.POR_DIA_PERRO, estancia)).toBe(14);
  });

  it('debería contar al menos un día y un perro', () => {
    expect(unidadesServicioAdicional(CobroServicioAdicional.POR_DIA_PERRO, { dias: 0, perros: 0 })).toBe(1);
  });

  it('debería multiplicar la medicación por días y perros y la peluquería una sola vez', () => {
    const total = totalServiciosAdicionales(extras, ['Peluquería', 'Medicación'], { dias: 7, perros: 2 });
    expect(total).toBe(25 + 3 * 7 * 2);
  });

  it('debería ignorar los extras elegidos que el comercio ya no ofrece', () => {
    const lineas = lineasServicioAdicional(extras, ['No existe', 'Paseo extra'], { dias: 3, perros: 1 });
    expect(lineas).toEqual([
      { nombre: 'Paseo extra', precioUnitario: 4, cobro: CobroServicioAdicional.POR_DIA, unidades: 3, importe: 12 },
    ]);
  });

  it('debería devolver 0 sin extras elegidos', () => {
    expect(totalServiciosAdicionales(extras, [], { dias: 5, perros: 1 })).toBe(0);
  });
});

describe('pluses diarios según la ficha del perro', () => {
  const pluses = [
    { nombre: 'Baño a la recogida', precio: 25 },
    { nombre: 'Sin pienso propio', precio: 3, cobro: CobroServicioAdicional.POR_DIA, tipo: TipoPlusAlojamiento.SIN_PIENSO },
    { nombre: 'Perro agresivo', precio: 5, cobro: CobroServicioAdicional.POR_DIA_PERRO, tipo: TipoPlusAlojamiento.AGRESIVO },
    { nombre: 'Mucho miedo', precio: 5, cobro: CobroServicioAdicional.POR_DIA_PERRO, tipo: TipoPlusAlojamiento.MIEDO },
    { nombre: 'Medicación', precio: 2, cobro: CobroServicioAdicional.POR_DIA, tipo: TipoPlusAlojamiento.MEDICACION },
  ];

  it('debería distinguir el servicio puntual de los pluses diarios', () => {
    expect(esPlusDiario(pluses[0])).toBe(false);
    expect(esPlusDiario(pluses[1])).toBe(true);
  });

  it('debería sugerir el plus de agresivo para un perro reactivo o protector', () => {
    expect(tiposPlusSegunPerfil({ reactividadCorrea: true })).toEqual([TipoPlusAlojamiento.AGRESIVO]);
    expect(tiposPlusSegunPerfil({ temperamento: 'Protector' })).toEqual([TipoPlusAlojamiento.AGRESIVO]);
    expect(tiposPlusSegunPerfil({ sociabilidadPerros: 'no_tolera' })).toEqual([TipoPlusAlojamiento.AGRESIVO]);
  });

  it('debería sugerir miedo y medicación según la ficha', () => {
    expect(tiposPlusSegunPerfil({ temperamento: 'Nervioso', medicacion: ['Apoquel'] }))
      .toEqual([TipoPlusAlojamiento.MIEDO, TipoPlusAlojamiento.MEDICACION]);
    expect(tiposPlusSegunPerfil({ ansiedadSeparacion: true })).toEqual([TipoPlusAlojamiento.MIEDO]);
  });

  it('no debería sugerir nada para un perro sin ficha o tranquilo', () => {
    expect(tiposPlusSegunPerfil(null)).toEqual([]);
    expect(tiposPlusSegunPerfil({ temperamento: 'Muy tranquilo', medicacion: [' '] })).toEqual([]);
  });

  it('debería devolver los nombres de los pluses del servicio que encajan con el perro', () => {
    expect(plusesSugeridosParaPerro(pluses, { reactividadCorrea: true, medicacion: ['Apoquel'] }))
      .toEqual(['Perro agresivo', 'Medicación']);
  });

  it('no debería premarcar el pienso: la ficha no dice si lo traerán', () => {
    expect(plusesSugeridosParaPerro(pluses, { temperamento: 'Activo' })).toEqual([]);
  });

  it('debería ofrecer los pluses típicos que pidió la residencia', () => {
    const tipos = PLUSES_DIARIOS_SUGERIDOS.map((p) => p.tipo);
    expect(tipos).toEqual(expect.arrayContaining([
      TipoPlusAlojamiento.SIN_PIENSO, TipoPlusAlojamiento.NEVERA, TipoPlusAlojamiento.AGRESIVO, TipoPlusAlojamiento.MIEDO,
    ]));
  });

  it('debería resumir el caso de la guardería: 5 días sin pienso y baño a la recogida', () => {
    const lineas = lineasServicioAdicional(pluses, ['Sin pienso propio', 'Baño a la recogida'], { dias: 5, perros: 1 });
    expect(resumenLineasServicioAdicional(lineas))
      .toBe('Sin pienso propio: 3,00 € × 5 = 15,00 € · Baño a la recogida: 25,00 €');
    expect(totalServiciosAdicionales(pluses, ['Sin pienso propio', 'Baño a la recogida'], { dias: 5, perros: 1 })).toBe(40);
  });
});
