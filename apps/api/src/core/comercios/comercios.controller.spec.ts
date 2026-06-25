import { Test } from '@nestjs/testing';
import { ComerciosController } from './comercios.controller';
import { ComerciosService } from './comercios.service';

describe('ComerciosController', () => {
  let controller: ComerciosController;
  let service: jest.Mocked<ComerciosService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ComerciosController],
      providers: [
        {
          provide: ComerciosService,
          useValue: {
            registrar: jest.fn(),
            listar: jest.fn(),
            obtener: jest.fn(),
            cambiarEstado: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ComerciosController);
    service = moduleRef.get(ComerciosService);
  });

  it('debería delegar el registro en el service', async () => {
    const dto = { razonSocial: 'X', vatNumber: 'B-1', nombreComercial: 'X' };
    service.registrar.mockResolvedValue({ id: 'c1' } as never);
    await controller.registrar(dto);
    expect(service.registrar).toHaveBeenCalledWith(dto);
  });

  it('debería listar filtrando por estado', async () => {
    service.listar.mockResolvedValue([] as never);
    await controller.listar('pendiente');
    expect(service.listar).toHaveBeenCalledWith('pendiente');
  });

  it('debería obtener por id', async () => {
    service.obtener.mockResolvedValue({ id: 'c1' } as never);
    await controller.obtener('c1');
    expect(service.obtener).toHaveBeenCalledWith('c1');
  });

  it('debería cambiar el estado pasando el valor del dto', async () => {
    service.cambiarEstado.mockResolvedValue({ id: 'c1' } as never);
    await controller.cambiarEstado('c1', { estado: 'activo' });
    expect(service.cambiarEstado).toHaveBeenCalledWith('c1', 'activo');
  });
});
