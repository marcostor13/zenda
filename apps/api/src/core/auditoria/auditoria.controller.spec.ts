import { Test } from '@nestjs/testing';
import { EntidadAuditada } from 'shared';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaController', () => {
  let controller: AuditoriaController;
  let service: jest.Mocked<Pick<AuditoriaService, 'listar'>>;

  beforeEach(async () => {
    service = { listar: jest.fn().mockResolvedValue({ items: [], total: 0 }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [{ provide: AuditoriaService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AuditoriaController);
  });

  it('debería listar con la paginación por defecto', async () => {
    await controller.listar(1, 30);

    expect(service.listar).toHaveBeenCalledWith(
      { entidad: undefined, entidadId: undefined, buscar: undefined },
      1,
      30,
    );
  });

  it('debería filtrar por entidad y por el id concreto auditado', async () => {
    // Es el caso de uso real: "qué se ha hecho con este comercio".
    await controller.listar(1, 30, EntidadAuditada.COMERCIO, 'comercio-1');

    expect(service.listar).toHaveBeenCalledWith(
      { entidad: EntidadAuditada.COMERCIO, entidadId: 'comercio-1', buscar: undefined },
      1,
      30,
    );
  });

  it('debería pasar el término de búsqueda tal cual', async () => {
    await controller.listar(2, 10, undefined, undefined, 'suspendido');

    expect(service.listar).toHaveBeenCalledWith(
      { entidad: undefined, entidadId: undefined, buscar: 'suspendido' },
      2,
      10,
    );
  });
});
