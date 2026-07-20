import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { VeterinariaAvailabilityStrategy } from './veterinaria-availability.strategy';
import { Servicio } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey } from 'shared';

describe('VeterinariaAvailabilityStrategy', () => {
  let strategy: VeterinariaAvailabilityStrategy;
  let model: jest.Mocked<{ findById: jest.Mock }>;

  const mock = {
    _id: 'v1', vertical: VerticalKey.VETERINARIA, citasDisponibles: 8,
    duracionCitaMin: 30, precioConsulta: 35,
    serviciosClinicos: [
      { nombre: 'Vacunación', precio: 25, duracionMin: 15 },
      { nombre: 'Limpieza dental', precio: 250, duracionMin: 60 },
    ],
  };
  const mockFindById = (doc: unknown) => {
    model.findById = jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(doc) });
  };

  beforeEach(async () => {
    model = { findById: jest.fn() };
    mockFindById(mock);
    const ref = await Test.createTestingModule({
      providers: [VeterinariaAvailabilityStrategy, { provide: getModelToken(Servicio.name), useValue: model }],
    }).compile();
    strategy = ref.get(VeterinariaAvailabilityStrategy);
  });

  it('declara el vertical VETERINARIA', () => {
    expect(strategy.vertical).toBe(VerticalKey.VETERINARIA);
  });

  it('calcula el precio de la consulta general × número de perros', async () => {
    const r = await strategy.checkAvailability('v1', { fechaInicio: new Date(), cantidad: 2 });
    expect(r.disponible).toBe(true);
    expect(r.precioCalculado).toBe(70); // 35 × 2
    expect(r.metadata?.perros).toBe(2);
    expect(r.metadata?.duracionMin).toBe(30);
  });

  it('usa el precio del servicio clínico cuando se solicita por nombre', async () => {
    const r = await strategy.checkAvailability('v1', {
      fechaInicio: new Date(), cantidad: 1, parametrosExtra: { servicio: 'Limpieza dental' },
    });
    expect(r.precioCalculado).toBe(250);
    expect(r.metadata?.servicio).toBe('Limpieza dental');
    expect(r.metadata?.duracionMin).toBe(60);
  });

  it('cae al precio de consulta si el servicio solicitado no existe', async () => {
    const r = await strategy.checkAvailability('v1', {
      fechaInicio: new Date(), parametrosExtra: { servicio: 'Resonancia' },
    });
    expect(r.precioCalculado).toBe(35);
    expect(r.metadata?.servicio).toBeUndefined();
  });

  it('retorna disponible=false si no hay citas suficientes', async () => {
    mockFindById({ ...mock, citasDisponibles: 1 });
    const r = await strategy.checkAvailability('v1', { fechaInicio: new Date(), cantidad: 3 });
    expect(r.disponible).toBe(false);
    expect(r.capacidadRestante).toBe(1);
  });

  it('lanza 404 si la clínica veterinaria no existe', async () => {
    mockFindById(null);
    await expect(strategy.checkAvailability('x', { fechaInicio: new Date() })).rejects.toThrow(DomainException);
  });

  it('crea y libera un hold temporal', async () => {
    const hold = await strategy.reserveSlot('v1', { usuarioId: 'u1', fechaInicio: new Date() });
    expect(hold.servicioId).toBe('v1');
    expect(hold.expiraEn.getTime()).toBeGreaterThan(Date.now());
    await expect(strategy.releaseSlot(hold.holdId)).resolves.toBeUndefined();
  });

  describe('precio cerrado vs orientativo', () => {
    const mockConPrecios = {
      ...mock,
      serviciosClinicos: [
        { nombre: 'Vacunación', precio: 25, duracionMin: 15, esPrecioCerrado: true },
        { nombre: 'Consulta dermatológica', precio: 40, duracionMin: 30, esPrecioCerrado: false },
      ],
    };

    it('expone esPrecioCerrado=true para servicios de precio cerrado', async () => {
      mockFindById(mockConPrecios);
      const r = await strategy.checkAvailability('v1', {
        fechaInicio: new Date(), parametrosExtra: { servicio: 'Vacunación' },
      });
      expect(r.metadata?.esPrecioCerrado).toBe(true);
    });

    it('expone esPrecioCerrado=false para servicios de precio orientativo', async () => {
      mockFindById(mockConPrecios);
      const r = await strategy.checkAvailability('v1', {
        fechaInicio: new Date(), parametrosExtra: { servicio: 'Consulta dermatológica' },
      });
      expect(r.metadata?.esPrecioCerrado).toBe(false);
    });

    it('expone esPrecioCerrado=false cuando no se solicita un servicio del catálogo (consulta general)', async () => {
      const r = await strategy.checkAvailability('v1', { fechaInicio: new Date() });
      expect(r.metadata?.esPrecioCerrado).toBe(false);
    });
  });

  describe('especies atendidas', () => {
    const mockSoloPerros = { ...mock, especiesAtendidas: ['perro'] };

    it('bloquea si la clínica no atiende la especie de la mascota', async () => {
      mockFindById(mockSoloPerros);
      await expect(strategy.checkAvailability('v1', {
        fechaInicio: new Date(), parametrosExtra: { perroEspecie: 'gato' },
      })).rejects.toThrow(DomainException);
    });

    it('permite la reserva si la especie está atendida', async () => {
      mockFindById(mockSoloPerros);
      const r = await strategy.checkAvailability('v1', {
        fechaInicio: new Date(), parametrosExtra: { perroEspecie: 'perro' },
      });
      expect(r.disponible).toBe(true);
    });

    it('no bloquea si la clínica no declaró especiesAtendidas (comportamiento por defecto)', async () => {
      const r = await strategy.checkAvailability('v1', {
        fechaInicio: new Date(), parametrosExtra: { perroEspecie: 'gato' },
      });
      expect(r.disponible).toBe(true);
    });
  });
});
