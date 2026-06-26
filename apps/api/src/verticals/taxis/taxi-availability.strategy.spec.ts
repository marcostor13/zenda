import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TaxiAvailabilityStrategy } from './taxi-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('TaxiAvailabilityStrategy', () => {
  let strategy: TaxiAvailabilityStrategy;
  let servicioModel: jest.Mocked<any>;

  const taxiMock = {
    _id: 'taxi-1',
    vertical: VerticalKey.TAXIS,
    tipoVehiculo: 'sedan',
    capacidad: 4,
    tarifaBase: 25,
    tarifaKm: 1.2,
    unidadesDisponibles: 8,
  };

  const mockFindById = (doc: unknown) => {
    servicioModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  beforeEach(async () => {
    servicioModel = {};
    mockFindById(taxiMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxiAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    strategy = module.get<TaxiAvailabilityStrategy>(TaxiAvailabilityStrategy);
  });

  it('debería declarar el vertical TAXIS', () => {
    expect(strategy.vertical).toBe(VerticalKey.TAXIS);
  });

  describe('checkAvailability', () => {
    it('debería calcular el precio como tarifaBase + tarifaKm × distancia', async () => {
      const resultado = await strategy.checkAvailability('taxi-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
        parametrosExtra: { distanciaKm: 20 },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(25 + 1.2 * 20); // 49
      expect(resultado.metadata?.distanciaKm).toBe(20);
      expect(resultado.capacidadRestante).toBe(8);
    });

    it('debería usar la distancia por defecto (10 km) si no se indica', async () => {
      const resultado = await strategy.checkAvailability('taxi-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.precioCalculado).toBe(25 + 1.2 * 10); // 37
      expect(resultado.metadata?.distanciaKm).toBe(10);
    });

    it('debería retornar disponible=false si no hay unidades disponibles', async () => {
      mockFindById({ ...taxiMock, unidadesDisponibles: 0 });

      const resultado = await strategy.checkAvailability('taxi-1', {
        fechaInicio: new Date('2026-07-15T10:00:00Z'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería lanzar DomainException 404 si el taxi no existe', async () => {
      mockFindById(null);

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    it('no debería requerir fechaFin (servicio por trayecto, no por noches)', async () => {
      const resultado = await strategy.checkAvailability('taxi-1', { fechaInicio: new Date() });
      expect(resultado.disponible).toBe(true);
    });
  });

  describe('reserveSlot / releaseSlot', () => {
    it('debería crear un hold con id y expiración, y liberarlo sin error', async () => {
      const hold = await strategy.reserveSlot('taxi-1', { usuarioId: 'u1', fechaInicio: new Date() });
      expect(hold.holdId).toContain('taxi-1');
      expect(hold.expiraEn).toBeInstanceOf(Date);
      await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
    });
  });
});
