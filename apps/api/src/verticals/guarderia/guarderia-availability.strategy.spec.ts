import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GuarderiaAvailabilityStrategy } from './guarderia-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('GuarderiaAvailabilityStrategy', () => {
  let strategy: GuarderiaAvailabilityStrategy;
  let model: jest.Mocked<any>;

  const mock = {
    _id: 'g1', vertical: VerticalKey.GUARDERIA, cuposDisponibles: 10,
    rangoEdadMin: 0, rangoEdadMax: 3, modalidad: 'dia', precioDia: 45, precioHora: 8, precioMes: 520,
  };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = {};
    mockFindById(mock);
    const ref = await Test.createTestingModule({
      providers: [GuarderiaAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(GuarderiaAvailabilityStrategy);
  });

  it('declara el vertical GUARDERIA', () => {
    expect(strategy.vertical).toBe(VerticalKey.GUARDERIA);
  });

  it('calcula el precio según la modalidad (día) × número de niños', async () => {
    const r = await strategy.checkAvailability('g1', { fechaInicio: new Date(), cantidad: 2 });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(90); // 45 × 2
    expect(r.metadata?.modalidad).toBe('dia');
  });

  it('retorna disponible=false si la edad del niño está fuera de rango', async () => {
    const r = await strategy.checkAvailability('g1', { fechaInicio: new Date(), parametrosExtra: { edadNino: 8 } });
    expect(r.disponible).toBe(false);
    expect(r.metadata?.motivo).toBe('edad_fuera_de_rango');
  });

  it('retorna disponible=false si no hay cupos suficientes', async () => {
    mockFindById({ ...mock, cuposDisponibles: 1 });
    const r = await strategy.checkAvailability('g1', { fechaInicio: new Date(), cantidad: 3 });
    expect(r.disponible).toBe(false);
  });

  it('lanza 404 si la guardería no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });
});
