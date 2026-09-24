import { TamanoPerro } from '../enums/perro.enum';
import {
  ContextoCotizacion, SolicitudTransporte, TarifarioTransporte, cotizarTransporte, normalizarTerritorio,
} from './cotizar-transporte';
import {
  EquipajeTransporte, FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte, ModoPrecioTransporte,
  NecesidadTransporte, PLAZO_ACEPTACION_MIN, TipoServicioTransporte, VueltaTransporte, normalizarEspecie,
} from './transporte.catalogo';

const tarifa = (extra: Partial<TarifarioTransporte> = {}): TarifarioTransporte => ({
  tarifaBase: 20,
  tarifaKm: 0.5,
  capacidadPerros: 4,
  modalidades: [ModalidadTransporte.COMPARTIDO, ModalidadTransporte.EXCLUSIVO],
  precioExclusivo: 20,
  especiesAceptadas: ['perro', 'gato'],
  ...extra,
});

const solicitud = (extra: Partial<SolicitudTransporte> = {}): SolicitudTransporte => ({
  tipoServicio: TipoServicioTransporte.SOLO_IDA,
  origen: { texto: 'Castellón', placeId: 'a' },
  destino: { texto: 'Valencia', placeId: 'b' },
  fecha: '2026-10-01',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:30',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
  ...extra,
});

const contexto = (extra: Partial<ContextoCotizacion> = {}): ContextoCotizacion => ({
  km: 70,
  provinciaOrigen: 'Castellón',
  provinciaDestino: 'Valencia',
  paisOrigen: 'España',
  paisDestino: 'España',
  horasHastaRecogida: 48,
  ...extra,
});

