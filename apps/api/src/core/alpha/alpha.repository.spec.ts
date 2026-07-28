import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AlphaRepository } from './alpha.repository';
import { AlphaNivelConfig } from './alpha-nivel.schema';
import { ALPHA_NIVELES_DEFAULT } from 'shared';

describe('AlphaRepository', () => {
  let repository: AlphaRepository;
  let mockModel: any;

  const nivelGuardado = {
    nivel: 2,
    nombre: 'Alpha 2 personalizado',
    reservasRequeridas: 8,
    descuentoPct: 0.07,
    beneficios: ['Prioridad en campañas'],
    activo: true,
  };

  beforeEach(async () => {
    mockModel = {
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(nivelGuardado) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlphaRepository,
        { provide: getModelToken(AlphaNivelConfig.name), useValue: mockModel },
      ],
    }).compile();

    repository = module.get<AlphaRepository>(AlphaRepository);
  });

  describe('listarNiveles', () => {
    it('debería devolver la escalera de fábrica si el admin no ha configurado nada', async () => {
      const resultado = await repository.listarNiveles();

      expect(resultado).toEqual(ALPHA_NIVELES_DEFAULT);
    });

    it('debería devolver la configuración guardada en BD si existe', async () => {
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([nivelGuardado]),
      });

      const resultado = await repository.listarNiveles();

      expect(resultado).toEqual([
        { nivel: 2, nombre: 'Alpha 2 personalizado', reservasRequeridas: 8, descuentoPct: 0.07, beneficios: ['Prioridad en campañas'] },
      ]);
    });
  });

  describe('upsert', () => {
    it('debería crear o actualizar el nivel indicado', async () => {
      await repository.upsert(2, { nombre: 'Alpha 2 nuevo' }, 'admin-1');

      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { nivel: 2 },
        expect.objectContaining({ nombre: 'Alpha 2 nuevo', actualizadoPor: 'admin-1' }),
        expect.any(Object),
      );
    });
  });
});
