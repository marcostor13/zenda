import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AlphaRepository } from './alpha.repository';
import { AlphaNivelConfig } from './alpha-nivel.schema';
import { Comercio } from '../comercios/comercio.schema';
import { Servicio } from '../catalog/servicio.schema';
import { ALPHA_NIVELES_DEFAULT } from 'shared';

describe('AlphaRepository', () => {
  let repository: AlphaRepository;
  let mockModel: any;
  let mockComercioModel: any;
  let mockServicioModel: any;

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

    // Modelos del carrusel de ventajas (HU-13.3): sin comercios adheridos, la
    // consulta de servicios ni siquiera se lanza.
    mockComercioModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };
    mockServicioModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlphaRepository,
        { provide: getModelToken(AlphaNivelConfig.name), useValue: mockModel },
        { provide: getModelToken(Comercio.name), useValue: mockComercioModel },
        { provide: getModelToken(Servicio.name), useValue: mockServicioModel },
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
        {
          nivel: 2,
          nombre: 'Alpha 2 personalizado',
          reservasRequeridas: 8,
          descuentoPct: 0.07,
          beneficios: ['Prioridad en campañas'],
          descuentoMaximoEur: null,
          verticalesAplicables: [],
          vigenciaDesde: null,
          vigenciaHasta: null,
        },
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

  describe('listarVentajas (HU-13.3)', () => {
    it('no debería consultar servicios si ningún comercio está adherido', async () => {
      const resultado = await repository.listarVentajas();

      expect(resultado).toEqual([]);
      expect(mockServicioModel.find).not.toHaveBeenCalled();
    });

    it('debería listar los servicios publicados de los comercios adheridos', async () => {
      mockComercioModel.find.mockReturnValue({
        select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 'c1' }, { _id: 'c2' }]),
      });
      mockServicioModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: 's1', titulo: 'Hotel Luna' }]),
      });

      const resultado = await repository.listarVentajas();

      expect(mockComercioModel.find).toHaveBeenCalledWith({ alphaAdherido: true, estado: 'activo' });
      expect(mockServicioModel.find).toHaveBeenCalledWith({
        comercioId: { $in: ['c1', 'c2'] }, estado: 'publicado',
      });
      expect(resultado).toHaveLength(1);
    });
  });
});
