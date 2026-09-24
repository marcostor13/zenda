import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, VALIDEZ_PRESUPUESTO_DIAS, VerticalKey,
} from 'shared';
import { Servicio } from '../catalog/servicio.schema';
import { Usuario } from '../users/usuario.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PresupuestosRepository } from './presupuestos.repository';
import { PresupuestosService } from './presupuestos.service';
import { SolicitudPresupuestoDocument } from './solicitud-presupuesto.schema';

const USUARIO = new Types.ObjectId();
const COMERCIO_1 = new Types.ObjectId();
const COMERCIO_2 = new Types.ObjectId();
const SERVICIO_1 = new Types.ObjectId();
const SERVICIO_2 = new Types.ObjectId();
const MS_POR_DIA = 86_400_000;

const servicio = (id: Types.ObjectId, comercioId: Types.ObjectId, extra: Record<string, unknown> = {}) => ({
  _id: id, comercioId, vertical: VerticalKey.TRANSPORTE, titulo: `Empresa ${id.toString().slice(-3)}`,
  imagenes: ['https://cdn/img.jpg'], ratingPromedio: 4.2, estado: 'publicado', comercioActivo: true, ...extra,
});

type SolicitudMock = SolicitudPresupuestoDocument & { save: jest.Mock; markModified: jest.Mock };

const solicitudDoc = (extra: Record<string, unknown> = {}): SolicitudMock => {
  const doc: Record<string, unknown> = {
    _id: new Types.ObjectId(),
    codigo: 'PRE-ABC',
    usuarioId: USUARIO,
    vertical: VerticalKey.TRANSPORTE,
    detalle: { resumen: [['Recogida', 'Castellón']] },
    fechaServicio: new Date('2030-03-01T00:00:00Z'),
    comentario: 'Con cuidado',
    estado: EstadoSolicitudPresupuesto.ABIERTA,
    respuestas: [
      { servicioId: SERVICIO_1, comercioId: COMERCIO_1, estado: EstadoRespuestaPresupuesto.PENDIENTE },
      { servicioId: SERVICIO_2, comercioId: COMERCIO_2, estado: EstadoRespuestaPresupuesto.PENDIENTE },
    ],
    createdAt: new Date('2030-01-01T00:00:00Z'),
    markModified: jest.fn(),
    ...extra,
  };
  doc['save'] = jest.fn().mockResolvedValue(doc);
  return doc as unknown as SolicitudMock;
};

const cadena = (valor: unknown) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(valor) }) }),
});

