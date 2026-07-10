import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BookingsService } from './bookings.service';
import { Reserva, ReservaDocument } from './reserva.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { AvailabilityStrategy } from '../availability/availability.strategy';
import { CuponesService } from '../cupones/cupones.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey, ReservaEstado } from 'shared';

describe('BookingsService', () => {
  let service: BookingsService;
  let reservaModel: jest.Mocked<any>;
  let availabilityRegistry: jest.Mocked<AvailabilityRegistry>;
  let estrategiaMock: jest.Mocked<AvailabilityStrategy>;
  let cuponesService: jest.Mocked<CuponesService>;

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
    holdId: 'hold-1',
    vertical: VerticalKey.ALOJAMIENTO,
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
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    reservaModel = module.get(getModelToken(Reserva.name));
    availabilityRegistry = module.get(AvailabilityRegistry);
    cuponesService = module.get(CuponesService);
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

    it('debería lanzar DomainException 409 si el servicio no está disponible', async () => {
      estrategiaMock.checkAvailability.mockResolvedValue({ disponible: false });

      await expect(service.crear(parametrosBase)).rejects.toThrow(DomainException);
      try {
        await service.crear(parametrosBase);
      } catch (error) {
        expect((error as DomainException).statusCode).toBe(409);
      }
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
});
