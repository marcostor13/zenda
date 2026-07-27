import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EstadoSolicitudValoracion, ReservaEstado } from 'shared';
import { GrowthService } from './growth.service';
import { EventosService } from './eventos.service';
import { SolicitudValoracion } from './solicitud-valoracion.schema';
import { Reserva } from '../bookings/reserva.schema';
import { Usuario } from '../users/usuario.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { DomainException } from '../../shared/exceptions/domain.exception';

const reservaCompletada = (estado = ReservaEstado.COMPLETADA) => ({
  _id: new Types.ObjectId(),
  usuarioId: new Types.ObjectId(),
  comercioId: new Types.ObjectId(),
  codigo: 'RES-AAAA1111',
  estado,
});

describe('GrowthService', () => {
  let service: GrowthService;
  let reservaModel: { find: jest.Mock; findById: jest.Mock };
  let usuarioModel: { findById: jest.Mock };
  let solicitudModel: {
    find: jest.Mock; exists: jest.Mock; create: jest.Mock;
    findOne: jest.Mock; updateOne: jest.Mock; aggregate: jest.Mock;
  };
  let notificationsService: {
    solicitarValoracion: jest.Mock; recuperarReserva: jest.Mock;
  };
  let pushService: { enviarA: jest.Mock };
  let eventosService: { detectarAbandonos: jest.Mock; registrar: jest.Mock };

  const conReservas = (reservas: unknown[]): void => {
    reservaModel.find.mockReturnValue({
      sort: () => ({ limit: () => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(reservas) }) }) }) }),
    });
  };

  const conUsuario = (usuario: unknown): void => {
    usuarioModel.findById.mockReturnValue({
      select: () => ({ lean: () => ({ exec: () => Promise.resolve(usuario) }) }),
    });
  };

  beforeEach(async () => {
    reservaModel = {
      find: jest.fn(),
      findById: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: () => Promise.resolve({ codigo: 'RES-AAAA1111' }) }) }),
      }),
    };
    usuarioModel = { findById: jest.fn() };
    solicitudModel = {
      find: jest.fn().mockReturnValue({ limit: () => ({ exec: () => Promise.resolve([]) }) }),
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) =>
        Promise.resolve({ ...d, save: jest.fn().mockResolvedValue(undefined) }),
      ),
      findOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
      updateOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) }),
      aggregate: jest.fn().mockReturnValue({ exec: () => Promise.resolve([]) }),
    };
    notificationsService = {
      solicitarValoracion: jest.fn().mockResolvedValue(undefined),
      recuperarReserva: jest.fn().mockResolvedValue(undefined),
    };
    pushService = { enviarA: jest.fn().mockResolvedValue(undefined) };
    eventosService = {
      detectarAbandonos: jest.fn().mockResolvedValue([]),
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthService,
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: getModelToken(SolicitudValoracion.name), useValue: solicitudModel },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PushService, useValue: pushService },
        { provide: EventosService, useValue: eventosService },
      ],
    }).compile();

    service = module.get(GrowthService);
    conUsuario({ nombre: 'Marta', email: 'marta@x.com' });
  });

  describe('solicitarValoracionesPendientes', () => {
    it('debería enviar una solicitud con enlace único por reserva completada', async () => {
      conReservas([reservaCompletada()]);

      const resumen = await service.solicitarValoracionesPendientes();

      expect(resumen.enviadas).toBe(1);
      const enviado = notificationsService.solicitarValoracion.mock.calls[0][0];
      expect(enviado.token).toHaveLength(48);
      expect(enviado.esRecordatorio).toBe(false);
    });

    it('no debería reenviar si ya se pidió para esa reserva', async () => {
      conReservas([reservaCompletada()]);
      solicitudModel.exists.mockResolvedValue({ _id: 'ya' });

      const resumen = await service.solicitarValoracionesPendientes();

      expect(resumen.enviadas).toBe(0);
      expect(resumen.omitidas).toBe(1);
      expect(notificationsService.solicitarValoracion).not.toHaveBeenCalled();
    });

    it('debería marcar la solicitud como fallida si el correo no sale', async () => {
      conReservas([reservaCompletada()]);
      notificationsService.solicitarValoracion.mockRejectedValue(new Error('SMTP caído'));

      const resumen = await service.solicitarValoracionesPendientes();

      expect(resumen.enviadas).toBe(0);
      const creada = await solicitudModel.create.mock.results[0].value;
      expect(creada.estado).toBe(EstadoSolicitudValoracion.FALLIDA);
    });

    it('no debería pedir reseña de un servicio que nunca se prestó', async () => {
      conReservas([reservaCompletada(ReservaEstado.CANCELADA)]);

      const resumen = await service.solicitarValoracionesPendientes();

      expect(resumen.enviadas).toBe(0);
      expect(notificationsService.solicitarValoracion).not.toHaveBeenCalled();
    });
  });

  describe('enviarRecordatorios', () => {
    it('debería enviar un único recordatorio y marcarlo', async () => {
      const solicitud = {
        usuarioId: new Types.ObjectId(), reservaId: new Types.ObjectId(),
        token: 'tok', recordatorioEnviado: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      solicitudModel.find.mockReturnValue({ limit: () => ({ exec: () => Promise.resolve([solicitud]) }) });

      const resumen = await service.enviarRecordatorios();

      expect(resumen.enviadas).toBe(1);
      expect(solicitud.recordatorioEnviado).toBe(true);
      expect(notificationsService.solicitarValoracion.mock.calls[0][0].esRecordatorio).toBe(true);
    });

    it('debería pedir solo las que llevan 3 días sin respuesta y sin recordar', async () => {
      await service.enviarRecordatorios();

      const filtro = solicitudModel.find.mock.calls[0][0] as Record<string, unknown>;
      expect(filtro['recordatorioEnviado']).toBe(false);
      expect(filtro['enviadaAt']).toHaveProperty('$lte');
    });
  });

  describe('recuperarAbandonos', () => {
    const abandono = { usuarioId: new Types.ObjectId().toString(), sesionId: 's1', ultimoPaso: 'pago' };

    it('no debería escribir a quien no aceptó comunicaciones comerciales', async () => {
      eventosService.detectarAbandonos.mockResolvedValue([abandono]);
      conUsuario({ nombre: 'Marta', email: 'marta@x.com', aceptaMarketing: false });

      const resumen = await service.recuperarAbandonos();

      expect(resumen.enviadas).toBe(0);
      expect(notificationsService.recuperarReserva).not.toHaveBeenCalled();
    });

    it('debería escribir a quien sí lo aceptó, con el paso donde se quedó', async () => {
      eventosService.detectarAbandonos.mockResolvedValue([abandono]);
      conUsuario({ nombre: 'Marta', email: 'marta@x.com', aceptaMarketing: true });

      const resumen = await service.recuperarAbandonos();

      expect(resumen.enviadas).toBe(1);
      expect(notificationsService.recuperarReserva.mock.calls[0][0].paso).toBe('pago');
    });

    it('debería anotar el aviso para no repetirlo en la siguiente tanda', async () => {
      eventosService.detectarAbandonos.mockResolvedValue([abandono]);
      conUsuario({ nombre: 'Marta', email: 'marta@x.com', aceptaMarketing: true });

      await service.recuperarAbandonos();

      expect(eventosService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ payload: { avisoEnviado: true } }),
      );
    });

    it('debería omitir los abandonos de visitantes sin identificar', async () => {
      eventosService.detectarAbandonos.mockResolvedValue([{ sesionId: 's2' }]);

      const resumen = await service.recuperarAbandonos();

      expect(resumen.omitidas).toBe(1);
    });
  });

  describe('abrirPorToken', () => {
    it('debería lanzar 404 con un token inventado', async () => {
      await expect(service.abrirPorToken('inventado')).rejects.toThrow(DomainException);
    });

    it('debería rechazar un enlace ya usado', async () => {
      solicitudModel.findOne.mockReturnValue({
        exec: () => Promise.resolve({ estado: EstadoSolicitudValoracion.COMPLETADA }),
      });

      await expect(service.abrirPorToken('tok')).rejects.toThrow(DomainException);
    });

    it('debería marcar la apertura la primera vez', async () => {
      const solicitud = {
        estado: EstadoSolicitudValoracion.ENVIADA,
        reservaId: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(undefined),
      };
      solicitudModel.findOne.mockReturnValue({ exec: () => Promise.resolve(solicitud) });

      await service.abrirPorToken('tok');

      expect(solicitud.estado).toBe(EstadoSolicitudValoracion.ABIERTA);
      expect(solicitud.save).toHaveBeenCalled();
    });
  });

  describe('seguimiento', () => {
    it('debería calcular la tasa de conversión de la campaña', async () => {
      solicitudModel.aggregate.mockReturnValue({
        exec: () => Promise.resolve([
          { _id: EstadoSolicitudValoracion.ENVIADA, n: 6 },
          { _id: EstadoSolicitudValoracion.COMPLETADA, n: 4 },
        ]),
      });

      const seguimiento = await service.seguimiento();

      expect(seguimiento.total).toBe(10);
      expect(seguimiento.completadas).toBe(4);
      expect(seguimiento.tasaConversion).toBe(40);
    });

    it('no debería dividir por cero sin solicitudes', async () => {
      await expect(service.seguimiento()).resolves.toMatchObject({ total: 0, tasaConversion: 0 });
    });
  });
});
