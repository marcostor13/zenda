import { AlojamientoViaje, DesplazamientoViaje, RitmoViaje, VerticalKey } from 'shared';
import {
  LugarContexto, PreferenciasViaje, ServicioContexto, armarDias, asegurarAlojamiento, conEstimacion,
  diasDelViaje, garantizarServicio, presupuestoDe, serviciosSugeridos, verticalesBuscadas,
} from './armar-itinerario';

const lugar = (n: number, tipo = 'playa'): LugarContexto =>
  ({ _id: `l${n}`, nombre: `Lugar ${n}`, tipo, ubicacion: { ciudad: 'Dénia' } });
const servicio = (id: string, vertical: string, precioBase = 40): ServicioContexto =>
  ({ _id: id, titulo: `Servicio ${id}`, vertical, precioBase });

const preferencias = (extra: Partial<PreferenciasViaje> = {}): PreferenciasViaje => ({
  ritmo: RitmoViaje.EQUILIBRADO,
  alojamiento: AlojamientoViaje.NECESITO,
  desplazamiento: DesplazamientoViaje.COCHE_PROPIO,
  serviciosExtra: [],
  dias: null,
  noches: 2,
  ...extra,
});

describe('diasDelViaje', () => {
  it('debería contar los dos extremos y acotar a cinco días', () => {
    expect(diasDelViaje('2026-10-01', '2026-10-03')).toBe(3);
    expect(diasDelViaje('2026-10-01', '2026-10-20')).toBe(5);
  });

  it('debería devolver null sin fechas o con fechas al revés', () => {
    expect(diasDelViaje('2026-10-01')).toBeNull();
    expect(diasDelViaje('2026-10-05', '2026-10-01')).toBeNull();
  });
});

describe('verticalesBuscadas', () => {
  it('debería pedir transporte, alojamiento y los extras en ese orden', () => {
    expect(verticalesBuscadas(preferencias({
      desplazamiento: DesplazamientoViaje.TRANSPORTE_MASCOTA, serviciosExtra: [VerticalKey.VETERINARIA],
    }))).toEqual([VerticalKey.TRANSPORTE, VerticalKey.HOTELES, VerticalKey.VETERINARIA]);
  });

  it('no debería pedir hotel si se vuelve el mismo día', () => {
    expect(verticalesBuscadas(preferencias({ noches: 0 }))).toEqual([]);
  });

  it('no debería pedir alojamiento a quien ya lo tiene', () => {
    expect(verticalesBuscadas(preferencias({ alojamiento: AlojamientoViaje.YA_LO_TENGO }))).toEqual([]);
  });
});

describe('armarDias', () => {
  const lugares = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => lugar(n));

  it('debería repartir los sitios según el ritmo', () => {
    const tranquilo = armarDias('Alicante', lugares, [], preferencias({ ritmo: RitmoViaje.TRANQUILO }));
    const intenso = armarDias('Alicante', lugares, [], preferencias({ ritmo: RitmoViaje.INTENSO }));

    expect(tranquilo[0].paradas).toHaveLength(2);
    expect(intenso[0].paradas).toHaveLength(4);
  });

  it('debería abrir el viaje con el transporte y el hotel', () => {
    const dias = armarDias('Alicante', lugares, [
      servicio('h', VerticalKey.HOTELES), servicio('t', VerticalKey.TRANSPORTE),
    ], preferencias({ desplazamiento: DesplazamientoViaje.TRANSPORTE_MASCOTA }));

    expect(dias[0].paradas.slice(0, 2).map((p) => p.servicioId)).toEqual(['t', 'h']);
  });

  it('nunca debería proponer una residencia canina para dormir con el perro', () => {
    const dias = armarDias('Alicante', lugares, [
      servicio('r', VerticalKey.ALOJAMIENTO), servicio('p', VerticalKey.PELUQUERIA),
    ], preferencias());

    const ids = dias.flatMap((d) => d.paradas).map((p) => p.servicioId).filter(Boolean);
    expect(ids).not.toContain('r');
    expect(ids).toContain('p');
  });

  it('debería repartir los servicios extra pedidos en días distintos', () => {
    const dias = armarDias('Alicante', lugares, [
      servicio('p', VerticalKey.PELUQUERIA), servicio('v', VerticalKey.VETERINARIA),
    ], preferencias({
      alojamiento: AlojamientoViaje.YA_LO_TENGO, dias: 2,
      serviciosExtra: [VerticalKey.PELUQUERIA, VerticalKey.VETERINARIA],
    }));

    expect(dias[0].paradas.at(-1)?.servicioId).toBe('p');
    expect(dias[1].paradas.at(-1)?.servicioId).toBe('v');
  });

  it('debería usar los días de las fechas aunque falten sitios', () => {
    expect(armarDias('Alicante', [lugar(1)], [], preferencias({ dias: 4 }))).toHaveLength(4);
  });

  it('debería titular el día de tiendas', () => {
    expect(armarDias('Alicante', [lugar(1, 'tienda')], [], preferencias())[0].titulo)
      .toBe('Día 1 · Compras para tu perro');
  });
});

