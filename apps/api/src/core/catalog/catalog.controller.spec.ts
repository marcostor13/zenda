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
            obtenerFacetas: jest.fn(), crearServicio: jest.fn(), actualizarServicio: jest.fn(),
            obtenerServicioParaGestion: jest.fn(),
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

  /*
   * Los filtros propios de cada vertical llegan sueltos en el query string: el
   * controlador tiene que separarlos de los comunes sin que el service sepa de
   * verticales. Un fallo aquí filtra de más (resultados que desaparecen) o de
   * menos (filtros que no hacen nada), y en los dos casos en silencio.
   */
  describe('filtros propios del vertical', () => {
    /** Ejecuta una búsqueda con ese query y devuelve los filtros que llegaron al service. */
    const filtrosDe = async (query: Record<string, string>): Promise<Record<string, unknown> | undefined> => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
      await controller.buscar(
        'veterinaria', undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, query,
      );
      return service.buscarServicios.mock.calls.at(-1)![0].filtrosVertical;
    };

    it('debería convertir "true" y "false" en booleanos de verdad', async () => {
      expect(await filtrosDe({ atiendeUrgencias: 'true', aDomicilio: 'false' }))
        .toEqual({ atiendeUrgencias: true, aDomicilio: false });
    });

    it('debería partir en lista los valores separados por comas', async () => {
      expect(await filtrosDe({ especialidades: 'Cirugía,Dermatología' }))
        .toEqual({ especialidades: ['Cirugía', 'Dermatología'] });
    });

    it('debería dejar tal cual un valor suelto', async () => {
      expect(await filtrosDe({ especialidades: 'Cirugía' })).toEqual({ especialidades: 'Cirugía' });
    });

    it('no debería colar los parámetros comunes entre los del vertical', async () => {
      expect(await filtrosDe({ vertical: 'veterinaria', ciudad: 'Madrid', page: '2' })).toBeUndefined();
    });

    /* El buscador manda estos para conservar el contexto, no para filtrar aquí. */
    it('no debería filtrar por el contexto de fechas del buscador', async () => {
      expect(await filtrosDe({ desde: '2026-09-01', hasta: '2026-09-04', perros: '2', hora: '10:00' }))
        .toBeUndefined();
    });

    it('debería ignorar un filtro vacío', async () => {
      expect(await filtrosDe({ especialidades: '' })).toBeUndefined();
    });

    it('debería devolver undefined sin query', async () => {
      expect(await filtrosDe(undefined as unknown as Record<string, string>)).toBeUndefined();
    });
  });

  describe('lista de servicios (amenities)', () => {
    const amenitiesDe = async (amenities?: string): Promise<string[] | undefined> => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
      await controller.buscar(
        'alojamiento', undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, amenities,
      );
      return service.buscarServicios.mock.calls.at(-1)![0].amenities;
    };

    it('debería partir la lista y quitar los espacios sobrantes', async () => {
      expect(await amenitiesDe('Jardín vallado, Paseos diarios')).toEqual(['Jardín vallado', 'Paseos diarios']);
    });

    it.each([
      ['sin parámetro', undefined],
      ['con la cadena vacía', ''],
      ['con solo comas', ',,'],
    ])('no debería filtrar %s', async (_caso, valor) => {
      expect(await amenitiesDe(valor)).toBeUndefined();
    });
  });

  /* Por defecto se descarta lo no reservable; "false" es la única forma de verlo. */
  describe('soloDisponibles', () => {
    const disponiblesDe = async (valor?: string): Promise<boolean | undefined> => {
      service.buscarServicios.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
      await controller.buscar(
        'alojamiento', undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, valor,
      );
      return service.buscarServicios.mock.calls.at(-1)![0].soloDisponibles;
    };

    it('debería dejarlo sin decidir cuando no llega', async () => {
      expect(await disponiblesDe(undefined)).toBeUndefined();
    });

    it('debería mostrar también lo no disponible solo con "false"', async () => {
      expect(await disponiblesDe('false')).toBe(false);
    });

    it.each(['true', 'cualquier-cosa'])('debería descartar lo no disponible con "%s"', async (valor) => {
      expect(await disponiblesDe(valor)).toBe(true);
    });
  });

  describe('facetas', () => {
    it('debería delegar el histograma con el rectángulo del mapa', async () => {
      const facetas = { precios: [], amenities: [], valoracion: [] } as never;
      service.obtenerFacetas.mockResolvedValue(facetas);

      const resultado = await controller.facetas('alojamiento', 'Madrid', '40.3', '-3.8', '40.5', '-3.6');

      expect(service.obtenerFacetas).toHaveBeenCalledWith({
        vertical: 'alojamiento', ciudad: 'Madrid',
        bbox: { swLat: 40.3, swLng: -3.8, neLat: 40.5, neLng: -3.6 },
      });
      expect(resultado).toBe(facetas);
    });

    it('no debería armar rectángulo con una esquina inválida', async () => {
      service.obtenerFacetas.mockResolvedValue({ precios: [], amenities: [], valoracion: [] } as never);

      await controller.facetas('alojamiento', 'Madrid', '40.3', 'no-es-un-numero', '40.5', '-3.6');

      expect(service.obtenerFacetas).toHaveBeenCalledWith(
        expect.objectContaining({ bbox: undefined }),
      );
    });
  });

  describe('gestión del comercio', () => {
    const req = { user: { comercioId: 'com-1' } } as never;

    it('debería crear el servicio contra el comercio del token, no contra uno del body', async () => {
      const creado = { id: 's1' } as never;
      service.crearServicio.mockResolvedValue(creado);

      const resultado = await controller.crear({ titulo: 'Suite' } as never, req);

      expect(service.crearServicio).toHaveBeenCalledWith({ titulo: 'Suite' }, 'com-1');
      expect(resultado).toBe(creado);
    });

    it('debería actualizar solo dentro del comercio del token', async () => {
      service.actualizarServicio.mockResolvedValue({ id: 's1' } as never);

      await controller.actualizar('s1', { titulo: 'Suite XL' } as never, req);

      expect(service.actualizarServicio).toHaveBeenCalledWith('s1', 'com-1', { titulo: 'Suite XL' });
    });

    it('debería pedir la ficha de gestión acotada al comercio del token', async () => {
      service.obtenerServicioParaGestion.mockResolvedValue({ id: 's1' } as never);

      await controller.obtenerParaGestion('s1', req);

      expect(service.obtenerServicioParaGestion).toHaveBeenCalledWith('s1', 'com-1');
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
