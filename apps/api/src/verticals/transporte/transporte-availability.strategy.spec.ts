import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TransporteAvailabilityStrategy } from './transporte-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  ConfirmacionEntrega, CotizacionTransporte, ModalidadTransporte, ModoHorarioTransporte, ReservaEstado,
  TamanoPerro, TipoServicioTransporte, VerticalKey,
} from 'shared';
import { TransporteRepository } from './transporte.repository';
import { TransporteCotizadorService } from './transporte-cotizador.service';

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
        { provide: TransporteRepository, useValue: { porId: jest.fn().mockResolvedValue(null) } },
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
      expect(resultado.metadata).toEqual({
        distanciaKm: 25,
        tipoVehiculo: 'van_acondicionada',
        capacidadPerros: 4,
        perros: 3,
        exclusivo: false,
        extras: 0,
      });
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

  describe('checkAvailability — asistente antiguo, capacidad y distancia', () => {
    it('debería contar los perros de detalle.perros aunque la cantidad llegue a 1', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        cantidad: 1,
        parametrosExtra: { perros: 5 },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toMatchObject({ motivo: 'capacidad_insuficiente', perros: 5, capacidadPerros: 4 });
    });

    it('debería respetar el máximo de perros por trayecto si es menor que la capacidad', async () => {
      mockFindById({ ...transporteMock, maxPerrosPorTrayecto: 2 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { perros: 3 },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toContain('2 perro(s)');
    });

    it('debería cobrar al menos la distancia mínima del transportista', async () => {
      mockFindById({ ...transporteMock, distanciaMinimaKm: 20 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 5 },
      });

      expect(resultado.metadata?.distanciaKm).toBe(20);
      expect(resultado.precioCalculado).toBe(12 + 1.2 * 20);
    });

    it('debería duplicar el trayecto y cobrar la espera en ida y vuelta', async () => {
      mockFindById({ ...transporteMock, tarifaEsperaPorHora: 10 });

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 10, tipoTrayecto: 'ida_vuelta', esperaMinutos: 90 },
      });

      expect(resultado.precioCalculado).toBe((12 + 1.2 * 10) * 2 + 15);
      expect(resultado.metadata).toMatchObject({ tipoTrayecto: 'ida_vuelta', esperaMinutos: 90, cargoEspera: 15 });
    });

    it('debería ignorar una espera no válida', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 10, tipoTrayecto: 'ida_vuelta', esperaMinutos: -3 },
      });
      expect(resultado.metadata).toMatchObject({ esperaMinutos: 0, cargoEspera: 0 });
    });
  });

  describe('checkAvailability — flujo de cliente con solicitud', () => {
    const empresa = { _id: 'transporte-1', unidadesDisponibles: 3, capacidadPerros: 4, tarifaBase: 20, tarifaKm: 0.5 };
    const solicitud = {
      tipoServicio: TipoServicioTransporte.SOLO_IDA,
      origen: { texto: 'Castellón', placeId: 'a' },
      destino: { texto: 'Valencia', placeId: 'b' },
      fecha: '2026-10-01',
      modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
      hora: '10:30',
      mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }, { especie: 'gato', tamano: TamanoPerro.MINI }],
      necesidades: [],
      modalidad: ModalidadTransporte.COMPARTIDO,
      preferencias: [],
    };
    const ruta = {
      trayecto: { km: 70, duracionMin: 55, esEstimacion: false },
      origen: { lat: 39.9, lng: -0.05 },
      destino: { lat: 39.4, lng: -0.37 },
    };
    const cotizacion = (extra: Partial<CotizacionTransporte> = {}): CotizacionTransporte => ({
      estado: 'precio', total: 55, desglose: [{ concepto: 'Trayecto', importe: 55 }], requiereAceptacion: false, ...extra,
    });

    beforeEach(() => {
      repo.porId.mockResolvedValue(empresa as never);
      cotizador.cotizarReserva.mockResolvedValue({ cotizacion: cotizacion(), ruta } as never);
    });

    it('debería tomar el precio del cotizador y dejar el desglose y la ruta para la reserva', async () => {
      cotizador.cotizarReserva.mockResolvedValue({
        cotizacion: cotizacion({ requiereAceptacion: true, plazoAceptacionMin: 30 }), ruta,
      } as never);

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date(), parametrosExtra: { solicitud },
      });

      expect(servicioModel.findById).not.toHaveBeenCalled();
      expect(resultado).toMatchObject({ disponible: true, precioCalculado: 55, capacidadRestante: 3 });
      expect(resultado.metadata).toEqual({
        perros: 2,
        requiereAceptacion: true,
        plazoAceptacionMin: 30,
        detalleReserva: {
          desglose: [{ concepto: 'Trayecto', importe: 55 }],
          ruta: { km: 70, duracionMin: 55, origen: { lat: 39.9, lng: -0.05 }, destino: { lat: 39.4, lng: -0.37 } },
        },
      });
    });

    it('debería no fijar ruta en el detalle si el cotizador no la tiene', async () => {
      cotizador.cotizarReserva.mockResolvedValue({ cotizacion: cotizacion(), ruta: null } as never);

      const resultado = await strategy.checkAvailability('transporte-1', { fechaInicio: new Date(), parametrosExtra: { solicitud } });

      expect((resultado.metadata?.['detalleReserva'] as { ruta?: unknown }).ruta).toBeUndefined();
    });

    it('debería rechazar una solicitud mal formada sin cotizar', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date(), parametrosExtra: { solicitud: { ...solicitud, mascotas: 'dos perros' } },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toEqual({ motivo: 'solicitud_invalida' });
      expect(cotizador.cotizarReserva).not.toHaveBeenCalled();
    });

    it('debería rechazar una solicitud que no es un objeto', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', { fechaInicio: new Date(), parametrosExtra: { solicitud: 'x' } });
      expect(resultado.disponible).toBe(false);
    });

    it('debería rechazar datos de entrega mal formados', async () => {
      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date(), parametrosExtra: { solicitud, entrega: { recogida: { quien: 'marciano' } } },
      });
      expect(resultado.metadata).toEqual({ motivo: 'solicitud_invalida' });
    });

    it('debería aceptar datos de entrega bien formados', async () => {
      const entrega = {
        recogida: { quien: 'yo' }, entrega: { quien: 'otra', nombre: 'Ana' },
        confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION,
      };
      const resultado = await strategy.checkAvailability('transporte-1', { fechaInicio: new Date(), parametrosExtra: { solicitud, entrega } });
      expect(resultado.disponible).toBe(true);
    });

    it('debería lanzar 404 si la empresa no existe', async () => {
      repo.porId.mockResolvedValue(null);
      await expect(strategy.checkAvailability('x', { fechaInicio: new Date(), parametrosExtra: { solicitud } }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('debería devolver no disponible con el motivo del cotizador', async () => {
      cotizador.cotizarReserva.mockResolvedValue({
        cotizacion: cotizacion({ estado: 'no_disponible', motivo: 'No cubre ese viaje' }), ruta,
      } as never);

      const resultado = await strategy.checkAvailability('transporte-1', { fechaInicio: new Date(), parametrosExtra: { solicitud } });

      expect(resultado).toEqual({ disponible: false, motivo: 'No cubre ese viaje', metadata: { motivo: 'no_disponible' } });
    });

    it('debería exigir presupuesto si el viaje lo necesita y no hay precio acordado', async () => {
      cotizador.cotizarReserva.mockResolvedValue({
        cotizacion: cotizacion({ estado: 'presupuesto', motivo: undefined, total: 0 }), ruta,
      } as never);

      const resultado = await strategy.checkAvailability('transporte-1', { fechaInicio: new Date(), parametrosExtra: { solicitud } });

      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toBe('Este viaje necesita un presupuesto a medida.');
      expect(resultado.metadata).toEqual({ motivo: 'requiere_presupuesto' });
    });

    it('debería admitir el viaje con presupuesto si llega el precio acordado', async () => {
      cotizador.cotizarReserva.mockResolvedValue({
        cotizacion: cotizacion({ estado: 'presupuesto', motivo: 'Internacional', total: 0 }), ruta,
      } as never);

      const resultado = await strategy.checkAvailability('transporte-1', {
        fechaInicio: new Date(), parametrosExtra: { solicitud, precioAcordado: 240 },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.metadata?.['detalleReserva']).toEqual(expect.objectContaining({
        desglose: [{ concepto: 'Presupuesto aceptado', importe: 240 }],
      }));
    });
  });

  describe('politicaReembolso', () => {
    const ahora = new Date('2026-10-01T08:00:00Z');
    const reserva = (horasAntes: number, extra: Record<string, unknown> = {}) => ({
      servicioId: 'transporte-1',
      estado: ReservaEstado.CONFIRMADA,
      fechaInicio: new Date(ahora.getTime() + horasAntes * 3_600_000),
      seguimiento: [],
      ...extra,
    });

    beforeEach(() => {
      repo.porId.mockResolvedValue({ cancelacion: { gratisHastaHoras: 48, reembolsoTardioPct: 50 } } as never);
    });

    it('debería devolver el 100 % hasta las horas de cancelación gratuita', async () => {
      await expect(strategy.politicaReembolso(reserva(48), ahora)).resolves.toMatchObject({ porcentaje: 100 });
    });

    it('debería devolver el porcentaje tardío pasado ese plazo', async () => {
      const politica = await strategy.politicaReembolso(reserva(10), ahora);
      expect(politica.porcentaje).toBe(50);
      expect(politica.motivo).toContain('48 h');
    });

    it('debería usar la política por defecto (24 h, 0 %) si la empresa no declara una', async () => {
      repo.porId.mockResolvedValue(null);
      await expect(strategy.politicaReembolso(reserva(30), ahora)).resolves.toMatchObject({ porcentaje: 100 });
      await expect(strategy.politicaReembolso(reserva(5), ahora)).resolves.toMatchObject({ porcentaje: 0 });
    });

    it('no debería devolver nada con el viaje en curso', async () => {
      const politica = await strategy.politicaReembolso(reserva(100, { estado: ReservaEstado.EN_CURSO }), ahora);
      expect(politica).toEqual({ porcentaje: 0, motivo: 'El viaje ya ha empezado.' });
    });

    it('no debería devolver nada si ya se marcó algún hito', async () => {
      const politica = await strategy.politicaReembolso(reserva(100, { seguimiento: [{ hito: 'asignado' }] }), ahora);
      expect(politica.porcentaje).toBe(0);
      expect(repo.porId).not.toHaveBeenCalled();
    });
  });

  describe('validarHito', () => {
    const reserva = (entrega?: Record<string, unknown>) => ({
      servicioId: 'transporte-1', estado: ReservaEstado.CONFIRMADA, fechaInicio: new Date(),
      detalle: entrega ? { entrega } : {},
    });

    it('debería rechazar con 400 un hito que no existe', () => {
      expect(() => strategy.validarHito(reserva(), 'teletransportada')).toThrow(DomainException);
      try {
        strategy.validarHito(reserva(), 'teletransportada');
      } catch (error) {
        expect((error as DomainException).statusCode).toBe(400);
      }
    });

    it('debería aceptar el hito antiguo en_ruta', () => {
      expect(() => strategy.validarHito(reserva(), 'en_ruta')).not.toThrow();
    });

    it('debería exigir foto en la entrega si el cliente la pidió', () => {
      const conFoto = reserva({ confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION_FOTO });
      expect(() => strategy.validarHito(conFoto, 'entregada')).toThrow('foto');
      expect(() => strategy.validarHito(conFoto, 'entregada', 'https://cdn/f.jpg')).not.toThrow();
    });

    it('no debería exigir foto si el cliente sólo pidió notificación', () => {
      const soloAviso = reserva({ confirmacionEntrega: ConfirmacionEntrega.NOTIFICACION });
      expect(() => strategy.validarHito(soloAviso, 'entregada')).not.toThrow();
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
