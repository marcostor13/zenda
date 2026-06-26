import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VueloAvailabilityStrategy } from './vuelo-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('VueloAvailabilityStrategy', () => {
  let strategy: VueloAvailabilityStrategy;
  let model: jest.Mocked<any>;

  const vueloMock = { _id: 'v1', vertical: VerticalKey.VUELOS, origen: 'MAD', destino: 'BCN', precioAsiento: 80, asientosDisponibles: 10 };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = {};
    mockFindById(vueloMock);
    const ref = await Test.createTestingModule({
      providers: [VueloAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(VueloAvailabilityStrategy);
  });

  it('declara el vertical VUELOS', () => {
    expect(strategy.vertical).toBe(VerticalKey.VUELOS);
  });

  it('calcula el precio como precioAsiento × cantidad de asientos', async () => {
    const r = await strategy.checkAvailability('v1', { fechaInicio: new Date(), cantidad: 3 });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(240);
    expect(r.metadata?.asientos).toBe(3);
  });

  it('retorna disponible=false si no hay asientos suficientes', async () => {
    mockFindById({ ...vueloMock, asientosDisponibles: 2 });
    const r = await strategy.checkAvailability('v1', { fechaInicio: new Date(), cantidad: 5 });
    expect(r.disponible).toBe(false);
  });

  it('lanza 404 si el vuelo no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });
});
