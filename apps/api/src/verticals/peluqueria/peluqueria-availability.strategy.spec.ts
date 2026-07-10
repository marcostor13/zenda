import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PeluqueriaAvailabilityStrategy } from './peluqueria-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('PeluqueriaAvailabilityStrategy', () => {
  let strategy: PeluqueriaAvailabilityStrategy;
  let model: jest.Mocked<{ findById: jest.Mock }>;

  const mock = {
    _id: 'p1', vertical: VerticalKey.PELUQUERIA, cuposDisponibles: 6,
    duracionSlotMin: 60, precioBase: 25,
    serviciosGrooming: [
      { nombre: 'Baño completo', precio: 25, duracionMin: 45 },
      { nombre: 'Spa premium', precio: 55, duracionMin: 90 },
    ],
  };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = { findById: jest.fn() };
    mockFindById(mock);
    const ref = await Test.createTestingModule({
      providers: [PeluqueriaAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(PeluqueriaAvailabilityStrategy);
  });

  it('declara el vertical PELUQUERIA', () => {
    expect(strategy.vertical).toBe(VerticalKey.PELUQUERIA);
  });

  it('calcula el precio base × número de perros cuando no se indica servicio', async () => {
    const r = await strategy.checkAvailability('p1', { fechaInicio: new Date(), cantidad: 2 });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(50); // 25 × 2
    expect(r.metadata?.perros).toBe(2);
    expect(r.metadata?.duracionMin).toBe(60);
  });

  it('usa el precio del servicio de grooming cuando se solicita por nombre', async () => {
    const r = await strategy.checkAvailability('p1', {
      fechaInicio: new Date(), cantidad: 1, parametrosExtra: { servicio: 'Spa premium' },
    });
    expect(r.precioCalculado).toBe(55);
    expect(r.metadata?.servicio).toBe('Spa premium');
    expect(r.metadata?.duracionMin).toBe(90);
  });

  it('cae al precio base si el servicio solicitado no existe', async () => {
    const r = await strategy.checkAvailability('p1', {
      fechaInicio: new Date(), parametrosExtra: { servicio: 'Tinte de pelo' },
    });
    expect(r.precioCalculado).toBe(25);
    expect(r.metadata?.servicio).toBeUndefined();
  });

  it('retorna disponible=false si no hay cupos suficientes', async () => {
    mockFindById({ ...mock, cuposDisponibles: 1 });
    const r = await strategy.checkAvailability('p1', { fechaInicio: new Date(), cantidad: 2 });
    expect(r.disponible).toBe(false);
    expect(r.capacidadRestante).toBe(1);
  });

  it('lanza 404 si la peluquería no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });

  it('crea y libera un hold temporal', async () => {
    const hold = await strategy.reserveSlot('p1', { usuarioId: 'u1', fechaInicio: new Date() });
    expect(hold.servicioId).toBe('p1');
    expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
  });
});
