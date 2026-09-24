import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoSolicitudPresupuesto } from 'shared';
import { PresupuestosRepository } from './presupuestos.repository';
import { SolicitudPresupuesto } from './solicitud-presupuesto.schema';

describe('PresupuestosRepository', () => {
  let repo: PresupuestosRepository;
  let consulta: { sort: jest.Mock; limit: jest.Mock; exec: jest.Mock };
  let model: { create: jest.Mock; findById: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    consulta = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    model = {
      create: jest.fn().mockResolvedValue({ codigo: 'PRE-1' }),
      findById: jest.fn().mockReturnValue(consulta),
      find: jest.fn().mockReturnValue(consulta),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PresupuestosRepository, { provide: getModelToken(SolicitudPresupuesto.name), useValue: model }],
    }).compile();

    repo = moduleRef.get(PresupuestosRepository);
  });

  it('crear debería delegar en el modelo', async () => {
    await expect(repo.crear({ codigo: 'PRE-1' })).resolves.toEqual({ codigo: 'PRE-1' });
    expect(model.create).toHaveBeenCalledWith({ codigo: 'PRE-1' });
  });

  it('porId debería buscar por id válido', async () => {
    const id = new Types.ObjectId().toString();
    consulta.exec.mockResolvedValue({ _id: id });

    await expect(repo.porId(id)).resolves.toEqual({ _id: id });
    expect(model.findById).toHaveBeenCalledWith(id);
  });

  it('porId debería devolver null sin consultar con un id inválido', async () => {
    await expect(repo.porId('nada')).resolves.toBeNull();
    expect(model.findById).not.toHaveBeenCalled();
  });

  it('deUsuario debería listar las del cliente, recientes primero y con tope', async () => {
    const usuarioId = new Types.ObjectId().toString();

    await repo.deUsuario(usuarioId);

    expect(model.find).toHaveBeenCalledWith({ usuarioId: new Types.ObjectId(usuarioId) });
    expect(consulta.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(consulta.limit).toHaveBeenCalledWith(100);
  });

  it('deComercio debería listar las que tienen una respuesta del comercio', async () => {
    const comercioId = new Types.ObjectId().toString();

    await repo.deComercio(comercioId);

    expect(model.find).toHaveBeenCalledWith({ 'respuestas.comercioId': new Types.ObjectId(comercioId) });
  });

  it('caducadas debería buscar abiertas con el día ya pasado', async () => {
    const hoy = new Date('2026-10-01T00:00:00Z');

    await repo.caducadas(hoy);

    expect(model.find).toHaveBeenCalledWith({ estado: EstadoSolicitudPresupuesto.ABIERTA, fechaServicio: { $lt: hoy } });
    expect(consulta.limit).toHaveBeenCalledWith(100);
  });
});
