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
            actualizar: jest.fn().mockResolvedValue({ _id: 'r1' }),
            eliminar: jest.fn().mockResolvedValue(undefined),
            pendientesDeValorar: jest.fn().mockResolvedValue([]),
            listarParaAdmin: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            fijarOcultaComoAdmin: jest.fn().mockResolvedValue({ _id: 'r1' }),
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

  it('debería editar la reseña con el usuario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    const dto = { puntuacion: 4 };
    await controller.actualizar(req, 'r1', dto);
    expect(service.actualizar).toHaveBeenCalledWith('user-1', 'r1', dto);
  });

  it('debería eliminar la reseña con el usuario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.eliminar(req, 'r1');
    expect(service.eliminar).toHaveBeenCalledWith('user-1', 'r1');
  });

  it('debería listar las reservas pendientes de valorar del usuario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.pendientes(req);
    expect(service.pendientesDeValorar).toHaveBeenCalledWith('user-1');
  });
  describe('listar publico', () => {
    it('deberia elegir el listado por servicio cuando llega servicioId', async () => {
      await controller.listar('servicio-1');

      expect(service.listarPorServicio).toHaveBeenCalledWith('servicio-1');
      expect(service.listarPorUsuario).not.toHaveBeenCalled();
    });

    it('deberia elegir el listado por usuario', async () => {
      await controller.listar(undefined, 'user-1');

      expect(service.listarPorUsuario).toHaveBeenCalledWith('user-1');
    });

    it('deberia elegir el listado por comercio', async () => {
      await controller.listar(undefined, undefined, 'comercio-1');

      expect(service.listarPorComercio).toHaveBeenCalledWith('comercio-1');
    });

    it('deberia exigir al menos un filtro', () => {
      // Sin filtro devolveria las resenas de toda la plataforma en un endpoint
      // publico y sin paginar.
      expect(() => controller.listar()).toThrow(DomainException);
    });

    it('deberia dar prioridad al servicio si llegan varios filtros', () => {
      void controller.listar('servicio-1', 'user-1', 'comercio-1');

      expect(service.listarPorServicio).toHaveBeenCalled();
      expect(service.listarPorComercio).not.toHaveBeenCalled();
    });
  });

  describe('listado de administracion', () => {
    it('deberia usar pagina 1 y 20 por pagina si no se indica nada', async () => {
      await controller.listarParaAdmin();

      expect(service.listarParaAdmin).toHaveBeenCalledWith(
        { buscar: undefined, ocultas: undefined, puntuacion: undefined },
        1,
        20,
      );
    });

    it('deberia convertir a numero la paginacion y la puntuacion', async () => {
      await controller.listarParaAdmin('3', '50', 'malo', undefined, '2');

      expect(service.listarParaAdmin).toHaveBeenCalledWith(
        { buscar: 'malo', ocultas: undefined, puntuacion: 2 },
        3,
        50,
      );
    });

    it('deberia distinguir "sin filtro de ocultas" de "solo las visibles"', async () => {
      // `ocultas=false` significa "ensename las visibles", no "no filtres".
      await controller.listarParaAdmin(undefined, undefined, undefined, 'false');
      expect(service.listarParaAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ ocultas: false }), 1, 20,
      );

      await controller.listarParaAdmin(undefined, undefined, undefined, 'true');
      expect(service.listarParaAdmin).toHaveBeenLastCalledWith(
        expect.objectContaining({ ocultas: true }), 1, 20,
      );
    });
  });

  it('deberia fijar la visibilidad de una resena desde administracion', async () => {
    await controller.fijarVisibilidad('resena-1', { oculta: true });

    expect(service.fijarOcultaComoAdmin).toHaveBeenCalledWith('resena-1', true);
  });
});
