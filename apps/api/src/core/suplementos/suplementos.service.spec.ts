import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SuplementosService } from './suplementos.service';
import { SuplementoConfig } from './suplemento-config.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

const COMERCIO_ID = new Types.ObjectId().toString();

function configDocMock(comercioId: string) {
  return {
    _id: new Types.ObjectId(),
    comercioId: { toString: () => comercioId },
    concepto: 'Nudos severos',
    monto: 15,
    save: jest.fn().mockImplementation(function (this: unknown) {
      return Promise.resolve(this);
    }),
    deleteOne: jest.fn().mockResolvedValue(undefined),
  };
}

describe('SuplementosService', () => {
  let service: SuplementosService;
  let suplementoModel: { create: jest.Mock; find: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    suplementoModel = { create: jest.fn(), find: jest.fn(), findById: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SuplementosService,
        { provide: getModelToken(SuplementoConfig.name), useValue: suplementoModel },
      ],
    }).compile();

    service = moduleRef.get(SuplementosService);
  });

  it('debería crear un suplemento asociado al comercio autenticado', async () => {
    suplementoModel.create.mockResolvedValue({ _id: 's1' });
    await service.crear(COMERCIO_ID, { concepto: 'Nudos severos', monto: 15 });
    expect(suplementoModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ concepto: 'Nudos severos', comercioId: COMERCIO_ID }),
    );
  });

  it('debería listar los suplementos del comercio ordenados por fecha', async () => {
    const exec = jest.fn().mockResolvedValue([{ concepto: 'Nudos severos' }]);
    suplementoModel.find.mockReturnValue({ sort: () => ({ exec }) });
    const resultado = await service.listarPorComercio(COMERCIO_ID);
    expect(resultado).toEqual([{ concepto: 'Nudos severos' }]);
  });

  it('debería lanzar 404 si el suplemento no existe', async () => {
    suplementoModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });
    await expect(service.actualizar('x', COMERCIO_ID, { monto: 20 })).rejects.toThrow(DomainException);
  });

  it('debería lanzar 403 si el suplemento no pertenece al comercio', async () => {
    suplementoModel.findById.mockReturnValue({ exec: () => Promise.resolve(configDocMock('otro-comercio')) });
    await expect(service.actualizar('x', COMERCIO_ID, { monto: 20 })).rejects.toThrow(DomainException);
  });

  it('debería actualizar un suplemento propio', async () => {
    const doc = configDocMock(COMERCIO_ID);
    suplementoModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });
    await service.actualizar('x', COMERCIO_ID, { monto: 20 });
    expect(doc.save).toHaveBeenCalled();
  });

  it('debería eliminar un suplemento propio', async () => {
    const doc = configDocMock(COMERCIO_ID);
    suplementoModel.findById.mockReturnValue({ exec: () => Promise.resolve(doc) });
    await service.eliminar('x', COMERCIO_ID);
    expect(doc.deleteOne).toHaveBeenCalled();
  });
});
