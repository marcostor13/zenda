import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CatalogRepository } from './catalog.repository';
import { Servicio } from './servicio.schema';
import { Alojamiento } from '../../verticals/alojamiento/alojamiento.schema';
import { Transporte } from '../../verticals/transporte/transporte.schema';
import { Veterinaria } from '../../verticals/veterinaria/veterinaria.schema';
import { Peluqueria } from '../../verticals/peluqueria/peluqueria.schema';
import { Adiestramiento } from '../../verticals/adiestramiento/adiestramiento.schema';

describe('CatalogRepository', () => {
  let repository: CatalogRepository;
  let model: {
    find: jest.Mock; countDocuments: jest.Mock; findById: jest.Mock;
    estimatedDocumentCount: jest.Mock; aggregate: jest.Mock;
  };
  let alojamientoModelCtor: jest.Mock;
  let transporteModelCtor: jest.Mock;

  const chainable = (resultado: unknown) => {
    const chain: Record<string, jest.Mock> = {};
    ['sort', 'skip', 'limit', 'lean'].forEach((m) => (chain[m] = jest.fn(() => chain)));
    chain['exec'] = jest.fn().mockResolvedValue(resultado);
    return chain;
  };

  beforeEach(async () => {
    model = {
      find: jest.fn().mockReturnValue(chainable([])),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      findById: jest.fn().mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(null) }) }),
      estimatedDocumentCount: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    };

    const mockDoc = (datos: Record<string, unknown>) => ({ ...datos, save: jest.fn().mockResolvedValue(datos) });
    alojamientoModelCtor = jest.fn().mockImplementation(mockDoc);
    transporteModelCtor = jest.fn().mockImplementation(mockDoc);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogRepository,
        { provide: getModelToken(Servicio.name), useValue: model },
        { provide: getModelToken(Alojamiento.name), useValue: alojamientoModelCtor },
        { provide: getModelToken(Transporte.name), useValue: transporteModelCtor },
        { provide: getModelToken(Veterinaria.name), useValue: jest.fn().mockImplementation(mockDoc) },
        { provide: getModelToken(Peluqueria.name), useValue: jest.fn().mockImplementation(mockDoc) },
        { provide: getModelToken(Adiestramiento.name), useValue: jest.fn().mockImplementation(mockDoc) },
      ],
    }).compile();

    repository = moduleRef.get(CatalogRepository);
  });

  it('debería filtrar por estado publicado, vertical, ciudad (regex) y rango de precio', async () => {
    await repository.buscar({ vertical: 'alojamiento', ciudad: 'Madrid', precioMin: 100, precioMax: 500, page: 1, limit: 10 });

    const filtro = model.find.mock.calls[0][0];
    expect(filtro.estado).toBe('publicado');
    expect(filtro.vertical).toBe('alojamiento');
    expect(filtro['ubicacion.ciudad']).toBeInstanceOf(RegExp);
    expect(filtro.precioBase).toEqual({ $gte: 100, $lte: 500 });
  });

  it('no debería añadir condiciones de compatibilidad si no se indica perfil de perro', async () => {
    await repository.buscar({ vertical: 'alojamiento', page: 1, limit: 10 });
    const filtro = model.find.mock.calls[0][0];
    expect(filtro.$and).toBeUndefined();
  });

  it('debería filtrar por tamaño, tipo de pelo y excluir temperamentos no admitidos', async () => {
    await repository.buscar({
      vertical: 'peluqueria',
      page: 1,
      limit: 10,
      perfilPerro: { tamano: 'mini' as never, tipoPelo: ['corto' as never], temperamento: 'nervioso' },
    });

    const filtro = model.find.mock.calls[0][0];
    expect(filtro.$and).toHaveLength(3);
    expect(filtro.$and[0].$or).toContainEqual({ 'aptitud.tamanosAdmitidos': 'mini' });
    expect(filtro.$and[1].$or).toContainEqual({ 'aptitud.tipoPeloAdmitido': { $in: ['corto'] } });
    expect(filtro.$and[2]).toEqual({ 'aptitud.temperamentosNoAdmitidos': { $ne: 'nervioso' } });
  });

  it('debería paginar con skip = (page - 1) * limit', async () => {
    const chain = chainable([]);
    model.find.mockReturnValue(chain);

    await repository.buscar({ page: 3, limit: 10, vertical: 'alojamiento' });

    expect(chain['skip']).toHaveBeenCalledWith(20);
    expect(chain['limit']).toHaveBeenCalledWith(10);
  });

  describe('crear', () => {
    it('debería usar el modelo del discriminador correspondiente al vertical', async () => {
      await repository.crear({
        vertical: 'transporte', titulo: 'PetVan', descripcion: 'desc', ciudad: 'Madrid',
        precioBase: 20, imagenes: [], comercioId: '650000000000000000000001',
        extra: { tarifaBase: 15, tarifaKm: 0.9 },
      });

      expect(transporteModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ vertical: 'transporte', tarifaBase: 15, tarifaKm: 0.9, moneda: 'EUR' }),
      );
      expect(alojamientoModelCtor).not.toHaveBeenCalled();
    });

    it('debería persistir los campos extra del vertical en el documento creado', async () => {
      await repository.crear({
        vertical: 'alojamiento', titulo: 'Suite Canina', descripcion: 'desc', ciudad: 'Madrid',
        precioBase: 40, imagenes: [], comercioId: '650000000000000000000001',
        extra: { espacios: [{ tipo: 'estandar', cantidad: 2, precioNoche: 40 }] },
      });

      expect(alojamientoModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ espacios: [{ tipo: 'estandar', cantidad: 2, precioNoche: 40 }] }),
      );
    });
  });

  describe('facetas (PDF 27/07 §3)', () => {
    const facetasCrudas = {
      precios: [
        { _id: { min: 10, max: 30 }, n: 4 },
        { _id: { min: 30, max: 60 }, n: 7 },
      ],
      amenities: [
        { _id: 'Parking', n: 514 },
        { _id: 'Piscina', n: 87 },
      ],
      valoracion: [{ tres: 20, cuatro: 12, cinco: 3 }],
    };

    it('debería devolver histograma de precios, contadores de amenities y de valoración', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([facetasCrudas]) });

      const facetas = await repository.facetas({ vertical: 'alojamiento', ciudad: 'Madrid', page: 1, limit: 1 });

      expect(facetas.precios).toEqual([
        { desde: 10, hasta: 30, n: 4 },
        { desde: 30, hasta: 60, n: 7 },
      ]);
      expect(facetas.amenities).toEqual([
        { valor: 'Parking', n: 514 },
        { valor: 'Piscina', n: 87 },
      ]);
      expect(facetas.valoracion).toEqual([
        { minimo: 3, n: 20 },
        { minimo: 4, n: 12 },
        { minimo: 5, n: 3 },
      ]);
    });

    it('debería ignorar el rango de precio al calcular el histograma', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([facetasCrudas]) });

      await repository.facetas({
        vertical: 'alojamiento', precioMin: 20, precioMax: 40, page: 1, limit: 1,
      });

      // El histograma describe el destino entero, no solo el tramo ya filtrado:
      // si se recortara, el usuario no podría volver a ampliar el rango.
      const [{ $match: filtro }] = model.aggregate.mock.calls[0][0];
      expect(filtro.precioBase).toBeUndefined();
      expect(filtro.vertical).toBe('alojamiento');
    });

    it('debería devolver facetas vacías si la agregación no trae nada', async () => {
      model.aggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      const facetas = await repository.facetas({ vertical: 'alojamiento', page: 1, limit: 1 });

      expect(facetas).toEqual({ precios: [], amenities: [], valoracion: [] });
    });
  });
});
