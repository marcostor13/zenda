import { Test } from '@nestjs/testing';
import { CampanasController } from './campanas.controller';
import { CampanasService } from './campanas.service';

describe('CampanasController', () => {
  let controller: CampanasController;
  let service: jest.Mocked<CampanasService>;

  const req = { user: { sub: 'admin-1' } } as never;

  const dto = {
    nombre: 'Navidad',
    desde: '2026-12-01',
    hasta: '2026-12-31',
  } as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CampanasController],
      providers: [
        {
          provide: CampanasService,
          useValue: {
            listar: jest.fn().mockResolvedValue([]),
            metricas: jest.fn().mockResolvedValue([]),
            crear: jest.fn().mockResolvedValue({ _id: 'c1' }),
            actualizar: jest.fn().mockResolvedValue({ _id: 'c1' }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(CampanasController);
    service = moduleRef.get(CampanasService);
  });

  it('debería delegar el listado en el servicio', async () => {
    await controller.listar();

    expect(service.listar).toHaveBeenCalled();
  });

  it('debería delegar las métricas en el servicio', async () => {
    await controller.metricas();

    expect(service.metricas).toHaveBeenCalled();
  });

  it('debería convertir las fechas de texto a Date al crear', async () => {
    // El DTO las recibe como cadena ISO; el servicio y el schema trabajan con Date.
    await controller.crear(dto, req);

    const [datos, adminId] = service.crear.mock.calls[0];
    expect(datos.desde).toBeInstanceOf(Date);
    expect(datos.hasta).toBeInstanceOf(Date);
    expect(adminId).toBe('admin-1');
  });

  it('debería propagar quién crea la campaña desde el token', async () => {
    await controller.crear(dto, { user: { sub: 'otro-admin' } } as never);

    expect(service.crear.mock.calls[0][1]).toBe('otro-admin');
  });

  it('debería convertir también las fechas al actualizar', async () => {
    await controller.actualizar('c1', dto);

    const [id, datos] = service.actualizar.mock.calls[0];
    expect(id).toBe('c1');
    expect(datos.desde).toBeInstanceOf(Date);
    expect(datos.hasta).toBeInstanceOf(Date);
  });
});
