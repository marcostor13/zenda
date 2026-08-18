import { Test } from '@nestjs/testing';
import { EstadoModeracion, TipoLugar } from 'shared';
import { LugaresController } from './lugares.controller';
import { LugaresService } from './lugares.service';

describe('LugaresController', () => {
  let controller: LugaresController;
  let service: jest.Mocked<LugaresService>;

  const req = { user: { sub: 'u1', nombre: 'Ana' } } as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LugaresController],
      providers: [
        {
          provide: LugaresService,
          useValue: {
            buscar: jest.fn().mockResolvedValue([]),
            listarPendientes: jest.fn().mockResolvedValue({ lugares: [], reviews: [] }),
            listarReportados: jest.fn().mockResolvedValue({ lugares: [], reviews: [] }),
            contarPorEstado: jest.fn().mockResolvedValue({}),
            reportar: jest.fn().mockResolvedValue(undefined),
            obtener: jest.fn().mockResolvedValue({ _id: 'l1' }),
            listarReviews: jest.fn().mockResolvedValue([]),
            crear: jest.fn().mockResolvedValue({ _id: 'l1' }),
            proponerCambios: jest.fn().mockResolvedValue({ _id: 'l1' }),
            crearReview: jest.fn().mockResolvedValue({ _id: 'r1' }),
            moderarLugar: jest.fn().mockResolvedValue({ _id: 'l1' }),
            moderarReview: jest.fn().mockResolvedValue({ _id: 'r1' }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(LugaresController);
    service = moduleRef.get(LugaresService);
  });

  describe('buscar', () => {
    it('debería convertir a número las coordenadas y límites que llegan como texto', async () => {
      await controller.buscar(TipoLugar.PLAYA, 'Madrid', 'Madrid', '40.4', '-3.7', '10', '25');

      expect(service.buscar).toHaveBeenCalledWith({
        tipo: TipoLugar.PLAYA, ciudad: 'Madrid', provincia: 'Madrid',
        lat: 40.4, lng: -3.7, radioKm: 10, limit: 25,
      });
    });

    it('debería dejar sin definir los parámetros numéricos ausentes', async () => {
      await controller.buscar();

      expect(service.buscar).toHaveBeenCalledWith({
        tipo: undefined, ciudad: undefined, provincia: undefined,
        lat: undefined, lng: undefined, radioKm: undefined, limit: undefined,
      });
    });

    it('debería ignorar un valor numérico no válido en vez de mandar NaN', async () => {
      await controller.buscar(undefined, undefined, undefined, 'no-es-un-numero');

      expect(service.buscar.mock.calls[0][0].lat).toBeUndefined();
    });

    it('debería conservar el cero como valor legítimo de coordenada', async () => {
      // El meridiano de Greenwich es lng 0: tratarlo como "ausente" movería el mapa.
      await controller.buscar(undefined, undefined, undefined, '0', '0');

      expect(service.buscar.mock.calls[0][0]).toEqual(
        expect.objectContaining({ lat: 0, lng: 0 }),
      );
    });
  });

  describe('moderación', () => {
    it('debería filtrar los pendientes por el estado pedido', async () => {
      await controller.pendientes(EstadoModeracion.PENDIENTE);

      expect(service.listarPendientes).toHaveBeenCalledWith(EstadoModeracion.PENDIENTE);
    });

    it('debería listar los reportados y el resumen por estado', async () => {
      await controller.reportados();
      await controller.resumenModeracion();

      expect(service.listarReportados).toHaveBeenCalled();
      expect(service.contarPorEstado).toHaveBeenCalled();
    });

    it('debería aprobar o rechazar un lugar', async () => {
      const dto = { estado: EstadoModeracion.PUBLICADO } as never;

      await controller.moderarLugar('l1', dto);

      expect(service.moderarLugar).toHaveBeenCalledWith('l1', dto);
    });

    it('debería aprobar o rechazar una aportación', async () => {
      const dto = { estado: EstadoModeracion.RECHAZADO } as never;

      await controller.moderarReview('r1', dto);

      expect(service.moderarReview).toHaveBeenCalledWith('r1', dto);
    });
  });

  describe('reportar', () => {
    it('debería propagar el motivo de la denuncia', async () => {
      const res = await controller.reportar('lugar', 'l1', { motivo: 'Fuente rota' });

      expect(service.reportar).toHaveBeenCalledWith('lugar', 'l1', 'Fuente rota');
      expect(res).toEqual({ ok: true });
    });

    it('debería admitir una denuncia sin motivo', async () => {
      await controller.reportar('review', 'r1', {});

      expect(service.reportar).toHaveBeenCalledWith('review', 'r1', undefined);
    });

    it('no debería romperse si no llega cuerpo en la petición', async () => {
      await controller.reportar('lugar', 'l1', undefined as never);

      expect(service.reportar).toHaveBeenCalledWith('lugar', 'l1', undefined);
    });
  });

  describe('lectura y aportaciones', () => {
    it('debería devolver la ficha de un lugar', async () => {
      await controller.obtener('l1');

      expect(service.obtener).toHaveBeenCalledWith('l1');
    });

    it('debería listar las aportaciones publicadas de un lugar', async () => {
      await controller.reviews('l1');

      expect(service.listarReviews).toHaveBeenCalledWith('l1');
    });

    it('debería crear el lugar a nombre del usuario del token', async () => {
      const dto = { nombre: 'Playa del Postiguet' } as never;

      await controller.crear(dto, req);

      expect(service.crear).toHaveBeenCalledWith(dto, 'u1');
    });

    it('debería enviar las correcciones propuestas al servicio', async () => {
      const dto = { nombre: 'Nuevo nombre' } as never;

      await controller.proponerCambios('l1', dto);

      expect(service.proponerCambios).toHaveBeenCalledWith('l1', dto);
    });

    it('debería adjuntar el nombre del autor a la aportación', async () => {
      const dto = { texto: 'Muy buena sombra' } as never;

      await controller.crearReview('l1', dto, req);

      expect(service.crearReview).toHaveBeenCalledWith('l1', 'u1', 'Ana', dto);
    });

    it('debería usar un nombre genérico si el token no trae el del usuario', async () => {
      const dto = { texto: 'Ok' } as never;

      await controller.crearReview('l1', dto, { user: { sub: 'u1' } } as never);

      expect(service.crearReview).toHaveBeenCalledWith('l1', 'u1', 'Usuario', dto);
    });
  });
});
