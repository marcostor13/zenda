import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { HotelesAvailabilityStrategy } from './hoteles-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('HotelesAvailabilityStrategy', () => {
  let strategy: HotelesAvailabilityStrategy;
  let model: jest.Mocked<{ findById: jest.Mock }>;

  const mock = {
    _id: 'h1', vertical: VerticalKey.HOTELES, precioBase: 100,
    admiteMascotas: true, unidadesDisponibles: 5,
    razasRestringidas: 'ninguna', especiesPermitidas: ['perro'],
    suplementoPorTamanoMascota: [
      { tamano: 'pequeno', precioPorNoche: 10 },
      { tamano: 'grande', precioPorNoche: 20 },
    ],
    suplementoSegundaMascotaPorNoche: 5,
  };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = { findById: jest.fn() };
    mockFindById(mock);
    const ref = await Test.createTestingModule({
      providers: [HotelesAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(HotelesAvailabilityStrategy);
  });

  it('declara el vertical HOTELES', () => {
    expect(strategy.vertical).toBe(VerticalKey.HOTELES);
  });

  it('calcula precio = habitación × noches sin suplemento si no se conoce el tamaño', async () => {
    const r = await strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-04'), cantidad: 1,
    });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(300); // 100 × 3 noches
    expect(r.metadata?.noches).toBe(3);
  });

  it('añade el suplemento por tamaño de mascota (docs: 300€ + 30€ = 330€ ejemplo del cliente)', async () => {
    const r = await strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-04'), cantidad: 1,
      parametrosExtra: { perroTamano: 'pequeno' },
    });
    expect(r.precioCalculado).toBe(330); // 300 + (10 × 3 noches)
  });

  it('añade el suplemento de segunda mascota por noche', async () => {
    const r = await strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'), cantidad: 2,
      parametrosExtra: { perroTamano: 'grande' },
    });
    expect(r.precioCalculado).toBe(125); // 100 + 20 (tamaño) + 5 (2ª mascota)
  });

  it('retorna disponible=false si el hotel no admite mascotas', async () => {
    mockFindById({ ...mock, admiteMascotas: false });
    const r = await strategy.checkAvailability('h1', { fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02') });
    expect(r.disponible).toBe(false);
  });

  it('retorna disponible=false si no hay unidades', async () => {
    mockFindById({ ...mock, unidadesDisponibles: 0 });
    const r = await strategy.checkAvailability('h1', { fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02') });
    expect(r.disponible).toBe(false);
  });

  it('lanza 409 si se superan las mascotas máximas por reserva', async () => {
    mockFindById({ ...mock, maxMascotasPorReserva: 1 });
    await expect(strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'), cantidad: 2,
    })).rejects.toThrow(DomainException);
  });

  it('lanza 409 si la mascota supera el peso máximo', async () => {
    mockFindById({ ...mock, pesoMaximoMascotaKg: 10 });
    await expect(strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'),
      parametrosExtra: { perroPeso: 35 },
    })).rejects.toThrow(DomainException);
  });

  it('lanza 409 si la especie de la mascota no está permitida', async () => {
    await expect(strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'),
      parametrosExtra: { perroEspecie: 'gato' },
    })).rejects.toThrow(DomainException);
  });

  it('lanza 409 si restringe PPP y la mascota es PPP', async () => {
    mockFindById({ ...mock, razasRestringidas: 'ppp' });
    await expect(strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'),
      parametrosExtra: { perroEsPPP: true },
    })).rejects.toThrow(DomainException);
  });

  it('lanza 409 si restringe razas gigantes y el perro es gigante', async () => {
    mockFindById({ ...mock, razasRestringidas: 'razas_gigantes' });
    await expect(strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'),
      parametrosExtra: { perroTamano: 'gigante' },
    })).rejects.toThrow(DomainException);
  });

  it('lanza 409 si restringe razas específicas y coincide', async () => {
    mockFindById({ ...mock, razasRestringidas: 'especificas', razasEspecificasRestringidas: ['Pitbull'] });
    await expect(strategy.checkAvailability('h1', {
      fechaInicio: new Date('2026-02-01'), fechaFin: new Date('2026-02-02'),
      parametrosExtra: { perroRaza: 'Pitbull' },
    })).rejects.toThrow(DomainException);
  });

  it('lanza 404 si el hotel no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date(), fechaFin: new Date() })).rejects.toThrow(DomainException);
  });

  it('lanza 400 si no se envía fechaFin', async () => {
    await expect(strategy.checkAvailability('h1', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });

  it('crea y libera un hold temporal', async () => {
    const hold = await strategy.reserveSlot('h1', { usuarioId: 'u1', fechaInicio: new Date() });
    expect(hold.servicioId).toBe('h1');
    expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
  });
});
