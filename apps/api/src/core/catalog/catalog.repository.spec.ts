import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CatalogRepository } from './catalog.repository';
import { Servicio } from './servicio.schema';

describe('CatalogRepository', () => {
  let repository: CatalogRepository;
  let model: { find: jest.Mock; countDocuments: jest.Mock; findById: jest.Mock; estimatedDocumentCount: jest.Mock };

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
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CatalogRepository, { provide: getModelToken(Servicio.name), useValue: model }],
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

  it('debería paginar con skip = (page - 1) * limit', async () => {
    const chain = chainable([]);
    model.find.mockReturnValue(chain);

    await repository.buscar({ page: 3, limit: 10, vertical: 'alojamiento' });

    expect(chain['skip']).toHaveBeenCalledWith(20);
    expect(chain['limit']).toHaveBeenCalledWith(10);
  });
});
