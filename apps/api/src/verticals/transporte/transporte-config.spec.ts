import {
  AmbitoTransporte, ModeloPrecio, PlantillaTransporte, RedondeoDistancia, TipoTrayecto,
  UnidadCobro,
} from 'shared';
import { configDeServicio, solicitudDesdeParametros } from './transporte-config';
import { Transporte } from './transporte.schema';

const servicioLegado = {
  tarifaBase: 12,
  tarifaKm: 1.2,
  capacidadPerros: 4,
  zonaCobertura: ['Madrid', 'Toledo'],
} as Partial<Transporte>;

const servicioNuevo = {
  plantilla: PlantillaTransporte.COMPARTIDO,
  reglasTarifa: [{
    id: 'r1', nombre: 'Zona urbana', modelo: ModeloPrecio.ZONA,
    unidadCobro: UnidadCobro.VEHICULO, zonas: ['Castellón'], precioIda: 25,
  }],
  redondeoDistancia: RedondeoDistancia.BLOQUES_5,
} as Partial<Transporte>;

describe('configDeServicio', () => {
  /**
   * Los transportistas dados de alta antes del asistente no tienen reglas:
   * seguir vendiendo con su tarifa base + km es la condición para poder
   * desplegar el motor nuevo sin apagarles la ficha.
   */
  it('debería traducir un servicio antiguo a una regla de tarifa base más km', () => {
    const config = configDeServicio(servicioLegado);

    expect(config.reglasTarifa).toHaveLength(1);
    expect(config.reglasTarifa[0]).toMatchObject({
      modelo: ModeloPrecio.BASE_MAS_KM, tarifaSalida: 12, precioKm: 1.2,
    });
    expect(config.municipiosCobertura).toEqual(['Madrid', 'Toledo']);
  });

  it('debería usar la configuración nueva cuando el servicio ya tiene reglas', () => {
    const config = configDeServicio(servicioNuevo);

    expect(config.plantilla).toBe(PlantillaTransporte.COMPARTIDO);
    expect(config.reglasTarifa[0].modelo).toBe(ModeloPrecio.ZONA);
    expect(config.redondeoDistancia).toBe(RedondeoDistancia.BLOQUES_5);
  });

  /** Un alta a medio hacer no puede quedarse sin los valores que ve la empresa. */
  it('debería rellenar con los valores por defecto lo que el borrador no trae', () => {
    const config = configDeServicio({ reglasTarifa: servicioNuevo.reglasTarifa } as Partial<Transporte>);

    expect(config.esperaIncluidaMin).toBe(30);
    expect(config.cortesiaMinutos).toBe(15);
    expect(config.maxMascotasPorReserva).toBe(3);
  });

  it('debería heredar el equipamiento declarado con el nombre antiguo', () => {
    const config = configDeServicio({
      reglasTarifa: servicioNuevo.reglasTarifa,
      caracteristicasVehiculo: ['climatizacion', 'gps'],
    } as Partial<Transporte>);

    expect(config.equipamientoVehiculo).toEqual(['climatizacion', 'gps']);
  });
});

describe('solicitudDesdeParametros', () => {
  /**
   * El cliente no marca «nocturno»: dice a qué hora lo necesita. Traducirlo es
   * lo que permite cobrar el recargo sin enseñarle el sistema tarifario.
   */
  it('debería deducir el horario nocturno de la hora de recogida', () => {
    const nocturna = solicitudDesdeParametros({ fechaInicio: new Date(2026, 8, 16, 23, 30) }, 10);
    const diurna = solicitudDesdeParametros({ fechaInicio: new Date(2026, 8, 16, 11, 0) }, 10);

    expect(nocturna.nocturno).toBe(true);
    expect(diurna.nocturno).toBe(false);
  });

  it('debería deducir el fin de semana del día de la recogida', () => {
    // 2026-09-19 es sábado; 2026-09-16, miércoles.
    expect(solicitudDesdeParametros({ fechaInicio: new Date(2026, 8, 19, 10, 0) }, 10).finDeSemana).toBe(true);
    expect(solicitudDesdeParametros({ fechaInicio: new Date(2026, 8, 16, 10, 0) }, 10).finDeSemana).toBe(false);
  });

  it('debería marcar el aeropuerto como recargo de ámbito sin preguntarlo', () => {
    const solicitud = solicitudDesdeParametros({
      fechaInicio: new Date(2026, 8, 16, 10, 0),
      parametrosExtra: { ambito: AmbitoTransporte.AEROPUERTO },
    }, 10);

    expect(solicitud.aeropuertoPuerto).toBe(true);
  });

  it('debería leer la ida y vuelta como tipo de trayecto', () => {
    const solicitud = solicitudDesdeParametros({
      fechaInicio: new Date(2026, 8, 16, 10, 0),
      parametrosExtra: { tipoTrayecto: 'ida_vuelta', esperaMinutos: 45 },
    }, 10);

    expect(solicitud.idaVuelta).toBe(true);
    expect(solicitud.tipoTrayecto).toBe(TipoTrayecto.IDA_VUELTA);
    expect(solicitud.esperaMinutos).toBe(45);
  });

  /** Compatibilidad: así pedía la exclusividad el wizard anterior. */
  it('debería traducir «exclusivo: true» al suplemento de servicio exclusivo', () => {
    const solicitud = solicitudDesdeParametros({
      fechaInicio: new Date(2026, 8, 16, 10, 0),
      parametrosExtra: { exclusivo: true },
    }, 10);

    expect(solicitud.suplementosPedidos).toContain('servicio_exclusivo');
  });

  it('debería seguir leyendo los extras con su nombre antiguo', () => {
    const solicitud = solicitudDesdeParametros({
      fechaInicio: new Date(2026, 8, 16, 10, 0),
      parametrosExtra: { extras: ['Recogida a domicilio'] },
    }, 10);

    expect(solicitud.suplementosPedidos).toEqual(['Recogida a domicilio']);
  });

  it('debería caer a la distancia por defecto solo si el valor no es un número', () => {
    expect(solicitudDesdeParametros({
      fechaInicio: new Date(), parametrosExtra: { distanciaKm: 'lejos' },
    }, 10).distanciaKm).toBe(10);

    // Un negativo no se sustituye: tiene que llegar así para rechazarlo con 400.
    expect(solicitudDesdeParametros({
      fechaInicio: new Date(), parametrosExtra: { distanciaKm: -5 },
    }, 10).distanciaKm).toBe(-5);
  });
});
