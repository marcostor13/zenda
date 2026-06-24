import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HotelAvailabilityStrategy } from './hotel-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('HotelAvailabilityStrategy', () => {
  let strategy: HotelAvailabilityStrategy;
  let servicioModel: jest.Mocked<any>;

  const hotelMock = {
    _id: 'hotel-1',
    vertical: VerticalKey.HOTELES,
    habitaciones: [{ tipo: 'simple', capacidad: 2, precio: 200, cantidad: 5 }],
  };

  beforeEach(async () => {
    servicioModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(hotelMock),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HotelAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    strategy = module.get<HotelAvailabilityStrategy>(HotelAvailabilityStrategy);
  });

  describe('checkAvailability', () => {
    it('debería retornar disponible=true con precio calculado por noches', async () => {
      const resultado = await strategy.checkAvailability('hotel-1', {
        fechaInicio: new Date('2025-01-10'),
        fechaFin: new Date('2025-01-15'),
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(200 * 5); // 5 noches × S/200
      expect(resultado.metadata?.noches).toBe(5);
    });

    it('debería retornar disponible=false si no hay habitaciones', async () => {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...hotelMock, habitaciones: [] }),
      });

      const resultado = await strategy.checkAvailability('hotel-1', {
        fechaInicio: new Date('2025-01-10'),
        fechaFin: new Date('2025-01-15'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería lanzar DomainException si no se envía fechaFin', async () => {
      await expect(
        strategy.checkAvailability('hotel-1', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 404 si el hotel no existe', async () => {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date(), fechaFin: new Date() }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('reserveSlot', () => {
    it('debería crear un hold con TTL de 15 minutos', async () => {
      const hold = await strategy.reserveSlot('hotel-1', {
        usuarioId: 'user-1',
        fechaInicio: new Date('2025-01-10'),
        fechaFin: new Date('2025-01-15'),
      });

      expect(hold.holdId).toContain('hold-hotel-1');
      expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('releaseSlot', () => {
    it('debería liberar el hold sin lanzar error', async () => {
      const hold = await strategy.reserveSlot('hotel-1', {
        usuarioId: 'user-1',
        fechaInicio: new Date(),
      });

      await expect(strategy.releaseSlot(hold.holdId)).resolves.not.toThrow();
    });
  });
});
