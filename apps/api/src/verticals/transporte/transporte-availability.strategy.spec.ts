import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TransporteAvailabilityStrategy } from './transporte-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('TransporteAvailabilityStrategy', () => {
  let strategy: TransporteAvailabilityStrategy;
  let model: jest.Mocked<any>;

  const mock = { _id: 't1', vertical: VerticalKey.TRANSPORTE, capacidadKg: 1000, tarifaBase: 150, tarifaKg: 0.5, tipoCarga: 'Mudanzas' };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = {};
    mockFindById(mock);
    const ref = await Test.createTestingModule({
      providers: [TransporteAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(TransporteAvailabilityStrategy);
  });

  it('declara el vertical TRANSPORTE', () => {
    expect(strategy.vertical).toBe(VerticalKey.TRANSPORTE);
  });

  it('calcula el precio como tarifaBase + tarifaKg × peso', async () => {
    const r = await strategy.checkAvailability('t1', { fechaInicio: new Date(), parametrosExtra: { pesoKg: 200 } });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(150 + 0.5 * 200); // 250
    expect(r.metadata?.pesoKg).toBe(200);
  });

  it('retorna disponible=false si el peso supera la capacidad', async () => {
    const r = await strategy.checkAvailability('t1', { fechaInicio: new Date(), parametrosExtra: { pesoKg: 5000 } });
    expect(r.disponible).toBe(false);
  });

  it('lanza 404 si el servicio no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });
});
