import { Test } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: jest.Mocked<CatalogService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            buscarServicios: jest.fn(), obtenerServicio: jest.fn(), obtenerPuntosMapa: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CatalogController);
    service = module.get(CatalogService);
  });

  describe('buscar', () => {
    it('debería convertir los query params numéricos y delegar en el service', async () => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

      await controller.buscar('alojamiento', 'Madrid', '100', '500', '2', '20');

      expect(service.buscarServicios).toHaveBeenCalledWith({
        vertical: 'alojamiento',
        ciudad: 'Madrid',
        precioMin: 100,
        precioMax: 500,
        page: 2,
        limit: 20,
      });
    });

    it('debería pasar undefined para los params numéricos vacíos o inválidos', async () => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

      await controller.buscar(undefined, undefined, '', 'abc', undefined, undefined);

      expect(service.buscarServicios).toHaveBeenCalledWith({
        vertical: undefined,
        ciudad: undefined,
        precioMin: undefined,
        precioMax: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('búsqueda por mapa', () => {
    it('debería agrupar las cuatro esquinas en el rectángulo de búsqueda', async () => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

      await controller.buscar(
        'alojamiento', undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined,
        '40.3', '-3.8', '40.5', '-3.6',
      );

      expect(service.buscarServicios).toHaveBeenCalledWith(
        expect.objectContaining({ bbox: { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 } }),
      );
    });

    it('no debería construir el rectángulo si falta alguna esquina', async () => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

      // Media zona no describe ningún área: filtrar por ella daría resultados
      // sin sentido, así que se descarta entera.
      await controller.buscar(
        'alojamiento', undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined,
        '40.3', '-3.8', undefined, '-3.6',
      );

      expect(service.buscarServicios).toHaveBeenCalledWith(
        expect.objectContaining({ bbox: undefined }),
      );
    });

    it('debería delegar los pines del mapa en el service', async () => {
      const puntos = [{ id: 'a1', titulo: 'Las Rozas', precio: 24, lat: 40.4, lng: -3.7, rating: 4.8 }];
      service.obtenerPuntosMapa.mockResolvedValue(puntos);

      const result = await controller.mapa(
        'alojamiento', 'Madrid', '20', '80', 'perro-1', '40.3', '-3.8', '40.5', '-3.6',
      );

      expect(service.obtenerPuntosMapa).toHaveBeenCalledWith({
        vertical: 'alojamiento',
        ciudad: 'Madrid',
        precioMin: 20,
        precioMax: 80,
        perroId: 'perro-1',
        bbox: { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 },
      });
      expect(result).toBe(puntos);
    });
  });

  describe('obtener', () => {
    it('debería delegar la obtención del detalle en el service', async () => {
      const detalle = { id: 'hotel-1' } as never;
      service.obtenerServicio.mockResolvedValue(detalle);

      const result = await controller.obtener('hotel-1');

      expect(service.obtenerServicio).toHaveBeenCalledWith('hotel-1');
      expect(result).toBe(detalle);
    });
  });
});
