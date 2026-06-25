import { Test } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('CatalogService', () => {
  let service: CatalogService;
  let repo: jest.Mocked<CatalogRepository>;

  const hotelDoc = {
    _id: 'hotel-1',
    comercioId: 'comercio-1',
    titulo: 'Gran Hotel Madrid',
    descripcion: 'Un gran hotel',
    imagenes: ['img1.jpg'],
    ubicacion: { ciudad: 'Madrid' },
    precioBase: 320,
    precioAnterior: 420,
    descuentoPct: 24,
    destacado: true,
    ratingPromedio: 9.2,
    totalReseñas: 2840,
    amenities: ['🌊 Piscina'],
    estrellas: 5,
    barrio: 'Salamanca',
    direccion: 'Calle Serrano 1',
    desayunoIncluido: true,
    cancelacionGratis: true,
    habitacionesDisponibles: 4,
    habitaciones: [
      { id: 'r1', tipo: 'Superior', descripcion: 'desc', capacidad: 2, camas: '1 doble', tamano: 32, precio: 320, amenities: [], imagenes: [], cantidad: 4, disponible: true, cancelacionGratis: true },
    ],
    politicaCancelacion: 'Gratis 24h',
    checkIn: '15:00',
    checkOut: '12:00',
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: CatalogRepository,
          useValue: { buscar: jest.fn(), obtenerPorId: jest.fn(), contarTotal: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CatalogService);
    repo = module.get(CatalogRepository);
  });

  describe('buscarHoteles', () => {
    it('debería mapear los documentos a tarjetas de hotel y calcular la paginación', async () => {
      repo.buscar.mockResolvedValue({ items: [hotelDoc] as never, total: 25 });

      const result = await service.buscarHoteles({ page: 2, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.items[0]).toMatchObject({
        id: 'hotel-1',
        nombre: 'Gran Hotel Madrid',
        ciudad: 'Madrid',
        barrio: 'Salamanca',
        estrellas: 5,
        score: 9.2,
        scoreLabel: 'Excepcional',
        numResenas: 2840,
        precioPorNoche: 320,
        descuentoPct: 24,
      });
    });

    it('debería usar el vertical hoteles por defecto y acotar el límite máximo', async () => {
      repo.buscar.mockResolvedValue({ items: [], total: 0 });

      await service.buscarHoteles({ limit: 999 });

      expect(repo.buscar).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: 'hoteles', limit: 50, page: 1 }),
      );
    });

    it('debería devolver totalPages 1 cuando no hay resultados', async () => {
      repo.buscar.mockResolvedValue({ items: [], total: 0 });

      const result = await service.buscarHoteles({});

      expect(result.totalPages).toBe(1);
      expect(result.items).toEqual([]);
    });
  });

  describe('obtenerHotel', () => {
    it('debería devolver el detalle mapeado con sus habitaciones', async () => {
      repo.obtenerPorId.mockResolvedValue(hotelDoc as never);

      const result = await service.obtenerHotel('hotel-1');

      expect(result.descripcion).toBe('Un gran hotel');
      expect(result.habitaciones).toHaveLength(1);
      expect(result.habitaciones[0].tipo).toBe('Superior');
      expect(result.comercioId).toBe('comercio-1');
    });

    it('debería lanzar DomainException 404 si el hotel no existe', async () => {
      repo.obtenerPorId.mockResolvedValue(null);

      await expect(service.obtenerHotel('no-existe')).rejects.toThrow(DomainException);
    });
  });
});
