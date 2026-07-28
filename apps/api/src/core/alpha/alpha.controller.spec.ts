import { Test } from '@nestjs/testing';
import { AlphaController } from './alpha.controller';
import { AlphaService } from './alpha.service';

describe('AlphaController', () => {
  let controller: AlphaController;
  let service: jest.Mocked<AlphaService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AlphaController],
      providers: [
        {
          provide: AlphaService,
          useValue: {
            listarNiveles: jest.fn().mockResolvedValue([]),
            obtenerEstado: jest.fn().mockResolvedValue({ nivelActual: 1 }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AlphaController);
    service = moduleRef.get(AlphaService);
  });

  it('debería listar la escalera de niveles', async () => {
    await controller.niveles();
    expect(service.listarNiveles).toHaveBeenCalled();
  });

  it('debería devolver el estado Alpha del usuario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.miEstado(req);
    expect(service.obtenerEstado).toHaveBeenCalledWith('user-1');
  });
});
