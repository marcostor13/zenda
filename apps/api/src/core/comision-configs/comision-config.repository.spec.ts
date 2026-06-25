import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ComisionConfigRepository } from './comision-config.repository';
import { ComisionConfig } from './comision-config.schema';
import { VerticalKey, COMISION_PCT_DEFAULT } from 'shared';

describe('ComisionConfigRepository', () => {
  let repository: ComisionConfigRepository;
  let mockModel: any;

  const configHotelesMock = {
    vertical: VerticalKey.HOTELES,
    comisionPct: 0.15,
    stripePct: 0.029,
    stripeFijoEur: 1.1,
    activo: true,
  };

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(null) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(configHotelesMock) }),
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([configHotelesMock]) }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComisionConfigRepository,
        { provide: getModelToken(ComisionConfig.name), useValue: mockModel },
      ],
    }).compile();

    repository = module.get<ComisionConfigRepository>(ComisionConfigRepository);
  });

  describe('obtenerComisionEfectiva', () => {
    it('debería retornar la config del vertical si existe', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(configHotelesMock),
      });

      const resultado = await repository.obtenerComisionEfectiva(VerticalKey.HOTELES);
      expect(resultado.comisionPct).toBe(0.15);
      expect(resultado.vertical).toBe(VerticalKey.HOTELES);
    });

    it('debería usar la config global si no hay config del vertical', async () => {
      const configGlobal = { ...configHotelesMock, vertical: 'global', comisionPct: 0.12 };
      mockModel.findOne
        .mockReturnValueOnce({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(configGlobal) });

      const resultado = await repository.obtenerComisionEfectiva(VerticalKey.TAXIS);
      expect(resultado.comisionPct).toBe(0.12);
    });

    it('debería retornar valores default si no hay ninguna config', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      const resultado = await repository.obtenerComisionEfectiva(VerticalKey.VUELOS);
      expect(resultado.comisionPct).toBe(COMISION_PCT_DEFAULT);
    });
  });

  describe('upsert', () => {
    it('debería crear o actualizar la config del vertical', async () => {
      const resultado = await repository.upsert(VerticalKey.HOTELES, { comisionPct: 0.18 }, 'admin-1');
      expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
        { vertical: VerticalKey.HOTELES },
        expect.objectContaining({ comisionPct: 0.18, actualizadoPor: 'admin-1' }),
        expect.any(Object),
      );
    });
  });
});
