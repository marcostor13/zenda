import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PerrosService } from './perros.service';
import { Perro } from './perro.schema';
import { PerroHistorial } from './perro-historial.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const PROPIETARIO_ID = new Types.ObjectId().toString();

function perroDocMock(propietarioId: string) {
  return {
    _id: new Types.ObjectId(),
    propietarioId: { toString: () => propietarioId },
    nombre: 'Nala',
    save: jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    deleteOne: jest.fn().mockResolvedValue(undefined),
  };
}

describe('PerrosService', () => {
  let service: PerrosService;
  let perroModel: { create: jest.Mock; find: jest.Mock; findById: jest.Mock };
  let historialModel: { create: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    perroModel = { create: jest.fn(), find: jest.fn(), findById: jest.fn() };
    historialModel = { create: jest.fn(), find: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PerrosService,
        { provide: getModelToken(Perro.name), useValue: perroModel },
        { provide: getModelToken(PerroHistorial.name), useValue: historialModel },
      ],
    }).compile();

    service = moduleRef.get(PerrosService);
  });

  it('debería crear un perro asociado al propietario autenticado', async () => {
    perroModel.create.mockResolvedValue({ _id: '1' });
    await service.crear(PROPIETARIO_ID, { nombre: 'Nala' });
    expect(perroModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Nala', propietarioId: PROPIETARIO_ID }),
    );
  });

  it('debería listar los perros del propietario ordenados por fecha', async () => {
    const exec = jest.fn().mockResolvedValue([{ nombre: 'Nala' }]);
    perroModel.find.mockReturnValue({ sort: () => ({ exec }) });

    const resultado = await service.listarPorPropietario(PROPIETARIO_ID);

    expect(resultado).toEqual([{ nombre: 'Nala' }]);
  });

  it('debería lanzar 404 si el perro no existe', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(service.obtenerPropio('x', PROPIETARIO_ID)).rejects.toThrow(DomainException);
  });

  it('debería lanzar 403 si el perro no pertenece al usuario', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock('otro-usuario')) });
    await expect(service.obtenerPropio('x', PROPIETARIO_ID)).rejects.toThrow(DomainException);
  });

  it('debería actualizar un perro propio', async () => {
    const doc = perroDocMock(PROPIETARIO_ID);
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

    await service.actualizar('x', PROPIETARIO_ID, { nombre: 'Nala 2' });

    expect(doc.save).toHaveBeenCalled();
  });

  it('debería eliminar un perro propio', async () => {
    const doc = perroDocMock(PROPIETARIO_ID);
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });

    await service.eliminar('x', PROPIETARIO_ID);

    expect(doc.deleteOne).toHaveBeenCalled();
  });

  it('debería lanzar 404 al agregar historial de un perro inexistente', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(
      service.agregarHistorial('x', 'comercio-1', { vertical: 'peluqueria' as never, nota: 'Nudos severos' }),
    ).rejects.toThrow(DomainException);
  });

  it('debería agregar una nota al historial del perro', async () => {
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
    historialModel.create.mockResolvedValue({ _id: 'h1' });

    await service.agregarHistorial('x', 'comercio-1', {
      vertical: 'peluqueria' as never,
      nota: 'Requiere deslanado intensivo',
    });

    expect(historialModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ perroId: 'x', comercioId: 'comercio-1' }),
    );
  });

  it('debería listar el historial de un perro propio', async () => {
    const perroId = new Types.ObjectId().toString();
    perroModel.findById.mockReturnValue({ exec: () => Promise.resolve(perroDocMock(PROPIETARIO_ID)) });
    const exec = jest.fn().mockResolvedValue([{ nota: 'Todo bien' }]);
    historialModel.find.mockReturnValue({ sort: () => ({ exec }) });

    const resultado = await service.listarHistorial(perroId, PROPIETARIO_ID);

    expect(resultado).toEqual([{ nota: 'Todo bien' }]);
  });

  describe('obtenerPerfilCompatibilidad', () => {
    it('debería devolver solo tamano/tipoPelo/temperamento, sin exigir propiedad', async () => {
      const select = jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ tamano: 'mini', tipoPelo: ['corto'], temperamento: 'tranquilo' }) }),
      });
      perroModel.findById.mockReturnValue({ select });

      const resultado = await service.obtenerPerfilCompatibilidad('perro-1');

      expect(resultado).toEqual({ tamano: 'mini', tipoPelo: ['corto'], temperamento: 'tranquilo' });
    });

    it('debería devolver null si el perro no existe', async () => {
      const select = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      perroModel.findById.mockReturnValue({ select });

      const resultado = await service.obtenerPerfilCompatibilidad('no-existe');

      expect(resultado).toBeNull();
    });
  });

  describe('obtenerHistoriaCompartida', () => {
    const perroSaludMock = {
      nombre: 'Nala', especie: 'perro', esterilizado: true,
      vacunas: ['rabia'], alergias: ['pollo'], enfermedades: [], medicacion: [],
      certificadosUrl: [], autorizaCompartirHistorial: true,
    };

    it('debería devolver la ficha de salud + historial si el propietario autorizó compartir', async () => {
      const select = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(perroSaludMock) }) });
      perroModel.findById.mockReturnValue({ select });
      historialModel.find.mockReturnValue({ sort: () => ({ lean: () => ({ exec: () => Promise.resolve([{ nota: 'Vacuna anual' }]) }) }) });

      const resultado = await service.obtenerHistoriaCompartida(new Types.ObjectId().toString());

      expect(resultado.nombre).toBe('Nala');
      expect(resultado.alergias).toEqual(['pollo']);
      expect(resultado.historial).toEqual([{ nota: 'Vacuna anual' }]);
    });

    it('debería lanzar 404 si el perro no existe', async () => {
      const select = jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) });
      perroModel.findById.mockReturnValue({ select });

      await expect(service.obtenerHistoriaCompartida('no-existe')).rejects.toThrow(DomainException);
    });

    it('debería lanzar 403 si el propietario no autorizó compartir el historial', async () => {
      const select = jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve({ ...perroSaludMock, autorizaCompartirHistorial: false }) }),
      });
      perroModel.findById.mockReturnValue({ select });

      await expect(service.obtenerHistoriaCompartida('perro-1')).rejects.toThrow(DomainException);
    });
  });
});
