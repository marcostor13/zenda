import { Test } from '@nestjs/testing';
import { ListaEsperaController } from './lista-espera.controller';
import { ListaEsperaService } from './lista-espera.service';

describe('ListaEsperaController', () => {
  let controller: ListaEsperaController;
  let service: jest.Mocked<ListaEsperaService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ListaEsperaController],
      providers: [
        {
          provide: ListaEsperaService,
          useValue: {
            suscribir: jest.fn().mockResolvedValue({ email: 'ana@doogking.com', yaRegistrado: false }),
            listar: jest.fn().mockResolvedValue({ total: 0, items: [] }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ListaEsperaController);
    service = moduleRef.get(ListaEsperaService);
  });

  it('debería delegar el alta en el servicio', async () => {
    const dto = { email: 'ana@doogking.com', origen: 'proximamente' };

    await expect(controller.suscribir(dto)).resolves.toEqual({
      email: 'ana@doogking.com',
      yaRegistrado: false,
    });
    expect(service.suscribir).toHaveBeenCalledWith(dto);
  });

  it('debería delegar el listado de admin en el servicio', async () => {
    await controller.listar();

    expect(service.listar).toHaveBeenCalled();
  });
});
