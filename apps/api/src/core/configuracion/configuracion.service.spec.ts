import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TipoAviso } from 'shared';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionPlataforma } from './configuracion.schema';
import { AuditoriaService } from '../auditoria/auditoria.service';

const ADMIN_ID = '507f1f77bcf86cd799439011';

describe('ConfiguracionService', () => {
  let service: ConfiguracionService;
  let configModel: { findOne: jest.Mock; create: jest.Mock; findOneAndUpdate: jest.Mock };
  let auditoria: { registrar: jest.Mock };

  beforeEach(async () => {
    configModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      create: jest.fn().mockImplementation((datos) => Promise.resolve(datos)),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modoMantenimiento: true, verticalesActivos: [] }),
      }),
    };
    auditoria = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfiguracionService,
        { provide: getModelToken(ConfiguracionPlataforma.name), useValue: configModel },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get(ConfiguracionService);
  });

  it('debería crear la configuración con todos los avisos la primera vez', async () => {
    const config = await service.obtener();

    expect(configModel.create).toHaveBeenCalled();
    expect(Object.keys(config.notificaciones)).toHaveLength(Object.values(TipoAviso).length);
    // Push se declara desactivado: todavía no existe el canal.
    expect(config.notificaciones[TipoAviso.NUEVA_RESERVA]).toEqual({ email: true, plataforma: true, push: false });
  });

  it('debería completar los avisos que falten en una configuración antigua', async () => {
    configModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ notificaciones: { [TipoAviso.CANCELACION]: { email: false, plataforma: false, push: false } } }),
    });

    const config = await service.obtener();

    expect(config.notificaciones[TipoAviso.CANCELACION].email).toBe(false);
    // El aviso nuevo entra con los valores por defecto en vez de faltar.
    expect(config.notificaciones[TipoAviso.RECORDATORIO]).toEqual({ email: true, plataforma: true, push: false });
  });

  it('debería dejar constancia al actualizar la configuración', async () => {
    await service.actualizar({ modoMantenimiento: true }, ADMIN_ID);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ADMIN_ID, entidadId: 'configuracion' }),
    );
  });

  it('debería responder si un aviso está activo por un canal', async () => {
    configModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ notificaciones: { [TipoAviso.PROMOCIONES]: { email: false, plataforma: true, push: false } } }),
    });

    await expect(service.avisoActivo(TipoAviso.PROMOCIONES, 'email')).resolves.toBe(false);
    await expect(service.avisoActivo(TipoAviso.PROMOCIONES, 'plataforma')).resolves.toBe(true);
  });
});
