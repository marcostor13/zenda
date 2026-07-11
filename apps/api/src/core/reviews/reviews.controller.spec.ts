import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: jest.Mocked<ReviewsService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: 'r1' }),
            listarPorServicio: jest.fn().mockResolvedValue([]),
            listarPorUsuario: jest.fn().mockResolvedValue([]),
            listarPorComercio: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ReviewsController);
    service = moduleRef.get(ReviewsService);
  });

  it('debería crear la reseña con el usuario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    const dto = { reservaId: 'res-1', puntuacion: 5, comentario: 'Genial' };
    await controller.crear(req, dto);
    expect(service.crear).toHaveBeenCalledWith('user-1', dto);
  });

  it('debería listar por servicio cuando se pasa servicioId', async () => {
    await controller.listar('serv-1');
    expect(service.listarPorServicio).toHaveBeenCalledWith('serv-1');
  });

  it('debería listar por usuario cuando se pasa usuarioId', async () => {
    await controller.listar(undefined, 'user-1');
    expect(service.listarPorUsuario).toHaveBeenCalledWith('user-1');
  });

  it('debería lanzar 400 si no se pasa ningún filtro', () => {
    expect(() => controller.listar()).toThrow(DomainException);
  });
});
