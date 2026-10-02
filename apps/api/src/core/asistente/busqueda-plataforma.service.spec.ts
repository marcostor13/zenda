import { Test } from '@nestjs/testing';
import { TipoLugar, VerticalKey } from 'shared';
import { CatalogService, ServicioCardDto } from '../catalog/catalog.service';
import { LugaresService } from '../lugares/lugares.service';
import { LugarDocument } from '../lugares/lugar.schema';
import { BusquedaPlataformaService } from './busqueda-plataforma.service';
import { InventarioRepository } from './inventario.repository';

describe('BusquedaPlataformaService', () => {
  let service: BusquedaPlataformaService;
  let catalog: { buscarServicios: jest.Mock };
  let lugares: { buscar: jest.Mock };
  let inventario: jest.Mocked<Pick<InventarioRepository, 'servicios' | 'lugares'>>;

  const card = (parcial: Partial<ServicioCardDto>): ServicioCardDto => ({
    id: 's1', nombre: 'Residencia Patitas', ciudad: 'Valencia', barrio: '', direccion: '',
    estrellas: 3, score: 4.6, scoreLabel: '', numResenas: 8, precioPorNoche: 25,
    imagenes: ['/img/a.jpg'], amenities: [], cancelacionGratis: false, desayunoIncluido: false,
    espaciosDisponibles: 1, paseosIncluidos: false, destacado: false, vertical: 'alojamiento',
    ...parcial,
  });

  const lugar = (parcial: Partial<LugarDocument>): LugarDocument => ({
    _id: 'l1', nombre: 'Playa de Pinedo', slug: 'playa-de-pinedo', tipo: TipoLugar.PLAYA,
    ubicacion: { ciudad: 'Valencia', provincia: 'Valencia' }, fotos: [], ratingPromedio: 0, totalReviews: 0,
    ...parcial,
  } as unknown as LugarDocument);

  const pagina = (items: ServicioCardDto[]) => ({ items, total: items.length, page: 1, totalPages: 1 });

  beforeEach(async () => {
    catalog = { buscarServicios: jest.fn().mockResolvedValue(pagina([card({})])) };
    lugares = { buscar: jest.fn().mockResolvedValue([lugar({})]) };
    inventario = { servicios: jest.fn().mockResolvedValue([]), lugares: jest.fn().mockResolvedValue([]) };

    const modulo = await Test.createTestingModule({
      providers: [
        BusquedaPlataformaService,
        { provide: CatalogService, useValue: catalog },
        { provide: LugaresService, useValue: lugares },
        { provide: InventarioRepository, useValue: inventario },
      ],
    }).compile();
    service = modulo.get(BusquedaPlataformaService);
  });

  describe('servicios', () => {
    it('debería buscar la categoría en la población y devolver tarjetas con su ficha', async () => {
      const r = await service.buscar('Alojamiento en Valencia');

      expect(catalog.buscarServicios).toHaveBeenCalledWith(expect.objectContaining({
        vertical: VerticalKey.ALOJAMIENTO, ciudad: 'Valencia', soloDisponibles: true,
      }));
      expect(r?.descripcion).toBe('Alojamiento canino en Valencia');
      expect(r?.resultados).toEqual([{
        tipo: 'servicio', id: 's1', titulo: 'Residencia Patitas', ciudad: 'Valencia',
        categoria: 'alojamiento', precioDesde: 25, nota: 4.6, numResenas: 8,
        imagen: '/img/a.jpg', ruta: '/alojamiento/s1',
      }]);
      expect(r?.verTodos).toEqual({
        titulo: 'Ver todos los resultados', ruta: '/alojamiento', queryParams: { ciudad: 'Valencia' },
      });
    });

    it('debería mirar el catálogo entero si no hay nada reservable ahora', async () => {
      catalog.buscarServicios
        .mockResolvedValueOnce(pagina([]))
        .mockResolvedValueOnce(pagina([card({ id: 's2', vertical: 'peluqueria' })]));

      const r = await service.buscar('Peluquería canina en Valencia');

      expect(catalog.buscarServicios).toHaveBeenLastCalledWith(expect.objectContaining({ soloDisponibles: false }));
      expect(r?.resultados[0].ruta).toBe('/peluqueria/s2');
    });

    it('no debería poner nota ni precio cuando no los hay', async () => {
      catalog.buscarServicios.mockResolvedValue(pagina([card({ numResenas: 0, precioPorNoche: 0, imagenes: [] })]));

      const r = await service.buscar('veterinario en Valencia');

      expect(r?.resultados[0]).not.toHaveProperty('nota');
      expect(r?.resultados[0]).not.toHaveProperty('precioDesde');
      expect(r?.resultados[0]).not.toHaveProperty('imagen');
    });

    /* Una duda sobre una categoría no es una petición de opciones. */
    it('no debería buscar si se pregunta por la categoría sin pedir opciones', async () => {
      await expect(service.buscar('¿Cuánto cobráis a una peluquería?')).resolves.toBeNull();
      expect(catalog.buscarServicios).not.toHaveBeenCalled();
    });

    it('debería buscar sin población cuando se piden opciones', async () => {
      const r = await service.buscar('Busco un crematorio');

      expect(catalog.buscarServicios).toHaveBeenCalledWith(expect.objectContaining({
        vertical: VerticalKey.FUNERARIOS, ciudad: undefined,
      }));
      expect(r?.verTodos).toEqual({ titulo: 'Ver todos los resultados', ruta: '/funerarios' });
    });
  });

  describe('sitios de Explora', () => {
    it('debería encontrar las playas publicadas y enlazar a su ficha de Explora', async () => {
      const r = await service.buscar('¿Hay playas para perros en Valencia?');

      expect(lugares.buscar).toHaveBeenCalledWith({ tipo: TipoLugar.PLAYA, ciudad: 'Valencia', limit: 4 });
      expect(r?.resultados).toEqual([expect.objectContaining({
        tipo: 'lugar', titulo: 'Playa de Pinedo', categoria: 'playa', ruta: '/explora/playa-de-pinedo',
      })]);
      expect(r?.verTodos).toEqual({
        titulo: 'Ver todos en Explora', ruta: '/explora', queryParams: { tipo: 'playa', ciudad: 'Valencia' },
      });
    });

    it('debería probar con la provincia si en el municipio no hay nada', async () => {
      lugares.buscar.mockResolvedValueOnce([]).mockResolvedValueOnce([lugar({ slug: undefined })]);

      const r = await service.buscar('parques caninos en Castellón');

      expect(lugares.buscar).toHaveBeenLastCalledWith({ tipo: TipoLugar.PARQUE, provincia: 'Castellón', limit: 4 });
      expect(r?.resultados[0].ruta).toBe('/explora/l1');
    });

    it('debería devolver null si la pregunta no va de servicios ni de sitios', async () => {
      await expect(service.buscar('¿Cómo cancelo una reserva?')).resolves.toBeNull();
    });
  });

  describe('inventario', () => {
    it('debería resumir lo publicado por categoría y por tipo de sitio', async () => {
      inventario.servicios.mockResolvedValue([{ clave: 'alojamiento', total: 3, zonas: ['Valencia'] }]);
      inventario.lugares.mockResolvedValue([{ clave: 'playa', total: 14, zonas: ['Valencia', 'Alicante'] }]);

      const texto = await service.inventarioComoTexto();

      expect(texto).toContain('- Alojamiento canino: 3 publicados (sobre todo en Valencia).');
      expect(texto).toContain('- Playa canina: 14 publicados (sobre todo en Valencia, Alicante).');
    });

    it('debería guardarlo un rato para no recontar en cada pregunta', async () => {
      await service.inventarioComoTexto();
      await service.inventarioComoTexto();

      expect(inventario.servicios).toHaveBeenCalledTimes(1);
    });

    it('debería decir que no hay nada si no hay fichas publicadas', async () => {
      const texto = await service.inventarioComoTexto();
      expect(texto).toContain('Ninguno publicado ahora mismo.');
    });

    it('debería devolver vacío si la base no contesta', async () => {
      inventario.servicios.mockRejectedValue(new Error('caída'));
      await expect(service.inventarioComoTexto()).resolves.toBe('');
    });
  });
});
