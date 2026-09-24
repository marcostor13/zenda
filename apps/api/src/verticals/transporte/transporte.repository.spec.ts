import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';
import { TransporteRepository } from './transporte.repository';

describe('TransporteRepository', () => {
  let repo: TransporteRepository;
  let consulta: { select: jest.Mock; sort: jest.Mock; limit: jest.Mock; lean: jest.Mock; exec: jest.Mock };
  let servicioModel: { find: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    consulta = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    servicioModel = { find: jest.fn().mockReturnValue(consulta), findOne: jest.fn().mockReturnValue(consulta) };

    const moduleRef = await Test.createTestingModule({
      providers: [TransporteRepository, { provide: getModelToken(Servicio.name), useValue: servicioModel }],
    }).compile();

    repo = moduleRef.get(TransporteRepository);
  });

  it('reservables debería filtrar publicados de comercios activos de transporte, por ranking y con tope', async () => {
    await repo.reservables();

    expect(servicioModel.find).toHaveBeenCalledWith({ estado: 'publicado', comercioActivo: true, vertical: VerticalKey.TRANSPORTE });
    expect(consulta.select).toHaveBeenCalledWith(expect.stringContaining('tarifaKm'));
    expect(consulta.sort).toHaveBeenCalledWith({ prioridadRanking: -1 });
    expect(consulta.limit).toHaveBeenCalledWith(300);
    expect(consulta.lean).toHaveBeenCalled();
  });

  it('porId debería buscar el servicio sólo dentro del vertical transporte', async () => {
    const id = new Types.ObjectId().toString();
    const empresa = { _id: id, titulo: 'Fido' };
    consulta.exec.mockResolvedValue(empresa);

    await expect(repo.porId(id)).resolves.toBe(empresa);
    expect(servicioModel.findOne).toHaveBeenCalledWith({ _id: id, vertical: VerticalKey.TRANSPORTE });
    expect(consulta.select).toHaveBeenCalledWith(expect.stringContaining('cancelacion'));
  });

  it('porId debería devolver null sin consultar si el id no es un ObjectId', async () => {
    await expect(repo.porId('no-es-un-id')).resolves.toBeNull();
    expect(servicioModel.findOne).not.toHaveBeenCalled();
  });
});
