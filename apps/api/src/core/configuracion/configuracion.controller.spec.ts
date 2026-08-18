import { Test } from '@nestjs/testing';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { PermisosAdminGuard } from '../auth/guards/permisos.guard';

describe('ConfiguracionController', () => {
  let controller: ConfiguracionController;
  let service: jest.Mocked<Pick<ConfiguracionService, 'obtener' | 'actualizar'>>;

  /** Configuración completa; la parte pública es sólo un recorte de esto. */
  const configCompleta = {
    modoMantenimiento: true,
    mensajeMantenimiento: 'Volvemos en una hora',
    verticalesActivos: ['alojamiento', 'veterinaria'],
    emailSoporte: 'soporte@doogking.com',
    comisionPorDefecto: 0.15,
  };

  beforeEach(async () => {
    service = {
      obtener: jest.fn().mockResolvedValue(configCompleta),
      actualizar: jest.fn().mockResolvedValue(configCompleta),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ConfiguracionController],
      providers: [{ provide: ConfiguracionService, useValue: service }],
    })
      // Los guards se prueban por separado; aquí sólo se comprueba qué expone
      // cada endpoint, y sin esto Nest exigiría resolver UsersRepository.
      .overrideGuard(PermisosAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(ConfiguracionController);
  });

  describe('publica', () => {
    it('debería devolver el estado de mantenimiento y los verticales abiertos', async () => {
      const publica = await controller.publica();

      expect(publica).toEqual({
        modoMantenimiento: true,
        mensajeMantenimiento: 'Volvemos en una hora',
        verticalesActivos: ['alojamiento', 'veterinaria'],
      });
    });

    it('no debería filtrar ajustes internos por el endpoint público', async () => {
      // El endpoint no pide sesión: todo lo que devuelva es público de facto.
      const publica = (await controller.publica()) as Record<string, unknown>;

      expect(publica['emailSoporte']).toBeUndefined();
      expect(publica['comisionPorDefecto']).toBeUndefined();
    });
  });

  it('debería devolver la configuración completa en el endpoint de admin', async () => {
    await expect(controller.obtener()).resolves.toMatchObject({ emailSoporte: 'soporte@doogking.com' });
  });
});
