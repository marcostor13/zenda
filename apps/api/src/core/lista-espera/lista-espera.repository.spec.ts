import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ListaEsperaRepository } from './lista-espera.repository';
import { ListaEspera } from './lista-espera.schema';

describe('ListaEsperaRepository', () => {
  let repository: ListaEsperaRepository;
  let mockModel: {
    updateOne: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
  };

  beforeEach(async () => {
    mockModel = {
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ upsertedCount: 1 }) }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(3) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListaEsperaRepository,
        { provide: getModelToken(ListaEspera.name), useValue: mockModel },
      ],
    }).compile();

    repository = module.get(ListaEsperaRepository);
  });

  describe('suscribir', () => {
    it('debería dar de alta el email con upsert sin pisar el origen original', async () => {
      await repository.suscribir('ana@doogking.com', 'proximamente');

      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { email: 'ana@doogking.com' },
        { $setOnInsert: { email: 'ana@doogking.com', origen: 'proximamente' } },
        { upsert: true },
      );
    });

    it('debería marcar yaRegistrado en false cuando el alta es nueva', async () => {
      const resultado = await repository.suscribir('ana@doogking.com', 'proximamente');

      expect(resultado).toEqual({ email: 'ana@doogking.com', yaRegistrado: false });
    });

    it('debería marcar yaRegistrado en true cuando el email ya estaba apuntado', async () => {
      mockModel.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ upsertedCount: 0 }) });

      const resultado = await repository.suscribir('ana@doogking.com', 'proximamente');

      expect(resultado.yaRegistrado).toBe(true);
    });
  });

  describe('listar', () => {
    it('debería devolver los últimos apuntados limitados al tope recibido', async () => {
      const cadena = mockModel.find();
      cadena.exec.mockResolvedValue([{ email: 'ana@doogking.com' }]);

      const resultado = await repository.listar(10);

      expect(cadena.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(cadena.limit).toHaveBeenCalledWith(10);
      expect(resultado).toHaveLength(1);
    });
  });

  describe('contar', () => {
    it('debería devolver el total de apuntados', async () => {
      await expect(repository.contar()).resolves.toBe(3);
    });
  });
});
