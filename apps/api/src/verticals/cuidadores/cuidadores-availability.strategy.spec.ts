import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CuidadoresAvailabilityStrategy } from './cuidadores-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

interface ServicioModelMock {
  findById: jest.Mock;
}

describe('CuidadoresAvailabilityStrategy', () => {
  let strategy: CuidadoresAvailabilityStrategy;
  let servicioModel: ServicioModelMock;

  const cuidadorMock = {
    _id: 'cuidador-1',
    vertical: VerticalKey.CUIDADORES,
    modalidades: ['paseo', 'visita'],
    precioPaseo: 12,
    precioVisita: 18,
    precioDiaCompleto: 40,
    precioNoche: 25,
    tamanosAdmitidos: [],
    aceptaPPP: false,
    cuposDisponibles: 5,
  };

  const mockFindById = (doc: unknown): void => {
    servicioModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  beforeEach(async () => {
    servicioModel = { findById: jest.fn() };
    mockFindById(cuidadorMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuidadoresAvailabilityStrategy,
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
      ],
    }).compile();

    strategy = module.get<CuidadoresAvailabilityStrategy>(CuidadoresAvailabilityStrategy);
  });

  it('debería declarar el vertical CUIDADORES', () => {
    expect(strategy.vertical).toBe(VerticalKey.CUIDADORES);
  });

  describe('checkAvailability', () => {
    it('debería lanzar DomainException 404 si el servicio no existe', async () => {
      mockFindById(null);

      await expect(
        strategy.checkAvailability('no-existe', { fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });

    it('debería calcular el precio del paseo por defecto', async () => {
      const resultado = await strategy.checkAvailability('cuidador-1', {
        fechaInicio: new Date(),
        cantidad: 1,
        parametrosExtra: { modalidad: 'paseo' },
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(12);
    });

    it('debería calcular el precio de una visita cuando se pide sin modalidad', async () => {
      const resultado = await strategy.checkAvailability('cuidador-1', {
        fechaInicio: new Date(),
      });

      expect(resultado.disponible).toBe(true);
      expect(resultado.precioCalculado).toBe(18);
    });

    it('no debería estar disponible si no quedan cupos', async () => {
      mockFindById({ ...cuidadorMock, cuposDisponibles: 0 });

      const resultado = await strategy.checkAvailability('cuidador-1', { fechaInicio: new Date() });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toEqual({ motivo: 'sin_cupos' });
    });

    it('no debería estar disponible si la modalidad no se ofrece', async () => {
      const resultado = await strategy.checkAvailability('cuidador-1', {
        fechaInicio: new Date(),
        parametrosExtra: { modalidad: 'noche' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toEqual({ motivo: 'modalidad_no_ofrecida' });
    });

    it('no debería estar disponible si el perro no cabe en los tamaños admitidos', async () => {
      mockFindById({ ...cuidadorMock, tamanosAdmitidos: ['mini', 'pequeno'] });

      const resultado = await strategy.checkAvailability('cuidador-1', {
        fechaInicio: new Date(),
        parametrosExtra: { modalidad: 'paseo', perroTamano: 'gigante' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toEqual({ motivo: 'tamano_no_admitido' });
    });

    it('no debería estar disponible si el perro es PPP y no lo acepta', async () => {
      const resultado = await strategy.checkAvailability('cuidador-1', {
        fechaInicio: new Date(),
        parametrosExtra: { modalidad: 'paseo', perroEsPPP: true },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toEqual({ motivo: 'no_acepta_ppp' });
    });

    it('no debería estar disponible si la modalidad ofrecida no tiene precio configurado', async () => {
      mockFindById({ ...cuidadorMock, modalidades: ['paseo'], precioPaseo: undefined });

      const resultado = await strategy.checkAvailability('cuidador-1', {
        fechaInicio: new Date(),
        parametrosExtra: { modalidad: 'paseo' },
      });

      expect(resultado.disponible).toBe(false);
      expect(resultado.metadata).toEqual({ motivo: 'modalidad_sin_precio' });
    });
  });

  describe('reserveSlot', () => {
    it('debería crear un hold cuando hay disponibilidad', async () => {
      const hold = await strategy.reserveSlot('cuidador-1', {
        usuarioId: 'u1', fechaInicio: new Date(), parametrosExtra: { modalidad: 'paseo' },
      });

      expect(hold.holdId).toContain('cui-');
      expect(hold.servicioId).toBe('cuidador-1');
    });

    it('debería lanzar 409 si no hay disponibilidad', async () => {
      mockFindById({ ...cuidadorMock, cuposDisponibles: 0 });

      await expect(
        strategy.reserveSlot('cuidador-1', { usuarioId: 'u1', fechaInicio: new Date() }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('releaseSlot', () => {
    it('debería liberar un hold existente sin lanzar error', async () => {
      const hold = await strategy.reserveSlot('cuidador-1', {
        usuarioId: 'u1', fechaInicio: new Date(), parametrosExtra: { modalidad: 'paseo' },
      });

      await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
    });
  });
});
