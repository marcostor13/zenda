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
          useValue: { buscarHoteles: jest.fn(), obtenerHotel: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(CatalogController);
    service = module.get(CatalogService);
  });

  describe('buscar', () => {
    it('debería convertir los query params numéricos y delegar en el service', async () => {
      service.buscarHoteles.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

      await controller.buscar('hoteles', 'Madrid', '100', '500', '2', '20');

      expect(service.buscarHoteles).toHaveBeenCalledWith({
        vertical: 'hoteles',
        ciudad: 'Madrid',
        precioMin: 100,
        precioMax: 500,
        page: 2,
        limit: 20,
      });
    });

    it('debería pasar undefined para los params numéricos vacíos o inválidos', async () => {
      service.buscarHoteles.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });

      await controller.buscar(undefined, undefined, '', 'abc', undefined, undefined);

      expect(service.buscarHoteles).toHaveBeenCalledWith({
        vertical: undefined,
        ciudad: undefined,
        precioMin: undefined,
        precioMax: undefined,
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('obtener', () => {
    it('debería delegar la obtención del detalle en el service', async () => {
      const detalle = { id: 'hotel-1' } as never;
      service.obtenerHotel.mockResolvedValue(detalle);

      const result = await controller.obtener('hotel-1');

      expect(service.obtenerHotel).toHaveBeenCalledWith('hotel-1');
      expect(result).toBe(detalle);
    });
  });
});
