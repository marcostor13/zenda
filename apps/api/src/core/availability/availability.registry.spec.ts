import { AvailabilityRegistry } from './availability.registry';
import { AvailabilityStrategy } from './availability.strategy';
import { VerticalKey } from 'shared';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('AvailabilityRegistry', () => {
  let registry: AvailabilityRegistry;

  const estrategiaMock: AvailabilityStrategy = {
    vertical: VerticalKey.ALOJAMIENTO,
    checkAvailability: jest.fn(),
    reserveSlot: jest.fn(),
    releaseSlot: jest.fn(),
  };

  beforeEach(() => {
    registry = new AvailabilityRegistry();
  });

  it('debería registrar y recuperar una estrategia por vertical', () => {
    registry.registrar(estrategiaMock);
    const resultado = registry.obtener(VerticalKey.ALOJAMIENTO);
    expect(resultado).toBe(estrategiaMock);
  });

  it('debería lanzar DomainException 501 si no hay estrategia para el vertical', () => {
    expect(() => registry.obtener(VerticalKey.TRANSPORTE)).toThrow(DomainException);
    try {
      registry.obtener(VerticalKey.TRANSPORTE);
    } catch (error) {
      expect((error as DomainException).statusCode).toBe(501);
    }
  });

  it('debería reportar correctamente si tiene o no una estrategia', () => {
    expect(registry.tieneEstrategia(VerticalKey.ALOJAMIENTO)).toBe(false);
    registry.registrar(estrategiaMock);
    expect(registry.tieneEstrategia(VerticalKey.ALOJAMIENTO)).toBe(true);
  });
});
