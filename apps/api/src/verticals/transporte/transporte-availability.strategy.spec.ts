import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TransporteAvailabilityStrategy } from './transporte-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  ConfirmacionEntrega, CotizacionViaje, HitoViaje, ModalidadTransporte, ModeloPrecio, ModoDisponibilidadTransporte,
  ModoHorarioTransporte, NecesidadTransporte, PLAZO_ACEPTACION_MIN, PoliticaCancelacionTransporte, ReservaEstado,
  TamanoPerro, UnidadCobro, VerticalKey,
} from 'shared';
import { ReservaParaPoliticas } from '../../core/availability/availability.strategy';
import { TransporteCotizable, TransporteRepository } from './transporte.repository';
import { RutaViaje, TransporteCotizadorService } from './transporte-cotizador.service';

interface ServicioModelMock {
  findById: jest.Mock;
}

describe('TransporteAvailabilityStrategy', () => {
  let strategy: TransporteAvailabilityStrategy;
  let servicioModel: ServicioModelMock;
  let repo: jest.Mocked<Pick<TransporteRepository, 'porId'>>;
  let cotizador: jest.Mocked<Pick<TransporteCotizadorService, 'cotizarReserva'>>;

  const transporteMock = {
    _id: 'transporte-1',
    vertical: VerticalKey.TRANSPORTE,
    tipoVehiculo: 'van_acondicionada',
    capacidadPerros: 4,
    tarifaBase: 12,
    tarifaKm: 1.2,
    unidadesDisponibles: 6,
    serviciosAdicionales: [
      { nombre: 'Recogida a domicilio', precio: 15 },
      { nombre: 'Fotos del trayecto', precio: 5 },
    ],
  };

  const mockFindById = (doc: unknown): void => {
    servicioModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  beforeEach(async () => {
    servicioModel = { findById: jest.fn() };
    mockFindById(transporteMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransporteAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: TransporteRepository, useValue: { porId: jest.fn() } },
        { provide: TransporteCotizadorService, useValue: { cotizarReserva: jest.fn() } },
      ],
    }).compile();

    strategy = module.get<TransporteAvailabilityStrategy>(TransporteAvailabilityStrategy);
    repo = module.get(TransporteRepository);
    cotizador = module.get(TransporteCotizadorService);
  });

  it('debería declarar el vertical TRANSPORTE', () => {
    expect(strategy.vertical).toBe(VerticalKey.TRANSPORTE);
  });

  describe('checkAvailability', () => {
    it('debería lanzar DomainException 404 si el servicio no existe', async () => {
      mockFindById(null);

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date() }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería retornar disponible=false si no hay unidades disponibles', async () => {
      mockFindById({ ...transporteMock, unidadesDisponibles: 0 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería retornar disponible=false si unidadesDisponibles no está definido', async () => {
      mockFindById({ ...transporteMock, unidadesDisponibles: undefined });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería retornar disponible=false con motivo si los perros exceden la capacidad', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        cantidad: 5,
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.motivo).toBe('capacidad_insuficiente');
      expect(resultado.metadata?.perros).toBe(5);
    });

    it('debería lanzar DomainException 400 si la distancia es menor o igual a 0', async () => {
      await expect(
        strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date(),
          parametrosExtra: { distanciaKm: 0 },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      await expect(
        strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date(),
          parametrosExtra: { distanciaKm: -5 },
        }),
      ).rejects.toThrow(DomainException);
    });

    it('debería calcular el precio como tarifaBase + tarifaKm × distancia (por trayecto, no por perro)', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        cantidad: 3,
        parametrosExtra: { distanciaKm: 25 },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(12 + 1.2 * 25); // 42 — no se multiplica por perros
      expect(resultado.capacidadRestante).toBe(6);
      // `toMatchObject`: el desglose del motor trae además los kilómetros
      // facturables y la regla aplicada, que antes no existían.
      expect(resultado.metadata).toMatchObject({
        distanciaKm: 25,
        kmFacturables: 25,
        tipoVehiculo: 'van_acondicionada',
        capacidadPerros: 4,
        perros: 3,
        exclusivo: false,
        extras: 0,
        requierePresupuesto: false,
        requiereConfirmacion: false,
        requiereAceptacion: false,
        plazoAceptacionMin: PLAZO_ACEPTACION_MIN.normal,
      });
      expect(resultado.metadata).not.toHaveProperty('tipoTrayecto');
    });

    it('debería anotar la ida y vuelta con su espera en los metadatos', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 10, tipoTrayecto: 'ida_vuelta', esperaMinutos: 45 },
      });

      expect(resultado.metadata).toMatchObject({ tipoTrayecto: 'ida_vuelta', esperaMinutos: 45 });
    });

    it('debería sumar los servicios adicionales elegidos por el cliente', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: {
          distanciaKm: 25,
          extras: ['Recogida a domicilio', 'Fotos del trayecto'],
        },
      });

      expect(resultado.precioCalculado).toBe(12 + 1.2 * 25 + 15 + 5); // 62
      expect(resultado.metadata?.['extras']).toBe(20);
    });

    it('debería ignorar los extras que el transportista no ofrece', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 25, extras: ['Masaje canino'] },
      });

      expect(resultado.precioCalculado).toBe(12 + 1.2 * 25); // 42, sin cargo fantasma
    });

    it('debería usar la distancia por defecto (10 km) si no se indica', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.precioCalculado).toBe(12 + 1.2 * 10); // 24
      expect(resultado.metadata?.distanciaKm).toBe(10);
      expect(resultado.metadata?.perros).toBe(1);
    });

    it('debería usar la distancia por defecto si el valor recibido no es numérico', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 'no-es-un-numero' },
      });

      expect(resultado.metadata?.distanciaKm).toBe(10);
      expect(resultado.precioCalculado).toBe(12 + 1.2 * 10);
    });

    describe('transporte exclusivo', () => {
      it('añade el suplemento de exclusividad configurado por el comercio', async () => {
        mockFindById({ ...transporteMock, precioExclusivo: 20 });
        const resultado = await strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date('2026-07-15T10:00:00Z'),
          parametrosExtra: { distanciaKm: 10, exclusivo: true },
        });
        expect(resultado.precioCalculado).toBe(12 + 1.2 * 10 + 20);
        expect(resultado.metadata?.exclusivo).toBe(true);
      });

      it('no añade suplemento si no se solicita transporte exclusivo', async () => {
        mockFindById({ ...transporteMock, precioExclusivo: 20 });
        const resultado = await strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date('2026-07-15T10:00:00Z'),
          parametrosExtra: { distanciaKm: 10 },
        });
        expect(resultado.precioCalculado).toBe(12 + 1.2 * 10);
      });

      it('no añade suplemento si el comercio no configuró precioExclusivo', async () => {
        const resultado = await strategy.checkAvailability('transporte-1', {
          fechaInicio: new Date('2026-07-15T10:00:00Z'),
          parametrosExtra: { distanciaKm: 10, exclusivo: true },
        });
        expect(resultado.precioCalculado).toBe(12 + 1.2 * 10);
      });
    });
  });

  describe('servicios configurados con el asistente de alta', () => {
    /*
     * Fecha futura: un servicio del alta nueva exige 24 h de antelación por
     * defecto, así que una fecha fija del pasado lo rechazaría todo.
     */
    const dentroDeUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    /** Una empresa con precio cerrado por zona: ni tarifa base ni km. */
    const conReglas = {
      ...transporteMock,
      tarifaBase: undefined,
      tarifaKm: undefined,
      reglasTarifa: [{
        id: 'r1', nombre: 'Castellón ciudad', modelo: ModeloPrecio.ZONA,
        unidadCobro: UnidadCobro.VEHICULO, zonas: ['Castellón'], precioIda: 25,
      }],
      maxMascotasPorReserva: 3,
    };

    it('debería cobrar la regla de tarifa que encaja con el trayecto', async () => {
      mockFindById(conReglas);

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.precioCalculado).toBe(25);
      expect(resultado.metadata?.['reglaAplicada']).toBe('Castellón ciudad');
    });

    /**
     * Sin precio cerrado la reserva no se cae: se ofrece presupuesto. Decir
     * "no disponible" mandaría al cliente de vuelta al listado teniendo una
     * venta delante.
     */
    it('debería seguir disponible y pedir presupuesto si ninguna regla encaja', async () => {
      mockFindById(conReglas);

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 400, municipioOrigen: 'Sevilla' },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.metadata?.['requierePresupuesto']).toBe(true);
      expect(resultado.precioCalculado).toBe(0);
    });

    it('debería rechazar una especie que el transportista no lleva', async () => {
      mockFindById({ ...conReglas, especiesAdmitidas: ['Perro'] });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón', especie: 'Reptil' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('especie_no_admitida');
    });

    it('debería rechazar más acompañantes de los que caben', async () => {
      mockFindById({ ...conReglas, plazasAcompanantes: 1 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón', pasajeros: 3 },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('sin_plazas_acompanante');
    });

    it('debería rechazar una recogida sin la antelación que pide la empresa', async () => {
      mockFindById({
        ...conReglas,
        modoDisponibilidad: ModoDisponibilidadTransporte.CALENDARIO,
        antelacionMinimaHoras: 24,
      });

      const enUnaHora = new Date(Date.now() + 60 * 60 * 1000);
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: enUnaHora,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata?.['motivo']).toBe('antelacion_insuficiente');
    });

    /** Un servicio urgente existe justamente para el aviso de última hora. */
    it('no debería exigir antelación a un servicio bajo demanda', async () => {
      mockFindById({
        ...conReglas,
        modoDisponibilidad: ModoDisponibilidadTransporte.BAJO_DEMANDA,
        antelacionMinimaHoras: 24,
      });

      const enUnaHora = new Date(Date.now() + 60 * 60 * 1000);
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: enUnaHora,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.disponible).toBe(true);
    });

    it('debería marcar que la empresa tiene que confirmar una situación declarada', async () => {
      mockFindById({ ...conReglas, situacionesConfirmacion: ['conducta_reactiva'] });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: {
          distanciaKm: 8, municipioOrigen: 'Castellón', necesidades: ['conducta_reactiva'],
        },
      });

      expect(resultado.metadata?.['requiereConfirmacion']).toBe(true);
      expect(resultado.metadata?.['requiereAceptacion']).toBe(true);
    });

    it('no debería pedir confirmación si las necesidades no vienen como lista', async () => {
      mockFindById({ ...conReglas, situacionesConfirmacion: ['conducta_reactiva'] });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón', necesidades: 'conducta_reactiva' },
      });

      expect(resultado.metadata?.['requiereAceptacion']).toBe(false);
    });

    it('debería dar al transportista el plazo de confirmación de su alta', async () => {
      mockFindById({ ...conReglas, confirmacionHoras: 2 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: dentroDeUnaSemana,
        parametrosExtra: { distanciaKm: 8, municipioOrigen: 'Castellón' },
      });

      expect(resultado.metadata).toMatchObject({ requiereAceptacion: true, plazoAceptacionMin: 120 });
    });
  });

  describe('flujo de cliente por pantallas (detalle.solicitud)', () => {
    const solicitud = {
      tipoServicio: NecesidadTransporte.SOLO_IDA,
      origen: { texto: 'Castellón', placeId: 'a' },
      destino: { texto: 'Valencia', placeId: 'b' },
      fecha: '2030-03-06',
      modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
      hora: '10:30',
      mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }, { especie: 'perro', tamano: TamanoPerro.MINI }],
      necesidades: [],
      modalidad: ModalidadTransporte.EXCLUSIVO,
      preferencias: [],
    };
    const empresa = { _id: 'transporte-1', unidadesDisponibles: 3 } as unknown as TransporteCotizable;
    const ruta: RutaViaje = {
      trayecto: { km: 70, duracionMin: 55, esEstimacion: false },
      origen: { lat: 39.9, lng: -0.05 } as RutaViaje['origen'],
      destino: { lat: 39.4, lng: -0.37 } as RutaViaje['destino'],
    };
    const conPrecio: CotizacionViaje = {
      estado: 'precio', total: 55, desglose: [{ concepto: 'Base más km', importe: 55 }],
      requiereAceptacion: true, plazoAceptacionMin: 30,
    };
    const consulta = (extra: Record<string, unknown> = {}): { fechaInicio: Date; parametrosExtra: Record<string, unknown> } => ({
      fechaInicio: new Date('2030-03-06T09:30:00Z'),
      parametrosExtra: { solicitud, ...extra },
    });

    beforeEach(() => {
      repo.porId.mockResolvedValue(empresa);
      cotizador.cotizarReserva.mockResolvedValue({ cotizacion: conPrecio, ruta });
    });

    it('debería cotizar con el cotizador y dejar desglose y ruta para la reserva', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', consulta());

      expect(cotizador.cotizarReserva).toHaveBeenCalledWith(empresa, expect.objectContaining({ fecha: '2030-03-06' }));
      expect(servicioModel.findById).not.toHaveBeenCalled();
      expect(resultado).toEqual({
        disponible: true,
        capacidadRestante: 3,
        precioCalculado: 55,
        motivo: undefined,
        metadata: {
          perros: 2,
          requierePresupuesto: false,
          motivoPresupuesto: undefined,
          requiereAceptacion: true,
          plazoAceptacionMin: 30,
          detalleReserva: {
            desglose: [{ concepto: 'Base más km', importe: 55 }],
            ruta: { km: 70, duracionMin: 55, origen: { lat: 39.9, lng: -0.05 }, destino: { lat: 39.4, lng: -0.37 } },
          },
        },
      });
    });

    it('debería omitir los extremos de la ruta que no se pudieron geolocalizar', async () => {
      cotizador.cotizarReserva.mockResolvedValue({ cotizacion: conPrecio, ruta: { ...ruta, origen: null, destino: null } });

      const resultado = await strategy.checkAvailability('transporte-1', consulta());

      const detalle = resultado.metadata?.['detalleReserva'] as { ruta: Record<string, unknown> };
      expect(detalle.ruta).toEqual({ km: 70, duracionMin: 55, origen: undefined, destino: undefined });
    });

    it('debería seguir disponible y marcar presupuesto cuando el motor no cierra precio', async () => {
      cotizador.cotizarReserva.mockResolvedValue({
        cotizacion: { estado: 'presupuesto', motivo: 'A medida', total: 0, desglose: [], requiereAceptacion: false },
        ruta: null,
      });

      const resultado = await strategy.checkAvailability('transporte-1', consulta());

      expect(resultado).toMatchObject({ disponible: true, precioCalculado: 0, motivo: 'A medida' });
      expect(resultado.metadata).toMatchObject({
        requierePresupuesto: true, motivoPresupuesto: 'A medida', detalleReserva: { desglose: [], ruta: undefined },
      });
    });

    it('debería no estar disponible con el motivo del cotizador', async () => {
      cotizador.cotizarReserva.mockResolvedValue({
        cotizacion: { estado: 'no_disponible', motivo: 'No cubre ese viaje', total: 0, desglose: [], requiereAceptacion: false },
        ruta,
      });

      const resultado = await strategy.checkAvailability('transporte-1', consulta());

      expect(resultado).toEqual({ disponible: false, motivo: 'No cubre ese viaje', metadata: { motivo: 'no_disponible' } });
    });

    it('debería lanzar 404 si el servicio no existe', async () => {
      repo.porId.mockResolvedValue(null);

      await expect(strategy.checkAvailability('x', consulta())).rejects.toMatchObject({ statusCode: 404 });
    });

    it.each([
      ['la solicitud no es válida', { solicitud: { ...solicitud, mascotas: [] } }],
      ['la solicitud no es un objeto', { solicitud: 'viaje' }],
      ['los datos de entrega no tienen forma', { entrega: 'yo' }],
    ])('debería pedir que vuelva a describir el viaje si %s', async (_caso, extra) => {
      const resultado = await strategy.checkAvailability('transporte-1', consulta(extra));

      expect(resultado).toMatchObject({ disponible: false, metadata: { motivo: 'solicitud_invalida' } });
      expect(cotizador.cotizarReserva).not.toHaveBeenCalled();
    });

    it('debería aceptar datos de entrega bien formados', async () => {
      const entrega = {
        recogida: { quien: 'yo' }, entrega: { quien: 'yo' }, confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION_Y_FOTO,
      };

      const resultado = await strategy.checkAvailability('transporte-1', consulta({ entrega }));

      expect(resultado.disponible).toBe(true);
    });
  });

  describe('politicaReembolso', () => {
    const ahora = new Date('2030-03-01T10:00:00Z');
    const reserva = (extra: Partial<ReservaParaPoliticas> = {}): ReservaParaPoliticas => ({
      servicioId: 'transporte-1',
      estado: ReservaEstado.CONFIRMADA,
      fechaInicio: new Date('2030-03-03T10:00:00Z'),
      ...extra,
    });
    // Con reglas de tarifa: sin ellas el servicio es del alta antigua y usa la política por defecto.
    const conPolitica = (politica: PoliticaCancelacionTransporte): TransporteCotizable => ({
      politicaCancelacionTransporte: politica,
      reglasTarifa: [{ id: 'r1', nombre: 'Fija', modelo: ModeloPrecio.FIJO, unidadCobro: UnidadCobro.VEHICULO, precioIda: 30 }],
    }) as unknown as TransporteCotizable;

    beforeEach(() => {
      repo.porId.mockResolvedValue(conPolitica(PoliticaCancelacionTransporte.ESTANDAR));
    });

    it('no debería devolver nada con el viaje en curso', async () => {
      await expect(strategy.politicaReembolso(reserva({ estado: ReservaEstado.EN_CURSO }), ahora))
        .resolves.toEqual({ porcentaje: 0, motivo: 'El viaje ya ha empezado.' });
    });

    it('no debería devolver nada si el transportista ya marcó algún paso del viaje', async () => {
      const conSeguimiento = reserva({ seguimiento: [{ hito: HitoViaje.DE_CAMINO }] });
      await expect(strategy.politicaReembolso(conSeguimiento, ahora)).resolves.toMatchObject({ porcentaje: 0 });
    });

    it('debería devolver todo si se cancela con la antelación de la política estándar', async () => {
      await expect(strategy.politicaReembolso(reserva(), ahora))
        .resolves.toEqual({ porcentaje: 100, motivo: 'Cancelación gratuita hasta 24 h antes.' });
      expect(repo.porId).toHaveBeenCalledWith('transporte-1');
    });

    it('debería devolver el porcentaje tardío con menos antelación', async () => {
      const esaTarde = reserva({ fechaInicio: new Date('2030-03-01T20:00:00Z') });
      await expect(strategy.politicaReembolso(esaTarde, ahora))
        .resolves.toEqual({ porcentaje: 0, motivo: 'Menos de 24 h antes: se devuelve el 0 %.' });
    });

    it('no debería devolver nada con una tarifa no reembolsable', async () => {
      repo.porId.mockResolvedValue(conPolitica(PoliticaCancelacionTransporte.NO_REEMBOLSABLE));
      await expect(strategy.politicaReembolso(reserva(), ahora))
        .resolves.toEqual({ porcentaje: 0, motivo: 'Tarifa no reembolsable.' });
    });

    it('debería aplicar la política por defecto si el servicio ya no existe', async () => {
      repo.porId.mockResolvedValue(null);
      await expect(strategy.politicaReembolso(reserva(), ahora)).resolves.toMatchObject({ porcentaje: 100 });
    });

    it('debería usar la hora actual si no se le pasa', async () => {
      const lejana = reserva({ fechaInicio: new Date(Date.now() + 72 * 3_600_000) });
      await expect(strategy.politicaReembolso(lejana)).resolves.toMatchObject({ porcentaje: 100 });
    });
  });

  describe('validarHito', () => {
    const reserva = (entrega?: Record<string, unknown>): ReservaParaPoliticas => ({
      servicioId: 'transporte-1',
      estado: ReservaEstado.EN_CURSO,
      fechaInicio: new Date(),
      detalle: entrega ? { entrega } : undefined,
    });
    const conFoto = reserva({ confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION_Y_FOTO });

    it('debería rechazar un paso que no existe', () => {
      expect(() => strategy.validarHito(reserva(), 'teletransportada')).toThrow(DomainException);
    });

    it('debería aceptar el hito antiguo en_ruta', () => {
      expect(() => strategy.validarHito(reserva(), 'en_ruta')).not.toThrow();
    });

    it('debería exigir la foto de la entrega si el cliente la pidió', () => {
      expect(() => strategy.validarHito(conFoto, HitoViaje.ENTREGADA)).toThrow('El cliente pidió una foto de la entrega');
    });

    it('debería aceptar la entrega con foto si el cliente la pidió', () => {
      expect(() => strategy.validarHito(conFoto, HitoViaje.ENTREGADA, 'https://cdn/foto.jpg')).not.toThrow();
    });

    it('no debería exigir foto en otros pasos ni si el cliente no la pidió', () => {
      expect(() => strategy.validarHito(conFoto, HitoViaje.RECOGIDA)).not.toThrow();
      expect(() => strategy.validarHito(reserva(), HitoViaje.ENTREGADA)).not.toThrow();
    });
  });

  describe('reserveSlot / releaseSlot', () => {
    it('debería crear un hold con id y expiración, y liberarlo sin error', async () => {
      const hold = await strategy.reserveSlot('transporte-1', {
        usuarioId: 'u1',
        fechaInicio: new Date(),
      });

      expect(hold.holdId).toContain('transporte-1');
      expect(hold.expiraEn).toBeInstanceOf(Date);
      expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
      await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
    });
  });
});
