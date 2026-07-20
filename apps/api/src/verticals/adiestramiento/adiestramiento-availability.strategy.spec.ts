import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdiestramientoAvailabilityStrategy } from './adiestramiento-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('AdiestramientoAvailabilityStrategy', () => {
  let strategy: AdiestramientoAvailabilityStrategy;
  let model: jest.Mocked<{ findById: jest.Mock }>;

  const mock = {
    _id: 'a1', vertical: VerticalKey.ADIESTRAMIENTO, cuposDisponibles: 10,
    capacidadPorSesion: 6, edadMinimaMeses: 4,
    precioSesion: 40, precioPrograma: 320, sesionesPorPrograma: 10,
  };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = { findById: jest.fn() };
    mockFindById(mock);
    const ref = await Test.createTestingModule({
      providers: [AdiestramientoAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(AdiestramientoAvailabilityStrategy);
  });

  it('declara el vertical ADIESTRAMIENTO', () => {
    expect(strategy.vertical).toBe(VerticalKey.ADIESTRAMIENTO);
  });

  it('calcula el precio por sesión × número de perros por defecto', async () => {
    const r = await strategy.checkAvailability('a1', { fechaInicio: new Date(), cantidad: 2 });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(80); // 40 × 2
    expect(r.metadata?.perros).toBe(2);
    expect(r.metadata?.modalidad).toBe('sesion');
  });

  it('usa el precio del programa cuando se solicita esa modalidad', async () => {
    const r = await strategy.checkAvailability('a1', {
      fechaInicio: new Date(), cantidad: 1, parametrosExtra: { modalidad: 'programa' },
    });
    expect(r.precioCalculado).toBe(320);
    expect(r.metadata?.modalidad).toBe('programa');
  });

  it('cae al precio por sesión si se pide programa pero el servicio no lo ofrece', async () => {
    mockFindById({ ...mock, precioPrograma: undefined });
    const r = await strategy.checkAvailability('a1', {
      fechaInicio: new Date(), parametrosExtra: { modalidad: 'programa' },
    });
    expect(r.precioCalculado).toBe(40);
    expect(r.metadata?.modalidad).toBe('sesion');
  });

  it('retorna disponible=false si no hay cupos suficientes', async () => {
    mockFindById({ ...mock, cuposDisponibles: 1 });
    const r = await strategy.checkAvailability('a1', { fechaInicio: new Date(), cantidad: 3 });
    expect(r.disponible).toBe(false);
    expect(r.metadata?.motivo).toBe('capacidad_insuficiente');
  });

  it('retorna disponible=false si los perros superan la capacidad por sesión', async () => {
    const r = await strategy.checkAvailability('a1', { fechaInicio: new Date(), cantidad: 7 });
    expect(r.disponible).toBe(false);
    expect(r.metadata?.motivo).toBe('capacidad_insuficiente');
  });

  it('retorna disponible=false si el perro no cumple la edad mínima', async () => {
    const r = await strategy.checkAvailability('a1', {
      fechaInicio: new Date(), parametrosExtra: { edadMeses: 2 },
    });
    expect(r.disponible).toBe(false);
    expect(r.metadata?.motivo).toBe('edad_insuficiente');
  });

  it('lanza 404 si el servicio de adiestramiento no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });

  it('crea y libera un hold temporal', async () => {
    const hold = await strategy.reserveSlot('a1', { usuarioId: 'u1', fechaInicio: new Date() });
    expect(hold.servicioId).toBe('a1');
    expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
  });

  describe('catálogo de servicios de adiestramiento', () => {
    const mockConCatalogo = {
      ...mock,
      serviciosAdiestramiento: [
        { nombre: 'Curso de cachorros', tipo: 'curso', precio: 250, maxPerros: 4, edadMinimaMeses: 2, edadMaximaMeses: 6 },
        { nombre: 'Valoración de conducta', tipo: 'valoracion', precio: 45, maxPerros: 1 },
      ],
    };

    it('usa el precio y maxPerros del servicio del catálogo cuando se solicita por nombre', async () => {
      mockFindById(mockConCatalogo);
      const r = await strategy.checkAvailability('a1', {
        fechaInicio: new Date(), cantidad: 1, parametrosExtra: { servicio: 'Valoración de conducta' },
      });
      expect(r.precioCalculado).toBe(45);
      expect(r.metadata?.servicio).toBe('Valoración de conducta');
    });

    it('bloquea si se superan los perros máximos propios del servicio (aunque quepan en la sesión general)', async () => {
      mockFindById(mockConCatalogo);
      const r = await strategy.checkAvailability('a1', {
        fechaInicio: new Date(), cantidad: 2, parametrosExtra: { servicio: 'Valoración de conducta' },
      });
      expect(r.disponible).toBe(false);
    });

    it('valida la edad máxima propia del servicio (ej. curso de cachorros)', async () => {
      mockFindById(mockConCatalogo);
      const r = await strategy.checkAvailability('a1', {
        fechaInicio: new Date(), parametrosExtra: { servicio: 'Curso de cachorros', edadMeses: 10 },
      });
      expect(r.disponible).toBe(false);
      expect(r.metadata?.motivo).toBe('edad_excesiva');
    });

    it('cae a los precios genéricos si el nombre de servicio no existe en el catálogo', async () => {
      mockFindById(mockConCatalogo);
      const r = await strategy.checkAvailability('a1', {
        fechaInicio: new Date(), parametrosExtra: { servicio: 'Servicio inexistente' },
      });
      expect(r.precioCalculado).toBe(40);
    });
  });
});