describe('cotizarTransporte', () => {
  it('debería calcular base + km en un trayecto compartido sin mostrar el €/km en el desglose', () => {
    const resultado = cotizarTransporte(tarifa(), solicitud(), contexto());

    expect(resultado.estado).toBe('precio');
    expect(resultado.total).toBe(55);
    expect(resultado.desglose).toEqual([{ concepto: 'Trayecto', importe: 55 }]);
    expect(resultado.requiereAceptacion).toBe(false);
  });

  it('debería cobrar al menos la distancia mínima', () => {
    const resultado = cotizarTransporte(tarifa({ distanciaMinimaKm: 20 }), solicitud(), contexto({ km: 4 }));
    expect(resultado.total).toBe(30);
  });

  it('debería sumar el suplemento de exclusividad', () => {
    const resultado = cotizarTransporte(tarifa(), solicitud({ modalidad: ModalidadTransporte.EXCLUSIVO }), contexto());
    expect(resultado.total).toBe(75);
    expect(resultado.desglose).toContainEqual({ concepto: 'Transporte exclusivo', importe: 20 });
  });

  it('debería duplicar el trayecto y cobrar la espera en ida y vuelta tras unas horas', () => {
    const resultado = cotizarTransporte(
      tarifa({ tarifaEsperaPorHora: 10 }),
      solicitud({
        tipoServicio: TipoServicioTransporte.IDA_VUELTA,
        vuelta: { modo: VueltaTransporte.TRAS_HORAS, horas: 2 },
      }),
      contexto(),
    );
    expect(resultado.total).toBe(130);
    expect(resultado.desglose.map((l) => l.concepto)).toEqual(['Trayecto', 'Trayecto de vuelta', 'Espera']);
  });

  it('debería pedir aceptación del transportista si la vuelta es «cuando avise»', () => {
    const resultado = cotizarTransporte(
      tarifa(),
      solicitud({ tipoServicio: TipoServicioTransporte.IDA_VUELTA, vuelta: { modo: VueltaTransporte.CUANDO_AVISE } }),
      contexto(),
    );
    expect(resultado.requiereAceptacion).toBe(true);
    expect(resultado.plazoAceptacionMin).toBe(PLAZO_ACEPTACION_MIN.normal);
  });

  it('debería usar el precio fijo cuando la empresa tarifica así', () => {
    const resultado = cotizarTransporte(
      tarifa({ modoPrecio: ModoPrecioTransporte.FIJO, precioFijo: 40 }), solicitud(), contexto({ km: 300 }),
    );
    expect(resultado.total).toBe(40);
  });

  it('debería encontrar la zona en cualquiera de los dos sentidos y sin tildes', () => {
    const conZonas = tarifa({
      modoPrecio: ModoPrecioTransporte.POR_ZONA,
      zonasPrecio: [{ origen: 'valencia', destino: 'CASTELLON', precio: 48 }],
    });
    expect(cotizarTransporte(conZonas, solicitud(), contexto()).total).toBe(48);
  });

  it('debería pasar a presupuesto si no hay zona para la ruta', () => {
    const conZonas = tarifa({ modoPrecio: ModoPrecioTransporte.POR_ZONA, zonasPrecio: [] });
    expect(cotizarTransporte(conZonas, solicitud(), contexto()).estado).toBe('presupuesto');
  });

  it('debería rechazar una modalidad que la empresa no ofrece', () => {
    const resultado = cotizarTransporte(
      tarifa(), solicitud({ modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 1 }), contexto(),
    );
    expect(resultado.estado).toBe('no_disponible');
  });

  it('debería cobrar acompañantes y maletas cuando el propietario viaja', () => {
    const resultado = cotizarTransporte(
      tarifa({
        modalidades: [ModalidadTransporte.CON_PROPIETARIO],
        plazasPasajeros: 2,
        suplementos: { porPersona: 10, porMaleta: 5 },
      }),
      solicitud({ modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 2, equipaje: EquipajeTransporte.VARIAS_MALETAS }),
      contexto(),
    );
    expect(resultado.total).toBe(55 + 20 + 10);
  });

  it('debería rechazar más acompañantes que plazas', () => {
    const resultado = cotizarTransporte(
      tarifa({ modalidades: [ModalidadTransporte.CON_PROPIETARIO], plazasPasajeros: 1 }),
      solicitud({ modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 3 }),
      contexto(),
    );
    expect(resultado.estado).toBe('no_disponible');
  });

  it('debería rechazar especies que la empresa no traslada', () => {
    const resultado = cotizarTransporte(
      tarifa(), solicitud({ mascotas: [{ especie: 'Reptil', tamano: TamanoPerro.MINI }] }), contexto(),
    );
    expect(resultado.estado).toBe('no_disponible');
  });

  it('debería comprobar la capacidad con el número real de mascotas', () => {
    const tres = Array.from({ length: 3 }, () => ({ especie: 'perro', tamano: TamanoPerro.MEDIANO }));
    const resultado = cotizarTransporte(tarifa({ maxPerrosPorTrayecto: 2 }), solicitud({ mascotas: tres }), contexto());
    expect(resultado.estado).toBe('no_disponible');
    expect(resultado.motivo).toContain('2');
  });

  it('debería sumar mascotas adicionales, talla grande y medicación', () => {
    const resultado = cotizarTransporte(
      tarifa({ suplementos: { mascotaAdicional: 8, mascotaGrande: 10, medicacion: 5 } }),
      solicitud({
        mascotas: [
          { especie: 'perro', tamano: TamanoPerro.GRANDE },
          { especie: 'gato', tamano: TamanoPerro.MINI },
        ],
        necesidades: [NecesidadTransporte.MEDICACION],
      }),
      contexto(),
    );
    expect(resultado.total).toBe(55 + 8 + 10 + 5);
  });

  it('debería aplicar urgencia y pedir aceptación con el plazo corto', () => {
    const resultado = cotizarTransporte(
      tarifa({ suplementos: { urgente: 25 } }),
      solicitud({ tipoServicio: TipoServicioTransporte.URGENTE, modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE }),
      contexto({ horasHastaRecogida: 0.5 }),
    );
    expect(resultado.total).toBe(80);
    expect(resultado.requiereAceptacion).toBe(true);
    expect(resultado.plazoAceptacionMin).toBe(PLAZO_ACEPTACION_MIN.urgente);
  });

  it('debería rechazar urgencias si la empresa no las hace', () => {
    const resultado = cotizarTransporte(
      tarifa({ aceptaUrgentes: false }),
      solicitud({ tipoServicio: TipoServicioTransporte.URGENTE }),
      contexto(),
    );
    expect(resultado.estado).toBe('no_disponible');
  });

  it('debería cobrar la recogida nocturna sólo con hora concreta de noche', () => {
    const nocturna = cotizarTransporte(tarifa({ suplementos: { nocturno: 15 } }), solicitud({ hora: '23:00' }), contexto());
    const flexible = cotizarTransporte(
      tarifa({ suplementos: { nocturno: 15 } }),
      solicitud({ modoHorario: ModoHorarioTransporte.FLEXIBLE, franja: FranjaTransporte.TARDE }),
      contexto(),
    );
    expect(nocturna.total).toBe(70);
    expect(flexible.total).toBe(55);
    expect(flexible.requiereAceptacion).toBe(true);
  });

  it('debería aplicar larga distancia a partir del umbral', () => {
    const resultado = cotizarTransporte(
      tarifa({ suplementos: { largaDistanciaDesdeKm: 60, largaDistancia: 12 } }), solicitud(), contexto(),
    );
    expect(resultado.total).toBe(67);
  });

  it('debería respetar la antelación mínima', () => {
    const resultado = cotizarTransporte(tarifa({ antelacionMinimaHoras: 72 }), solicitud(), contexto());
    expect(resultado.estado).toBe('no_disponible');
  });

  it('debería rechazar una recogida en el pasado', () => {
    expect(cotizarTransporte(tarifa(), solicitud(), contexto({ horasHastaRecogida: -1 })).estado).toBe('no_disponible');
  });

  it('debería pasar a presupuesto los viajes internacionales si la empresa lo pide', () => {
    const resultado = cotizarTransporte(
      tarifa({ reglasPresupuesto: { internacional: true } }), solicitud(), contexto({ paisDestino: 'Francia' }),
    );
    expect(resultado.estado).toBe('presupuesto');
  });

  it('debería pasar a presupuesto las necesidades especiales y las especies exóticas si la empresa lo pide', () => {
    const reglas = tarifa({
      especiesAceptadas: ['perro', 'reptil'],
      reglasPresupuesto: { necesidadesEspeciales: true, especiesExoticas: true },
    });
    expect(cotizarTransporte(reglas, solicitud({ necesidades: [NecesidadTransporte.MOVILIDAD_REDUCIDA] }), contexto()).estado)
      .toBe('presupuesto');
    expect(cotizarTransporte(reglas, solicitud({ mascotas: [{ especie: 'reptil', tamano: TamanoPerro.MINI }] }), contexto()).estado)
      .toBe('presupuesto');
  });

  it('debería pasar a presupuesto por número de mascotas o kilómetros', () => {
    const reglas = tarifa({ reglasPresupuesto: { masDeMascotas: 1, masDeKm: 50 } });
    expect(cotizarTransporte(reglas, solicitud(), contexto()).estado).toBe('presupuesto');
    const dos = [{ especie: 'perro', tamano: TamanoPerro.MINI }, { especie: 'perro', tamano: TamanoPerro.MINI }];
    expect(cotizarTransporte(tarifa({ reglasPresupuesto: { masDeMascotas: 1 } }), solicitud({ mascotas: dos }), contexto()).estado)
      .toBe('presupuesto');
  });
});

describe('normalizarTerritorio y normalizarEspecie', () => {
  it('debería comparar provincias sin tildes ni prefijos', () => {
    expect(normalizarTerritorio('Provincia de Castellón/Castelló')).toBe('castellon');
  });

  it('debería traducir especies antiguas y caer en «otro» si no se reconoce', () => {
    expect(normalizarEspecie('Perro')).toBe('perro');
    expect(normalizarEspecie(undefined)).toBe('perro');
    expect(normalizarEspecie('Hurón')).toBe('otro');
  });
});