describe('PresupuestosService', () => {
  let service: PresupuestosService;
  let repo: jest.Mocked<PresupuestosRepository>;
  let servicioModel: { find: jest.Mock };
  let usuarioModel: { find: jest.Mock };
  let notifications: jest.Mocked<Pick<NotificationsService, 'notificarSolicitudPresupuesto' | 'notificarPresupuestoRecibido'>>;

  const conServicios = (lista: unknown[]) => servicioModel.find.mockReturnValue(cadena(lista));

  beforeEach(async () => {
    servicioModel = { find: jest.fn().mockReturnValue(cadena([])) };
    usuarioModel = { find: jest.fn().mockReturnValue(cadena([])) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PresupuestosService,
        {
          provide: PresupuestosRepository,
          useValue: {
            crear: jest.fn(), porId: jest.fn(), deUsuario: jest.fn(), deComercio: jest.fn(), caducadas: jest.fn(),
          },
        },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        {
          provide: NotificationsService,
          useValue: {
            notificarSolicitudPresupuesto: jest.fn().mockResolvedValue(undefined),
            notificarPresupuestoRecibido: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PresupuestosService);
    repo = moduleRef.get(PresupuestosRepository);
    notifications = moduleRef.get(NotificationsService);
  });

  describe('crear', () => {
    const dto = {
      vertical: VerticalKey.TRANSPORTE,
      servicioIds: [SERVICIO_1.toString(), SERVICIO_2.toString(), SERVICIO_1.toString()],
      detalle: { resumen: [['Recogida', 'Castellón'], ['x'.repeat(100), 'y'.repeat(400)], 'rota'] },
      fechaServicio: '2030-03-01',
      comentario: 'Con cuidado',
    };

    it('debería pedir presupuesto sólo a las empresas que lo aceptan y avisarlas', async () => {
      conServicios([
        servicio(SERVICIO_1, COMERCIO_1),
        servicio(SERVICIO_2, COMERCIO_2, { estado: 'pausado' }),
      ]);
      repo.crear.mockImplementation(async (datos) => solicitudDoc({ ...datos, _id: new Types.ObjectId() }));

      const vista = await service.crear(USUARIO.toString(), dto);

      expect(servicioModel.find).toHaveBeenCalledWith({ _id: { $in: [SERVICIO_1.toString(), SERVICIO_2.toString()] } });
      const datos = repo.crear.mock.calls[0][0];
      expect(datos.codigo).toMatch(/^PRE-[A-Z0-9_-]{8}$/);
      expect(datos.estado).toBe(EstadoSolicitudPresupuesto.ABIERTA);
      expect(datos.fechaServicio).toBeInstanceOf(Date);
      expect(datos.respuestas).toEqual([
        { servicioId: SERVICIO_1, comercioId: COMERCIO_1, estado: EstadoRespuestaPresupuesto.PENDIENTE },
      ]);
      expect(notifications.notificarSolicitudPresupuesto).toHaveBeenCalledTimes(1);
      const aviso = notifications.notificarSolicitudPresupuesto.mock.calls[0][0];
      expect(aviso.comercioId).toBe(COMERCIO_1.toString());
      // El resumen se recorta y descarta las filas mal formadas.
      expect(aviso.resumen).toEqual([['Recogida', 'Castellón'], ['x'.repeat(80), 'y'.repeat(300)]]);
      expect(vista.respuestas).toEqual([expect.objectContaining({
        servicioId: SERVICIO_1.toString(), titulo: expect.stringContaining('Empresa'), rating: 4.2, imagen: 'https://cdn/img.jpg',
      })]);
    });

    it('debería mandar un resumen vacío si la solicitud no trae resumen', async () => {
      conServicios([servicio(SERVICIO_1, COMERCIO_1)]);
      repo.crear.mockImplementation(async (datos) => solicitudDoc({ ...datos, detalle: {} }));

      await service.crear(USUARIO.toString(), { ...dto, detalle: {} });

      expect(notifications.notificarSolicitudPresupuesto.mock.calls[0][0].resumen).toEqual([]);
    });

    it('debería rechazar con 409 si ninguna empresa acepta la solicitud', async () => {
      conServicios([
        servicio(SERVICIO_1, COMERCIO_1, { vertical: VerticalKey.PELUQUERIA }),
        servicio(SERVICIO_2, COMERCIO_2, { comercioActivo: false }),
      ]);

      await expect(service.crear(USUARIO.toString(), dto)).rejects.toMatchObject({ statusCode: 409 });
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('no debería consultar servicios con identificadores inválidos', async () => {
      await expect(service.crear(USUARIO.toString(), { ...dto, servicioIds: ['nada'] })).rejects.toThrow(DomainException);
      expect(servicioModel.find).not.toHaveBeenCalled();
    });
  });

  describe('lado del cliente', () => {
    it('misSolicitudes debería devolver las solicitudes con los datos de cada empresa', async () => {
      const reservaId = new Types.ObjectId();
      repo.deUsuario.mockResolvedValue([solicitudDoc({ reservaId })]);
      conServicios([servicio(SERVICIO_1, COMERCIO_1)]);

      const [vista] = await service.misSolicitudes(USUARIO.toString());

      expect(vista).toEqual(expect.objectContaining({
        codigo: 'PRE-ABC', estado: EstadoSolicitudPresupuesto.ABIERTA, reservaId: reservaId.toString(),
        fechaServicio: '2030-03-01T00:00:00.000Z',
      }));
      expect(vista.respuestas[1]).toEqual(expect.objectContaining({ servicioId: SERVICIO_2.toString(), titulo: '', rating: 0 }));
    });

    it('deUsuario debería responder 404 si no existe y 403 si es de otro cliente', async () => {
      repo.porId.mockResolvedValue(null);
      await expect(service.deUsuario('x', USUARIO.toString())).rejects.toMatchObject({ statusCode: 404 });

      repo.porId.mockResolvedValue(solicitudDoc());
      await expect(service.deUsuario('x', new Types.ObjectId().toString())).rejects.toMatchObject({ statusCode: 403 });
    });

    it('cancelar debería retirar una solicitud abierta', async () => {
      const doc = solicitudDoc();
      repo.porId.mockResolvedValue(doc);

      const vista = await service.cancelar('x', USUARIO.toString());

      expect(doc.estado).toBe(EstadoSolicitudPresupuesto.CANCELADA);
      expect(doc.save).toHaveBeenCalled();
      expect(vista.estado).toBe(EstadoSolicitudPresupuesto.CANCELADA);
    });

    it('cancelar debería rechazar con 400 una solicitud que ya no está abierta', async () => {
      repo.porId.mockResolvedValue(solicitudDoc({ estado: EstadoSolicitudPresupuesto.CONVERTIDA }));
      await expect(service.cancelar('x', USUARIO.toString())).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('lado del comercio', () => {
    it('bandejaComercio debería enseñar sólo la respuesta del comercio y el nombre del cliente', async () => {
      const doc = solicitudDoc();
      repo.deComercio.mockResolvedValue([doc]);
      conServicios([servicio(SERVICIO_1, COMERCIO_1)]);
      usuarioModel.find.mockReturnValue(cadena([{ _id: USUARIO, nombre: 'María' }]));

      const bandeja = await service.bandejaComercio(COMERCIO_1.toString());

      expect(bandeja).toHaveLength(1);
      expect(bandeja[0]).toEqual(expect.objectContaining({
        id: doc._id.toString(), servicioId: SERVICIO_1.toString(), clienteNombre: 'María',
        tituloServicio: expect.stringContaining('Empresa'),
        respuesta: expect.objectContaining({ estado: EstadoRespuestaPresupuesto.PENDIENTE }),
      }));
    });

    it('bandejaComercio debería llamar «Cliente» a quien ya no existe', async () => {
      repo.deComercio.mockResolvedValue([solicitudDoc({ createdAt: undefined })]);

      const bandeja = await service.bandejaComercio(COMERCIO_2.toString());

      expect(bandeja[0].clienteNombre).toBe('Cliente');
      expect(bandeja[0].tituloServicio).toBe('');
    });

    it('responder debería fijar precio redondeado, validez por defecto y avisar al cliente', async () => {
      const doc = solicitudDoc();
      repo.porId.mockResolvedValue(doc);
      repo.deComercio.mockResolvedValue([]);
      conServicios([servicio(SERVICIO_1, COMERCIO_1, { titulo: 'Fido' })]);
      const antes = Date.now();

      await service.responder('x', COMERCIO_1.toString(), SERVICIO_1.toString(), { importe: 120.456, condiciones: 'Pago previo' });

      const respuesta = doc.respuestas[0];
      expect(respuesta.estado).toBe(EstadoRespuestaPresupuesto.RESPONDIDA);
      expect(respuesta.importe).toBe(120.46);
      expect(respuesta.validoHasta!.getTime()).toBeGreaterThanOrEqual(antes + VALIDEZ_PRESUPUESTO_DIAS * MS_POR_DIA);
      expect(doc.markModified).toHaveBeenCalledWith('respuestas');
      expect(notifications.notificarPresupuestoRecibido).toHaveBeenCalledWith(expect.objectContaining({
        usuarioId: USUARIO.toString(), empresa: 'Fido', importe: 120.46, condiciones: 'Pago previo',
      }));
    });

    it('responder debería usar la validez indicada y un nombre genérico si la empresa no aparece', async () => {
      const doc = solicitudDoc();
      repo.porId.mockResolvedValue(doc);
      repo.deComercio.mockResolvedValue([]);
      const antes = Date.now();

      await service.responder('x', COMERCIO_1.toString(), SERVICIO_1.toString(), { importe: 50, validezDias: 10 });

      expect(doc.respuestas[0].validoHasta!.getTime()).toBeGreaterThanOrEqual(antes + 10 * MS_POR_DIA);
      expect(notifications.notificarPresupuestoRecibido.mock.calls[0][0].empresa).toBe('La empresa');
    });

    it('responder debería dar 404 si el comercio no está entre los destinatarios', async () => {
      repo.porId.mockResolvedValue(solicitudDoc());
      await expect(service.responder('x', COMERCIO_1.toString(), SERVICIO_2.toString(), { importe: 10 }))
        .rejects.toMatchObject({ statusCode: 404 });

      repo.porId.mockResolvedValue(null);
      await expect(service.responder('x', COMERCIO_1.toString(), SERVICIO_1.toString(), { importe: 10 }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('responder debería dar 409 si el cliente ya no espera respuesta', async () => {
      repo.porId.mockResolvedValue(solicitudDoc({ estado: EstadoSolicitudPresupuesto.CANCELADA }));
      await expect(service.responder('x', COMERCIO_1.toString(), SERVICIO_1.toString(), { importe: 10 }))
        .rejects.toMatchObject({ statusCode: 409 });
    });

    it('rechazar debería declinar con el motivo', async () => {
      const doc = solicitudDoc();
      repo.porId.mockResolvedValue(doc);
      repo.deComercio.mockResolvedValue([]);

      await service.rechazar('x', COMERCIO_2.toString(), SERVICIO_2.toString(), 'Sin hueco');

      expect(doc.respuestas[1]).toEqual(expect.objectContaining({
        estado: EstadoRespuestaPresupuesto.RECHAZADA_POR_COMERCIO, motivoRechazo: 'Sin hueco',
      }));
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe('importeParaReserva', () => {
    const respondida = (extra: Record<string, unknown> = {}) => solicitudDoc({
      respuestas: [{
        servicioId: SERVICIO_1, comercioId: COMERCIO_1, estado: EstadoRespuestaPresupuesto.RESPONDIDA, importe: 180,
        validoHasta: new Date(Date.now() + MS_POR_DIA), ...extra,
      }],
    });

    it('debería devolver el importe y dejar la oferta aceptada', async () => {
      const doc = respondida();
      repo.porId.mockResolvedValue(doc);

      await expect(service.importeParaReserva('x', USUARIO.toString(), SERVICIO_1.toString())).resolves.toBe(180);
      expect(doc.estado).toBe(EstadoSolicitudPresupuesto.ACEPTADA);
      expect(doc.respuestas[0].estado).toBe(EstadoRespuestaPresupuesto.ACEPTADA);
      expect(doc.save).toHaveBeenCalled();
    });

    it('debería admitir reintentar el pago de un presupuesto ya aceptado', async () => {
      repo.porId.mockResolvedValue(solicitudDoc({
        estado: EstadoSolicitudPresupuesto.ACEPTADA,
        respuestas: [{ servicioId: SERVICIO_1, comercioId: COMERCIO_1, estado: EstadoRespuestaPresupuesto.ACEPTADA, importe: 90 }],
      }));
      await expect(service.importeParaReserva('x', USUARIO.toString(), SERVICIO_1.toString())).resolves.toBe(90);
    });

    it('debería rechazar un presupuesto convertido', async () => {
      const doc = respondida();
      doc.estado = EstadoSolicitudPresupuesto.CONVERTIDA;
      repo.porId.mockResolvedValue(doc);
      await expect(service.importeParaReserva('x', USUARIO.toString(), SERVICIO_1.toString())).rejects.toMatchObject({ statusCode: 409 });
    });

    it('debería rechazar si la empresa no ha respondido o no hay oferta para ese servicio', async () => {
      repo.porId.mockResolvedValue(solicitudDoc());
      await expect(service.importeParaReserva('x', USUARIO.toString(), SERVICIO_1.toString())).rejects.toMatchObject({ statusCode: 409 });
      await expect(service.importeParaReserva('x', USUARIO.toString(), new Types.ObjectId().toString())).rejects.toMatchObject({ statusCode: 409 });
    });

    it('debería rechazar un presupuesto caducado', async () => {
      repo.porId.mockResolvedValue(respondida({ validoHasta: new Date(Date.now() - 1000) }));
      await expect(service.importeParaReserva('x', USUARIO.toString(), SERVICIO_1.toString()))
        .rejects.toThrow('caducado');
    });

    it('debería rechazar con 403 el presupuesto de otro cliente', async () => {
      repo.porId.mockResolvedValue(respondida());
      await expect(service.importeParaReserva('x', new Types.ObjectId().toString(), SERVICIO_1.toString()))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('marcarConvertida', () => {
    it('debería aceptar la oferta pagada, descartar el resto y enlazar la reserva', async () => {
      const doc = solicitudDoc({ estado: EstadoSolicitudPresupuesto.ACEPTADA });
      repo.porId.mockResolvedValue(doc);
      const reservaId = new Types.ObjectId().toString();

      await service.marcarConvertida('x', SERVICIO_2.toString(), reservaId);

      expect(doc.estado).toBe(EstadoSolicitudPresupuesto.CONVERTIDA);
      expect(doc.respuestas.map((r) => r.estado)).toEqual([EstadoRespuestaPresupuesto.DESCARTADA, EstadoRespuestaPresupuesto.ACEPTADA]);
      expect(doc.reservaId?.toString()).toBe(reservaId);
      expect(doc.save).toHaveBeenCalled();
    });

    it('no debería hacer nada si no existe o ya estaba convertida', async () => {
      repo.porId.mockResolvedValue(null);
      await expect(service.marcarConvertida('x', 's', new Types.ObjectId().toString())).resolves.toBeUndefined();

      const doc = solicitudDoc({ estado: EstadoSolicitudPresupuesto.CONVERTIDA });
      repo.porId.mockResolvedValue(doc);
      await service.marcarConvertida('x', 's', new Types.ObjectId().toString());
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('caducarVencidas', () => {
    it('debería caducar las solicitudes abiertas cuyo día ya pasó', async () => {
      const vencidas = [solicitudDoc(), solicitudDoc()];
      repo.caducadas.mockResolvedValue(vencidas);

      await expect(service.caducarVencidas()).resolves.toBe(2);

      expect(repo.caducadas).toHaveBeenCalledWith(expect.any(Date));
      expect(repo.caducadas.mock.calls[0][0].toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect(vencidas.every((s) => s.estado === EstadoSolicitudPresupuesto.CADUCADA)).toBe(true);
    });

    it('debería devolver 0 si no hay nada que caducar', async () => {
      repo.caducadas.mockResolvedValue([]);
      await expect(service.caducarVencidas()).resolves.toBe(0);
    });
  });
});
