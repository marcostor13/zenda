import { Test } from '@nestjs/testing';
import { PerrosController } from './perros.controller';
import { PerrosService } from './perros.service';
import { PerroValoracionesService } from './perro-valoraciones.service';

describe('PerrosController', () => {
  let controller: PerrosController;
  let service: jest.Mocked<PerrosService>;
  let valoracionesService: jest.Mocked<PerroValoracionesService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PerrosController],
      providers: [
        {
          provide: PerrosService,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: 'p1' }),
            listarPorPropietario: jest.fn().mockResolvedValue([]),
            obtenerPropio: jest.fn().mockResolvedValue({ _id: 'p1' }),
            actualizar: jest.fn().mockResolvedValue({ _id: 'p1' }),
            eliminar: jest.fn().mockResolvedValue(undefined),
            listarHistorial: jest.fn().mockResolvedValue([]),
            agregarHistorial: jest.fn().mockResolvedValue({ _id: 'h1' }),
            obtenerHistoriaCompartida: jest.fn().mockResolvedValue({ nombre: 'Nala' }),
          },
        },
        {
          provide: PerroValoracionesService,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: 'v1' }),
            listarPorPerro: jest.fn().mockResolvedValue([]),
            indiceComportamiento: jest.fn().mockResolvedValue({ puntuacionPromedio: 0, totalValoraciones: 0, atributosPromedio: {} }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(PerrosController);
    service = moduleRef.get(PerrosService);
    valoracionesService = moduleRef.get(PerroValoracionesService);
  });

  it('debería crear el perro con el propietario del token', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    const dto = { nombre: 'Nala' };
    await controller.crear(dto, req);
    expect(service.crear).toHaveBeenCalledWith('user-1', dto);
  });

  it('debería listar los perros del usuario autenticado', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.misPerros(req);
    expect(service.listarPorPropietario).toHaveBeenCalledWith('user-1');
  });

  it('debería obtener un perro propio por id', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.obtener('p1', req);
    expect(service.obtenerPropio).toHaveBeenCalledWith('p1', 'user-1');
  });

  it('debería actualizar un perro propio', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    const dto = { nombre: 'Nala 2' };
    await controller.actualizar('p1', dto, req);
    expect(service.actualizar).toHaveBeenCalledWith('p1', 'user-1', dto);
  });

  it('debería eliminar un perro propio', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.eliminar('p1', req);
    expect(service.eliminar).toHaveBeenCalledWith('p1', 'user-1');
  });

  it('debería listar el historial de un perro propio', async () => {
    const req = { user: { sub: 'user-1' } } as never;
    await controller.listarHistorial('p1', req);
    expect(service.listarHistorial).toHaveBeenCalledWith('p1', 'user-1');
  });

  it('debería agregar historial usando el comercioId del token', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    const dto = { vertical: 'peluqueria' as never, nota: 'Nudos severos' };
    await controller.agregarHistorial('p1', dto, req);
    expect(service.agregarHistorial).toHaveBeenCalledWith('p1', 'comercio-1', dto);
  });

  it('debería obtener la historia veterinaria compartida sin exigir propietario', async () => {
    await controller.obtenerHistoriaCompartida('p1');
    expect(service.obtenerHistoriaCompartida).toHaveBeenCalledWith('p1');
  });

  it('debería obtener el índice de comportamiento sin exigir propietario', async () => {
    await controller.indiceComportamiento('p1');
    expect(valoracionesService.indiceComportamiento).toHaveBeenCalledWith('p1');
  });

  it('debería crear una valoración usando el comercioId del token', async () => {
    const req = { user: { sub: 'user-1', comercioId: 'comercio-1' } } as never;
    const dto = { reservaId: 'r1', puntuacion: 5 };
    await controller.crearValoracion('p1', dto, req);
    expect(valoracionesService.crear).toHaveBeenCalledWith('p1', 'comercio-1', dto);
  });

  it('debería listar las valoraciones de un perro', async () => {
    await controller.listarValoraciones('p1');
    expect(valoracionesService.listarPorPerro).toHaveBeenCalledWith('p1');
  });
});
