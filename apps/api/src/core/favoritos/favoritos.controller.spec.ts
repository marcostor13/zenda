import { Test } from '@nestjs/testing';
import { FavoritosController } from './favoritos.controller';
import { FavoritosService } from './favoritos.service';

const req = { user: { sub: 'u1' } } as never;

describe('FavoritosController', () => {
  let controller: FavoritosController;
  let service: jest.Mocked<Pick<FavoritosService, 'listar' | 'listarIds' | 'agregar' | 'eliminar'>>;

  beforeEach(async () => {
    service = {
      listar: jest.fn(),
      listarIds: jest.fn(),
      agregar: jest.fn(),
      eliminar: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [FavoritosController],
      providers: [{ provide: FavoritosService, useValue: service }],
    }).compile();

    controller = moduleRef.get(FavoritosController);
  });

  it('debería delegar el listado enriquecido al servicio con el usuario autenticado', async () => {
    service.listar.mockResolvedValue([]);
    await controller.listar(req);
    expect(service.listar).toHaveBeenCalledWith('u1');
  });

  it('debería devolver los ids de favoritos del usuario', async () => {
    service.listarIds.mockResolvedValue(['s1']);
    const resultado = await controller.listarIds(req);
    expect(resultado).toEqual(['s1']);
  });

  it('debería marcar como favorito el servicio recibido', async () => {
    service.agregar.mockResolvedValue({ servicioId: 's1', favorito: true });
    const resultado = await controller.agregar('s1', req);
    expect(service.agregar).toHaveBeenCalledWith('u1', 's1');
    expect(resultado.favorito).toBe(true);
  });

  it('debería quitar de favoritos el servicio recibido', async () => {
    service.eliminar.mockResolvedValue({ servicioId: 's1', favorito: false });
    const resultado = await controller.eliminar('s1', req);
    expect(service.eliminar).toHaveBeenCalledWith('u1', 's1');
    expect(resultado.favorito).toBe(false);
  });
});
