import { Test } from '@nestjs/testing';
import { Rol } from 'shared';
import { LiquidacionesController } from './liquidaciones.controller';
import { LiquidacionesService } from './liquidaciones.service';
import { PermisosAdminGuard } from '../auth/guards/permisos.guard';

describe('LiquidacionesController', () => {
  let controller: LiquidacionesController;
  let service: jest.Mocked<Pick<LiquidacionesService, 'listar' | 'generar' | 'marcarPagada'>>;

  const admin = { user: { sub: 'admin-1', rol: Rol.ADMIN } } as never;

  beforeEach(async () => {
    service = {
      listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      generar: jest.fn().mockResolvedValue({ _id: 'liq-1' }),
      marcarPagada: jest.fn().mockResolvedValue({ _id: 'liq-1' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [LiquidacionesController],
      providers: [{ provide: LiquidacionesService, useValue: service }],
    })
      .overrideGuard(PermisosAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(LiquidacionesController);
  });

  it('debería listar filtrando por comercio y estado', async () => {
    await controller.listar(1, 20, 'comercio-1', 'pendiente');

    expect(service.listar).toHaveBeenCalledWith(
      { comercioId: 'comercio-1', estado: 'pendiente' },
      1,
      20,
    );
  });

  it('debería convertir a fecha el periodo al generar la liquidación', async () => {
    await controller.generar(
      { comercioId: 'comercio-1', desde: '2026-08-01', hasta: '2026-08-31' },
      admin,
    );

    const [comercioId, desde, hasta, actor] = service.generar.mock.calls[0];
    expect(comercioId).toBe('comercio-1');
    expect(desde).toBeInstanceOf(Date);
    expect(hasta).toBeInstanceOf(Date);
    expect(actor).toBe('admin-1');
  });

  it('debería registrar qué admin marca la liquidación como pagada', async () => {
    // Es dinero saliendo de la plataforma: sin actor no hay trazabilidad.
    await controller.marcarPagada('liq-1', { referencia: 'TRF-2026-08' }, admin);

    expect(service.marcarPagada).toHaveBeenCalledWith('liq-1', 'TRF-2026-08', 'admin-1');
  });
});
