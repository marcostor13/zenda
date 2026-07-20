import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AlojamientoAvailabilityStrategy } from './alojamiento-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('AlojamientoAvailabilityStrategy', () => {
  let strategy: AlojamientoAvailabilityStrategy;
  let servicioModel: { findById: jest.Mock };

  const alojamientoMock = {
    _id: 'alojamiento-1',
    vertical: VerticalKey.ALOJAMIENTO,
    espacios: [{ tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 45, cantidad: 6 }],
  };

  beforeEach(async () => {
    servicioModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(alojamientoMock),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlojamientoAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    strategy = module.get<AlojamientoAvailabilityStrategy>(AlojamientoAvailabilityStrategy);
  });

  describe('checkAvailability', () => {
    it('debería retornar disponible=true con precio calculado por noches y perros', async () => {
      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
        cantidad: 2,
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(45 * 5 * 2); // 5 noches × 45€ × 2 perros
      expect(resultado.metadata?.noches).toBe(5);
      expect(resultado.metadata?.perros).toBe(2);
    });

    it('debería asumir 1 perro cuando no se envía cantidad', async () => {
      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-12'),
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(45 * 2); // 2 noches × 45€ × 1 perro
      expect(resultado.metadata?.perros).toBe(1);
    });

    it('debería retornar disponible=false si no hay espacios', async () => {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...alojamientoMock, espacios: [] }),
      });

      const resultado = await strategy.checkAvailability('alojamiento-1', {
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
      });

      expect(resultado.disponible).toBe(false);
    });

    it('debería lanzar DomainException si no se envía fechaFin', async () => {
      await expect(
        strategy.checkAvailability('alojamiento-1', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 404 si el alojamiento no existe', async () => {
      servicioModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date(), fechaFin: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    describe('selección de espacio por espacioId', () => {
      const mockConDosEspacios = {
        ...alojamientoMock,
        espacios: [
          { id: 'e1', tipo: 'estandar', tamanoMaxPerro: 'grande', precioNoche: 20, cantidad: 3 },
          { id: 'e2', tipo: 'suite', tamanoMaxPerro: 'grande', precioNoche: 60, cantidad: 2 },
        ],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConDosEspacios),
        });
      });

      it('usa el precio del espacio elegido por el cliente, no el primero', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'),
          fechaFin: new Date('2026-01-11'),
          parametrosExtra: { espacioId: 'e2' },
        });
        expect(resultado.precioCalculado).toBe(60);
      });

      it('cae al primer espacio con cupo si no se indica espacioId', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'),
          fechaFin: new Date('2026-01-11'),
        });
        expect(resultado.precioCalculado).toBe(20);
      });
    });

    describe('compatibilidad de tamaño', () => {
      const mockConTamano = {
        ...alojamientoMock,
        espacios: [{ id: 'e1', tipo: 'estandar', tamanoMaxPerro: 'mediano', precioNoche: 20, cantidad: 3 }],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConTamano),
        });
      });

      it('bloquea la reserva si el perro supera el tamaño máximo del espacio', async () => {
        await expect(strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { perroTamano: 'gigante' },
        })).rejects.toThrow(DomainException);
      });

      it('permite la reserva si el perro no supera el tamaño máximo', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { perroTamano: 'pequeno' },
        });
        expect(resultado.disponible).toBe(true);
      });

      it('acepta también el parámetro legacy tamanoPerro (sin Ficha del Perro/perfil de invitado)', async () => {
        await expect(strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { tamanoPerro: 'gigante' },
        })).rejects.toThrow(DomainException);
      });
    });

    describe('compatibilidad social', () => {
      const mockConCompatibilidad = {
        ...alojamientoMock,
        compatibilidadSocialAdmitida: ['cualquiera', 'solo_pequenos'],
      };

      beforeEach(() => {
        servicioModel.findById.mockReturnValue({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockConCompatibilidad),
        });
      });

      it('bloquea la reserva si el perfil social del perro no está admitido', async () => {
        await expect(strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { compatibilidadSocial: 'individual' },
        })).rejects.toThrow(DomainException);
      });

      it('permite la reserva si el perfil social está admitido', async () => {
        const resultado = await strategy.checkAvailability('alojamiento-1', {
          fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-11'),
          parametrosExtra: { compatibilidadSocial: 'solo_pequenos' },
        });
        expect(resultado.disponible).toBe(true);
      });
    });
  });

  describe('reserveSlot', () => {
    it('debería crear un hold con TTL de 15 minutos', async () => {
      const hold = await strategy.reserveSlot('alojamiento-1', {
        usuarioId: 'user-1',
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
      });

      expect(hold.holdId).toContain('hold-alojamiento-1');
      expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('releaseSlot', () => {
    it('debería liberar el hold sin lanzar error', async () => {
      const hold = await strategy.reserveSlot('alojamiento-1', {
        usuarioId: 'user-1',
        fechaInicio: new Date(),
      });

      await expect(strategy.releaseSlot(hold.holdId)).resolves.not.toThrow();
    });
  });
});
