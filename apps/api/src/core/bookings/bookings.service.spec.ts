import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BookingsService } from './bookings.service';
import { Reserva, ReservaDocument } from './reserva.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { AvailabilityStrategy } from '../availability/availability.strategy';
import { CuponesService } from '../cupones/cupones.service';
import { PerrosService } from '../perros/perros.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey, ReservaEstado } from 'shared';

describe('BookingsService', () => {
  let service: BookingsService;
  let reservaModel: jest.Mocked<any>;
  let availabilityRegistry: jest.Mocked<AvailabilityRegistry>;
  let estrategiaMock: jest.Mocked<AvailabilityStrategy>;
  let cuponesService: jest.Mocked<CuponesService>;
  let perrosService: jest.Mocked<PerrosService>;

  const parametrosBase = {
    usuarioId: 'user-1',
    comercioId: 'comercio-1',
    servicioId: 'servicio-1',
    vertical: VerticalKey.ALOJAMIENTO,
    fechaInicio: new Date('2025-01-10'),
    fechaFin: new Date('2025-01-15'),
    cantidad: 1,
  };

  const reservaMock = {
    _id: 'reserva-1',
    codigo: 'RES-ABCD1234',
    estado: ReservaEstado.PENDIENTE,
    usuarioId: { toString: () => 'user-1' },
    comercioId: { toString: () => 'comercio-1' },
    holdId: 'hold-1',
    vertical: VerticalKey.ALOJAMIENTO,
    historialEstados: [],
    save: jest.fn(),
  };

  beforeEach(async () => {
    estrategiaMock = {
      vertical: VerticalKey.ALOJAMIENTO,
      checkAvailability: jest.fn().mockResolvedValue({ disponible: true, precioCalculado: 500 }),
      reserveSlot: jest.fn().mockResolvedValue({ holdId: 'hold-1', servicioId: 'servicio-1', expiraEn: new Date() }),
      releaseSlot: jest.fn().mockResolvedValue(undefined),
    };

    const mockConstructor: any = jest.fn().mockImplementation(() => ({
      ...reservaMock,
      save: jest.fn().mockResolvedValue(reservaMock),
    }));
    mockConstructor.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(reservaMock) });
    mockConstructor.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CONFIRMADA }) });
    mockConstructor.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([reservaMock]),
    });
    mockConstructor.insertMany = jest.fn().mockResolvedValue([]);
    mockConstructor.updateMany = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getModelToken(Reserva.name), useValue: mockConstructor },
        {
          provide: AvailabilityRegistry,
          useValue: { obtener: jest.fn().mockReturnValue(estrategiaMock) },
        },
        {
          provide: CuponesService,
          useValue: { validar: jest.fn(), aplicar: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PerrosService,
          useValue: { obtenerPropio: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    reservaModel = module.get(getModelToken(Reserva.name));
    availabilityRegistry = module.get(AvailabilityRegistry);
    cuponesService = module.get(CuponesService);
    perrosService = module.get(PerrosService);
  });

  describe('crear', () => {
    it('debería crear reserva cuando el servicio está disponible', async () => {
      const resultado = await service.crear(parametrosBase);
      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.any(Object));
      expect(estrategiaMock.reserveSlot).toHaveBeenCalled();
      expect(resultado).toBeTruthy();
    });

    it('debería validar el cupón con el subtotal cuando se indica cuponCodigo', async () => {
      cuponesService.validar.mockResolvedValue({ codigo: 'VERANO', tipo: 'porcentaje', descuento: 50 });
      await service.crear({ ...parametrosBase, cuponCodigo: 'VERANO' });
      expect(cuponesService.validar).toHaveBeenCalledWith('VERANO', VerticalKey.ALOJAMIENTO, 500);
    });

    it('no debería validar cupón si no se indica código', async () => {
      await service.crear(parametrosBase);
      expect(cuponesService.validar).not.toHaveBeenCalled();
    });

    it('debería congelar un snapshot del perro cuando se indica perroId', async () => {
      perrosService.obtenerPropio.mockResolvedValue({ nombre: 'Nala', peso: 3 } as never);

      await service.crear({ ...parametrosBase, perroId: 'perro-1' });

      expect(perrosService.obtenerPropio).toHaveBeenCalledWith('perro-1', 'user-1');
      expect((reservaModel as unknown as jest.Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ perroId: 'perro-1', perroSnapshot: expect.objectContaining({ nombre: 'Nala' }) }),
      );
    });

    it('debería enriquecer parametrosExtra con el tamaño/tipo de pelo del perro (Ficha Inteligente)', async () => {
      perrosService.obtenerPropio.mockResolvedValue({
        nombre: 'Nala', tamano: 'mini', tipoPelo: ['corto'],
      } as never);

      await service.crear({ ...parametrosBase, perroId: 'perro-1', detalle: { servicio: 'Baño' } });

      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.objectContaining({
        parametrosExtra: expect.objectContaining({ servicio: 'Baño', perroTamano: 'mini', perroTipoPelo: ['corto'] }),
      }));
    });

    it('debería enriquecer parametrosExtra con peso/especie/PPP/raza del perro (para hoteles)', async () => {
      perrosService.obtenerPropio.mockResolvedValue({
        nombre: 'Rex', peso: 32, especie: 'perro', esPPP: true, raza: 'Pitbull',
      } as never);

      await service.crear({ ...parametrosBase, perroId: 'perro-1' });

      expect(estrategiaMock.checkAvailability).toHaveBeenCalledWith('servicio-1', expect.objectContaining({
        parametrosExtra: expect.objectContaining({
          perroPeso: 32, perroEspecie: 'perro', perroEsPPP: true, perroRaza: 'Pitbull',
        }),
      }));
    });

    it('debería lanzar DomainException 409 si el servicio no está disponible', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: false });

      await expect(service.crear(parametrosBase)).rejects.toThrow(DomainException);
      try {
        await service.crear(parametrosBase);
      } catch (error) {
        expect((error as DomainException).statusCode).toBe(409);
      }
    });

    describe('recurrencia (docs §4.3: guardería/peluquería/transporte recurrente)', () => {
      it('debería generar una reserva hija por cada ocurrencia del patrón', async () => {
        // Viernes 10/01/2025 → lunes y miércoles hasta el 22/01: 13,15,20,22 = 4 ocurrencias.
        await service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-10'),
          recurrencia: { diasSemana: [1, 3], hora: '09:00', fechaFin: new Date('2025-01-22') },
        });

        expect(reservaModel.insertMany).toHaveBeenCalledTimes(1);
        const hijas = reservaModel.insertMany.mock.calls[0][0];
        expect(hijas).toHaveLength(4);
        expect(hijas[0]).toEqual(expect.objectContaining({
          reservaOrigenId: 'reserva-1', estado: ReservaEstado.PENDIENTE, montoSubtotal: 500,
        }));
      });

      it('no debería llamar a insertMany si no se indica recurrencia', async () => {
        await service.crear(parametrosBase);
        expect(reservaModel.insertMany).not.toHaveBeenCalled();
      });

      it('debería lanzar 400 si fechaFin no es posterior a fechaInicio', async () => {
        await expect(service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-10'),
          recurrencia: { diasSemana: [1], hora: '09:00', fechaFin: new Date('2025-01-05') },
        })).rejects.toThrow(DomainException);
      });

      it('debería lanzar 400 si la recurrencia generaría demasiadas ocurrencias', async () => {
        await expect(service.crear({
          ...parametrosBase,
          fechaInicio: new Date('2025-01-01'),
          recurrencia: { diasSemana: [0, 1, 2, 3, 4, 5, 6], hora: '09:00', fechaFin: new Date('2027-01-01') },
        })).rejects.toThrow(DomainException);
      });

      it('no debería reservar slot ni crear la reserva origen si la recurrencia es inválida (falla rápido)', async () => {
        await expect(service.crear({
          ...parametrosBase,
          recurrencia: { diasSemana: [1], hora: '09:00', fechaFin: new Date('2020-01-01') },
        })).rejects.toThrow(DomainException);
        expect(estrategiaMock.checkAvailability).not.toHaveBeenCalled();
      });
    });
  });

  describe('confirmar', () => {
    it('debería actualizar el estado de la reserva a CONFIRMADA', async () => {
      const resultado = await service.confirmar('reserva-1');
      expect(reservaModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'reserva-1',
        expect.objectContaining({ estado: ReservaEstado.CONFIRMADA }),
        { new: true },
      );
    });

    it('debería lanzar DomainException 404 si la reserva no existe', async () => {
      reservaModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.confirmar('no-existe')).rejects.toThrow(DomainException);
    });

    it('debería confirmar en cascada las reservas hijas de la serie recurrente', async () => {
      await service.confirmar('reserva-1');

      expect(reservaModel.updateMany).toHaveBeenCalledWith(
        { reservaOrigenId: 'reserva-1', estado: ReservaEstado.PENDIENTE },
        { estado: ReservaEstado.CONFIRMADA },
      );
    });
  });

  describe('cancelar', () => {
    it('debería cancelar la reserva y liberar el hold', async () => {
      reservaMock.save.mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CANCELADA });
      await service.cancelar('reserva-1', 'user-1');
      expect(estrategiaMock.releaseSlot).toHaveBeenCalledWith('hold-1');
    });

    it('debería lanzar DomainException 403 si el usuario no es el dueño', async () => {
      await expect(service.cancelar('reserva-1', 'otro-user')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 400 si la reserva ya está cancelada', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CANCELADA }),
      });
      await expect(service.cancelar('reserva-1', 'user-1')).rejects.toThrow(DomainException);
    });
  });

  describe('completar', () => {
    it('debería marcar como completada una reserva confirmada del comercio', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...reservaMock,
          estado: ReservaEstado.CONFIRMADA,
          save: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.COMPLETADA }),
        }),
      });
      const resultado = await service.completar('reserva-1', 'comercio-1');
      expect(resultado.estado).toBe(ReservaEstado.COMPLETADA);
    });

    it('debería lanzar DomainException 403 si la reserva no es del comercio', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.CONFIRMADA }),
      });
      await expect(service.completar('reserva-1', 'otro-comercio')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 400 si la reserva no está confirmada', async () => {
      reservaModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...reservaMock, estado: ReservaEstado.PENDIENTE }),
      });
      await expect(service.completar('reserva-1', 'comercio-1')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 404 si la reserva no existe', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.completar('no-existe', 'comercio-1')).rejects.toThrow(DomainException);
    });
  });

  function ajusteReservaMock(overrides: Record<string, unknown> = {}) {
    const doc: any = {
      comercioId: { toString: () => 'comercio-1' },
      usuarioId: { toString: () => 'user-1' },
      estado: ReservaEstado.CONFIRMADA,
      montoSubtotal: 100,
      comisionMonto: 15,
      montoTotal: 121,
      suplementos: [],
      evidencias: [],
      ...overrides,
    };
    doc.save = jest.fn().mockImplementation(() => Promise.resolve(doc));
    return doc;
  }

  describe('solicitarAjuste', () => {
    it('debería añadir los suplementos, adjuntar evidencia y pasar a AJUSTE_SOLICITADO', async () => {
      const doc = ajusteReservaMock();
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const resultado = await service.solicitarAjuste(
        'reserva-1',
        'comercio-1',
        [{ concepto: 'Nudos severos', monto: 15 }],
        'https://x/foto.jpg',
      );

      expect(resultado.estado).toBe(ReservaEstado.AJUSTE_SOLICITADO);
      expect(resultado.suplementos).toHaveLength(1);
      expect(resultado.evidencias).toHaveLength(1);
      // (100 + 15) * 1.21 = 139.15
      expect(resultado.montoAjustado).toBeCloseTo(139.15);
    });

    it('debería lanzar 403 si la reserva no es del comercio', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(ajusteReservaMock()) });
      await expect(
        service.solicitarAjuste('reserva-1', 'otro-comercio', [{ concepto: 'X', monto: 5 }]),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si la reserva no está confirmada', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.PENDIENTE });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.solicitarAjuste('reserva-1', 'comercio-1', [{ concepto: 'X', monto: 5 }]),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar 400 si no se indica ningún suplemento', async () => {
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(ajusteReservaMock()) });
      await expect(service.solicitarAjuste('reserva-1', 'comercio-1', [])).rejects.toThrow(DomainException);
    });

    it('debería rechazar el ciclo de suplementos en reservas de veterinaria', async () => {
      const doc = ajusteReservaMock({ vertical: VerticalKey.VETERINARIA });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(
        service.solicitarAjuste('reserva-1', 'comercio-1', [{ concepto: 'Analítica', monto: 55 }]),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('confirmarAjuste', () => {
    it('debería recalcular subtotal/comisión y volver a CONFIRMADA', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.AJUSTE_SOLICITADO, montoAjustado: 139.15 });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const resultado = await service.confirmarAjuste('reserva-1');

      expect(resultado.estado).toBe(ReservaEstado.CONFIRMADA);
      expect(resultado.montoTotal).toBe(139.15);
      expect(resultado.montoSubtotal).toBeCloseTo(115);
      expect(resultado.montoAjustado).toBeUndefined();
    });

    it('debería ser idempotente si ya no hay ajuste pendiente', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.CONFIRMADA });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      await service.confirmarAjuste('reserva-1');

      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('rechazarAjuste', () => {
    it('debería cancelar la reserva cuando el cliente rechaza el ajuste', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.AJUSTE_SOLICITADO, montoAjustado: 139.15 });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

      const resultado = await service.rechazarAjuste('reserva-1', 'user-1');

      expect(resultado.estado).toBe(ReservaEstado.CANCELADA);
      expect(resultado.montoAjustado).toBeUndefined();
    });

    it('debería lanzar 400 si no hay ajuste pendiente', async () => {
      const doc = ajusteReservaMock({ estado: ReservaEstado.CONFIRMADA });
      reservaModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });
      await expect(service.rechazarAjuste('reserva-1', 'user-1')).rejects.toThrow(DomainException);
    });
  });

  describe('recordatorios', () => {
    const findConReservas = (reservas: unknown[]) => {
      reservaModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(reservas),
      });
    };

    it('debería sugerir volver a peluquería si hace más del umbral (2 meses)', async () => {
      const hace5meses = new Date();
      hace5meses.setMonth(hace5meses.getMonth() - 5);
      findConReservas([{ vertical: VerticalKey.PELUQUERIA, fechaInicio: hace5meses }]);

      const recordatorios = await service.recordatorios('user-1');

      expect(recordatorios).toHaveLength(1);
      expect(recordatorios[0].vertical).toBe(VerticalKey.PELUQUERIA);
      expect(recordatorios[0].mesesDesde).toBeGreaterThanOrEqual(2);
    });

    it('no debería sugerir nada si el servicio es reciente', async () => {
      const haceUnMes = new Date();
      haceUnMes.setMonth(haceUnMes.getMonth() - 1);
      findConReservas([{ vertical: VerticalKey.PELUQUERIA, fechaInicio: haceUnMes }]);

      expect(await service.recordatorios('user-1')).toHaveLength(0);
    });
  });
});
