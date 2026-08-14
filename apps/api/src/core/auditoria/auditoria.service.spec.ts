import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EntidadAuditada } from 'shared';
import { AuditoriaService } from './auditoria.service';
import { RegistroAuditoria } from './auditoria.schema';
import { UsersRepository } from '../users/users.repository';

const ADMIN_ID = '507f1f77bcf86cd799439011';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let registroModel: { create: jest.Mock; find: jest.Mock; countDocuments: jest.Mock };
  let usersRepo: { findById: jest.Mock };

  beforeEach(async () => {
    registroModel = {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };
    usersRepo = { findById: jest.fn().mockResolvedValue({ nombre: 'Marcos' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        { provide: getModelToken(RegistroAuditoria.name), useValue: registroModel },
        { provide: UsersRepository, useValue: usersRepo },
      ],
    }).compile();

    service = module.get(AuditoriaService);
  });

  it('debería guardar el nombre del administrador junto a la acción', async () => {
    await service.registrar({
      actorId: ADMIN_ID,
      entidad: EntidadAuditada.COMISION,
      entidadId: 'alojamiento',
      descripcion: 'Comisión de alojamiento cambiada del 15 % al 12 %',
    });

    expect(registroModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorNombre: 'Marcos', entidad: EntidadAuditada.COMISION }),
    );
  });

  it('no debería tumbar la operación si la auditoría falla', async () => {
    registroModel.create.mockRejectedValue(new Error('mongo caído'));

    await expect(
      service.registrar({ actorId: ADMIN_ID, entidad: EntidadAuditada.USUARIO, descripcion: 'algo' }),
    ).resolves.toBeUndefined();
  });

  it('debería filtrar el historial por entidad', async () => {
    await service.listar({ entidad: EntidadAuditada.COMERCIO });

    expect(registroModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: EntidadAuditada.COMERCIO }),
    );
  });

  it('debería buscar por descripción, administrador o motivo', async () => {
    await service.listar({ buscar: 'suspend' });

    const query = registroModel.find.mock.calls[0][0];
    expect(query.$or).toHaveLength(3);
  });
});
