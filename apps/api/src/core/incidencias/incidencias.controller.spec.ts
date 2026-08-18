import { Test } from '@nestjs/testing';
import { EstadoIncidencia, Rol, TipoIncidencia } from 'shared';
import { IncidenciasController } from './incidencias.controller';
import { IncidenciasService } from './incidencias.service';

describe('IncidenciasController', () => {
  let controller: IncidenciasController;
  let service: jest.Mocked<
    Pick<IncidenciasService, 'crear' | 'listarPropias' | 'contarPorEstado' | 'listar' | 'actualizarEstado'>
  >;

  const cliente = { user: { sub: 'user-1', rol: Rol.CLIENTE } } as never;
  const admin = { user: { sub: 'admin-1', rol: Rol.ADMIN } } as never;

  beforeEach(async () => {
    service = {
      crear: jest.fn().mockResolvedValue({ _id: 'inc-1' }),
      listarPropias: jest.fn().mockResolvedValue([]),
      contarPorEstado: jest.fn().mockResolvedValue({ abierta: 2 }),
      listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      actualizarEstado: jest.fn().mockResolvedValue({ _id: 'inc-1' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [IncidenciasController],
      providers: [{ provide: IncidenciasService, useValue: service }],
    }).compile();

    controller = moduleRef.get(IncidenciasController);
  });

  it('debería abrir la incidencia a nombre del usuario y con su rol', async () => {
    // El rol viaja al servicio porque decide qué puede reclamar cada perfil.
    const dto = { reservaId: 'r1', tipo: TipoIncidencia.DEVOLUCION, descripcion: 'x' } as never;

    await controller.crear(cliente, dto);

    expect(service.crear).toHaveBeenCalledWith('user-1', Rol.CLIENTE, dto);
  });

  it('debería listar sólo las incidencias propias del usuario del token', async () => {
    await controller.mias(cliente);

    expect(service.listarPropias).toHaveBeenCalledWith('user-1');
  });

  it('debería devolver el recuento por estado', async () => {
    await expect(controller.resumen()).resolves.toEqual({ abierta: 2 });
  });

  it('debería pasar los filtros y la paginación al servicio', async () => {
    await controller.listar(2, 50, EstadoIncidencia.ABIERTA, TipoIncidencia.DEVOLUCION, 'perro');

    expect(service.listar).toHaveBeenCalledWith(
      { estado: EstadoIncidencia.ABIERTA, tipo: TipoIncidencia.DEVOLUCION, buscar: 'perro' },
      2,
      50,
    );
  });

  it('debería registrar qué administrador cambia el estado', async () => {
    // Sin el actor, el historial de la incidencia no sirve para resolver disputas.
    const dto = { estado: EstadoIncidencia.RESUELTA, nota: 'reembolsado' } as never;

    await controller.actualizarEstado(admin, 'inc-1', dto);

    expect(service.actualizarEstado).toHaveBeenCalledWith('inc-1', dto, 'admin-1');
  });
});
