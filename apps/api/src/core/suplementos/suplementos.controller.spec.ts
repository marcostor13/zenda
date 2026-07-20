import { Test } from '@nestjs/testing';
import { SuplementosController } from './suplementos.controller';
import { SuplementosService } from './suplementos.service';

describe('SuplementosController', () => {
  let controller: SuplementosController;
  let service: jest.Mocked<SuplementosService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SuplementosController],
      providers: [
        {
          provide: SuplementosService,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: 's1' }),
            listarPorComercio: jest.fn().mockResolvedValue([]),
            actualizar: jest.fn().mockResolvedValue({ _id: 's1' }),
            eliminar: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(SuplementosController);
    service = moduleRef.get(SuplementosService);
  });

  it('debería crear el suplemento con el comercioId del token', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    const dto = { concepto: 'Nudos severos', monto: 15 };
    await controller.crear(dto, req);
    expect(service.crear).toHaveBeenCalledWith('comercio-1', dto);
  });

  it('debería listar los suplementos del comercio autenticado', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    await controller.misSuplementos(req);
    expect(service.listarPorComercio).toHaveBeenCalledWith('comercio-1');
  });

  it('debería actualizar un suplemento propio', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    const dto = { monto: 20 };
    await controller.actualizar('s1', dto, req);
    expect(service.actualizar).toHaveBeenCalledWith('s1', 'comercio-1', dto);
  });

  it('debería eliminar un suplemento propio', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    await controller.eliminar('s1', req);
    expect(service.eliminar).toHaveBeenCalledWith('s1', 'comercio-1');
  });
});