describe('garantizarServicio', () => {
  it('debería añadir el servicio que el viaje necesita si no hay ninguno', () => {
    const dias = garantizarServicio(
      [{ dia: 1, titulo: 'Día 1', paradas: [] }],
      [servicio('p', VerticalKey.PELUQUERIA), servicio('h', VerticalKey.HOTELES)],
      preferencias(),
    );

    expect(dias[0].paradas[0].servicioId).toBe('h');
  });

  it('debería crear el primer día si el plan venía vacío', () => {
    expect(garantizarServicio([], [servicio('p', VerticalKey.PELUQUERIA)], preferencias())[0].paradas)
      .toHaveLength(1);
  });

  it('no debería tocar un plan sin servicios disponibles', () => {
    expect(garantizarServicio([], [], preferencias())).toEqual([]);
  });

  it('no debería rellenar con una residencia ni con un hotel si ya tiene alojamiento', () => {
    const dias = garantizarServicio(
      [{ dia: 1, titulo: 'Día 1', paradas: [] }],
      [servicio('r', VerticalKey.ALOJAMIENTO), servicio('h', VerticalKey.HOTELES)],
      preferencias({ alojamiento: AlojamientoViaje.YA_LO_TENGO }),
    );

    expect(dias[0].paradas).toHaveLength(0);
  });
});

describe('asegurarAlojamiento', () => {
  it('debería poner el hotel el primer día si el plan no lo trae', () => {
    const dias = asegurarAlojamiento(
      [{ dia: 1, titulo: 'Día 1', paradas: [] }], [servicio('h', VerticalKey.HOTELES)], preferencias(),
    );
    expect(dias[0].paradas[0].servicioId).toBe('h');
  });

  it('no debería duplicarlo si ya está', () => {
    const conHotel = [{
      dia: 1, titulo: '', paradas: [{ titulo: 'H', descripcion: '', tipo: 'servicio' as const, servicioId: 'h', vertical: VerticalKey.HOTELES }],
    }];
    expect(asegurarAlojamiento(conHotel, [servicio('h', VerticalKey.HOTELES)], preferencias())[0].paradas)
      .toHaveLength(1);
  });
});

describe('presupuestoDe', () => {
  it('debería contar el hotel por noche y el resto una vez', () => {
    const dias = armarDias('Alicante', [1, 2, 3, 4, 5, 6].map((n) => lugar(n)), [
      servicio('h', VerticalKey.HOTELES, 50), servicio('p', VerticalKey.PELUQUERIA, 30),
    ], preferencias({ dias: 3 }));

    // 2 noches × 50 + la peluquería del primer día.
    expect(presupuestoDe(dias, 2)).toBe(130);
  });

  it('debería usar las noches reales aunque el plan muestre menos días', () => {
    const dias = armarDias('Alicante', [lugar(1)], [servicio('h', VerticalKey.HOTELES, 50)], preferencias({ dias: 5 }));

    expect(presupuestoDe(dias, 9)).toBe(450);
  });
});

describe('conEstimacion', () => {
  const opcion = {
    nombre: 'x', resumen: '', presupuestoEstimado: 9999,
    dias: [{ dia: 1, titulo: '', paradas: [{
      titulo: 'H', descripcion: '', tipo: 'servicio' as const, servicioId: 'h', vertical: VerticalKey.HOTELES, precioEstimado: 60,
    }] }],
  };

  it('debería sustituir el coste que traiga el modelo por el calculado', () => {
    expect(conEstimacion(opcion, preferencias(), 100)).toMatchObject({
      presupuestoEstimado: 120, noches: 2, superaPresupuesto: true,
    });
  });

  it('no debería contar noches de hotel si ya tiene alojamiento', () => {
    expect(conEstimacion(opcion, preferencias({ alojamiento: AlojamientoViaje.YA_LO_TENGO })).noches).toBe(0);
  });
});

describe('serviciosSugeridos', () => {
  it('debería listar lo reservable del plan sin repetir', () => {
    const opcion = {
      nombre: 'x', resumen: '', presupuestoEstimado: 0,
      dias: [
        { dia: 1, titulo: '', paradas: [{ titulo: 'A', descripcion: '', tipo: 'servicio' as const, servicioId: 'a' }] },
        { dia: 2, titulo: '', paradas: [{ titulo: 'A', descripcion: '', tipo: 'servicio' as const, servicioId: 'a' }] },
      ],
    };
    expect(serviciosSugeridos([opcion, opcion], [])).toHaveLength(1);
  });

  it('debería ofrecer los servicios de la zona si el plan no trae ninguno', () => {
    expect(serviciosSugeridos([], [servicio('p', VerticalKey.PELUQUERIA)])[0].servicioId).toBe('p');
  });
});
