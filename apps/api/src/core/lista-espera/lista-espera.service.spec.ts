import { Test, TestingModule } from '@nestjs/testing';
import { ListaEsperaRepository } from './lista-espera.repository';
import { ListaEsperaService } from './lista-espera.service';

describe('ListaEsperaService', () => {
  let service: ListaEsperaService;
  let repository: jest.Mocked<ListaEsperaRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListaEsperaService,
        {
          provide: ListaEsperaRepository,
          useValue: {
            suscribir: jest.fn().mockResolvedValue({ email: 'ana@doogking.com', yaRegistrado: false }),
            listar: jest.fn().mockResolvedValue([]),
            contar: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get(ListaEsperaService);
    repository = module.get(ListaEsperaRepository);
  });

  describe('suscribir', () => {
    it('debería normalizar el email a minúsculas y sin espacios', async () => {
      await service.suscribir({ email: '  Ana@Doogking.COM ' });

      expect(repository.suscribir).toHaveBeenCalledWith('ana@doogking.com', 'proximamente');
    });

    it('debería usar el origen recibido cuando viene informado', async () => {
      await service.suscribir({ email: 'ana@doogking.com', origen: 'instagram' });

      expect(repository.suscribir).toHaveBeenCalledWith('ana@doogking.com', 'instagram');
    });

    it('debería caer al origen por defecto si llega vacío', async () => {
      await service.suscribir({ email: 'ana@doogking.com', origen: '   ' });

      expect(repository.suscribir).toHaveBeenCalledWith('ana@doogking.com', 'proximamente');
    });

    it('debería devolver el resultado del repositorio', async () => {
      const resultado = await service.suscribir({ email: 'ana@doogking.com' });

      expect(resultado).toEqual({ email: 'ana@doogking.com', yaRegistrado: false });
    });
  });

  describe('listar', () => {
    it('debería mapear los documentos a DTO con la fecha en ISO', async () => {
      const createdAt = new Date('2026-07-30T10:24:00.000Z');
      repository.listar.mockResolvedValue([
        { _id: 'id-1', email: 'ana@doogking.com', origen: 'instagram', createdAt },
      ] as never);
      repository.contar.mockResolvedValue(1);

      const resultado = await service.listar();

      expect(resultado).toEqual({
        total: 1,
        items: [
          {
            id: 'id-1',
            email: 'ana@doogking.com',
            origen: 'instagram',
            createdAt: '2026-07-30T10:24:00.000Z',
          },
        ],
      });
    });

    it('debería rellenar el origen por defecto si el documento no lo tiene', async () => {
      repository.listar.mockResolvedValue([
        { _id: 'id-1', email: 'ana@doogking.com', createdAt: new Date() },
      ] as never);

      const { items } = await service.listar();

      expect(items[0].origen).toBe('proximamente');
    });
  });
});
