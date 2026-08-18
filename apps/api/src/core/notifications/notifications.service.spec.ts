import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { MailerService } from './mailer.service';
import { Reserva } from '../bookings/reserva.schema';
import { Servicio } from '../catalog/servicio.schema';
import { Usuario } from '../users/usuario.schema';

function leanExec<T>(val: T) {
  return { select: () => ({ lean: () => ({ exec: () => Promise.resolve(val) }) }) };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<NotificationsRepository>;
  let mailer: jest.Mocked<MailerService>;

  const reservaId = new Types.ObjectId();
  const usuarioId = new Types.ObjectId();
  const comercioId = new Types.ObjectId();
  const servicioId = new Types.ObjectId();

  const reservaMock = {
    _id: reservaId,
    usuarioId,
    comercioId,
    servicioId,
    codigo: 'RES-ABC123',
  };

  beforeEach(async () => {
    const reservaModel = { findById: () => ({ lean: () => ({ exec: () => Promise.resolve(reservaMock) }) }) };
    const servicioModel = { findById: () => leanExec({ titulo: 'Suite Canina Madrid' }) };
    const usuarioModel = {
      findById: () => leanExec({ nombre: 'María', email: 'maria@test.com' }),
      find: () => ({
        select: () => ({
          lean: () => ({
            exec: () => Promise.resolve([{ email: 'comercio@test.com' }]),
          }),
        }),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NotificationsRepository,
          useValue: {
            crear: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
            marcarEnviado: jest.fn().mockResolvedValue(undefined),
            marcarFallido: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: MailerService, useValue: { enviar: jest.fn().mockResolvedValue(undefined) } },
        { provide: getModelToken(Reserva.name), useValue: reservaModel },
        { provide: getModelToken(Servicio.name), useValue: servicioModel },
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        // Las plantillas nuevas componen enlaces con APP_URL.
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://doogking.test') } },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
    repo = moduleRef.get(NotificationsRepository);
    mailer = moduleRef.get(MailerService);
  });

  it('debería notificar al cliente y al staff del comercio', async () => {
    await service.notificarReservaConfirmada(reservaId.toString());

    expect(mailer.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'maria@test.com', subject: expect.stringContaining('RES-ABC123') }),
    );
    expect(mailer.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'comercio@test.com' }),
    );
    expect(repo.marcarEnviado).toHaveBeenCalledTimes(2);
  });

  it('debería registrar el fallo sin lanzar si el mailer falla', async () => {
    mailer.enviar.mockRejectedValue(new Error('SMTP no configurado'));

    await expect(service.notificarReservaConfirmada(reservaId.toString())).resolves.toBeUndefined();
    expect(repo.marcarFallido).toHaveBeenCalledWith(expect.anything(), 'SMTP no configurado');
  });

  it('no debería lanzar si la reserva no existe', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: { crear: jest.fn(), marcarEnviado: jest.fn(), marcarFallido: jest.fn() } },
        { provide: MailerService, useValue: { enviar: jest.fn() } },
        { provide: getModelToken(Reserva.name), useValue: { findById: () => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }) } },
        { provide: getModelToken(Servicio.name), useValue: {} },
        { provide: getModelToken(Usuario.name), useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://doogking.test') } },
      ],
    }).compile();

    const svc = moduleRef.get(NotificationsService);
    await expect(svc.notificarReservaConfirmada('no-existe')).resolves.toBeUndefined();
  });

  describe('notificarAjusteSolicitado', () => {
    /** Reconstruye el servicio con la reserva y el cliente que pida el test. */
    async function conReserva(reserva: unknown, cliente: unknown = { nombre: 'María', email: 'maria@test.com' }) {
      const moduleRef = await Test.createTestingModule({
        providers: [
          NotificationsService,
          {
            provide: NotificationsRepository,
            useValue: {
              crear: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
              marcarEnviado: jest.fn().mockResolvedValue(undefined),
              marcarFallido: jest.fn().mockResolvedValue(undefined),
            },
          },
          { provide: MailerService, useValue: { enviar: jest.fn().mockResolvedValue(undefined) } },
          {
            provide: getModelToken(Reserva.name),
            useValue: { findById: () => ({ lean: () => ({ exec: () => Promise.resolve(reserva) }) }) },
          },
          { provide: getModelToken(Servicio.name), useValue: { findById: () => leanExec({ titulo: 'X' }) } },
          {
            provide: getModelToken(Usuario.name),
            useValue: { findById: () => leanExec(cliente), find: () => leanExec([]) },
          },
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://doogking.test') } },
        ],
      }).compile();
      return {
        svc: moduleRef.get(NotificationsService),
        mailer: moduleRef.get(MailerService) as jest.Mocked<MailerService>,
      };
    }

    const conSuplementos = {
      _id: reservaId, usuarioId, codigo: 'RES-1', montoTotal: 100, montoAjustado: 130,
      suplementos: [
        { concepto: 'Nudos severos', monto: 15, motivo: 'manto muy enredado' },
        { concepto: 'Uñas', monto: 15 },
      ],
    };

    it('debería detallar cada suplemento con su importe, no un mensaje genérico', async () => {
      // El cliente tiene que ver exactamente por qué sube el importe.
      const { svc, mailer } = await conReserva(conSuplementos);

      await svc.notificarAjusteSolicitado(reservaId.toString());

      const html = mailer.enviar.mock.calls[0][0].html;
      expect(html).toContain('Nudos severos');
      expect(html).toContain('15.00');
      expect(html).toContain('manto muy enredado');
      expect(html).toContain('Uñas');
    });

    it('debería incluir el código de la reserva en el asunto', async () => {
      const { svc, mailer } = await conReserva(conSuplementos);

      await svc.notificarAjusteSolicitado(reservaId.toString());

      expect(mailer.enviar.mock.calls[0][0].subject).toContain('RES-1');
    });

    it('debería caer a un texto genérico si no hay suplementos detallados', async () => {
      const { svc, mailer } = await conReserva({ ...conSuplementos, suplementos: [] });

      await svc.notificarAjusteSolicitado(reservaId.toString());

      expect(mailer.enviar.mock.calls[0][0].html).toContain('necesidades adicionales');
    });

    it('no debería lanzar si la reserva no existe', async () => {
      const { svc, mailer } = await conReserva(null);

      await expect(svc.notificarAjusteSolicitado('no-existe')).resolves.toBeUndefined();
      expect(mailer.enviar).not.toHaveBeenCalled();
    });

    it('no debería lanzar si el cliente ya no existe', async () => {
      const { svc, mailer } = await conReserva(conSuplementos, null);

      await expect(svc.notificarAjusteSolicitado(reservaId.toString())).resolves.toBeUndefined();
      expect(mailer.enviar).not.toHaveBeenCalled();
    });
  });

  describe('campañas de crecimiento', () => {
    it('debería enviar la solicitud de valoración con su enlace único', async () => {
      await service.solicitarValoracion({
        destinatario: 'ana@test.com', nombre: 'Ana', codigoReserva: 'RES-9',
        token: 'tok-1', esRecordatorio: false,
      });

      const enviado = mailer.enviar.mock.calls[0][0];
      expect(enviado.to).toBe('ana@test.com');
      expect(enviado.subject).toContain('Ana');
      expect(enviado.html).toContain('https://doogking.test/valorar/tok-1');
    });

    it('debería cambiar el asunto en el recordatorio, para no repetir el mismo correo', async () => {
      await service.solicitarValoracion({
        destinatario: 'ana@test.com', nombre: 'Ana', codigoReserva: 'RES-9',
        token: 'tok-1', esRecordatorio: true,
      });

      expect(mailer.enviar.mock.calls[0][0].subject).toContain('RES-9');
    });

    it('debería avisar de la reserva a medias indicando dónde se quedó', async () => {
      await service.recuperarReserva({
        destinatario: 'ana@test.com', nombre: 'Ana', paso: 'pago', vertical: 'alojamiento',
      });

      const enviado = mailer.enviar.mock.calls[0][0];
      expect(enviado.subject).toContain('se quedó a medias');
      expect(enviado.html).toContain('Ana');
    });

    it('debería funcionar aunque no se sepa el paso ni el vertical', async () => {
      await expect(
        service.recuperarReserva({ destinatario: 'ana@test.com', nombre: 'Ana' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('enviarVerificacionEmail', () => {
    it('debería enviar el enlace de verificación al usuario', async () => {
      await service.enviarVerificacionEmail('ana@test.com', 'Ana', 'https://doogking.test/verificar?token=t');

      const enviado = mailer.enviar.mock.calls[0][0];
      expect(enviado.to).toBe('ana@test.com');
      expect(enviado.html).toContain('https://doogking.test/verificar?token=t');
    });

    it('debería usar un texto distinto para el alta de un comercio', async () => {
      await service.enviarVerificacionEmail('c@test.com', 'Canina', 'https://x/v', true);
      const comercio = mailer.enviar.mock.calls[0][0].html;

      mailer.enviar.mockClear();
      await service.enviarVerificacionEmail('a@test.com', 'Ana', 'https://x/v', false);
      const cliente = mailer.enviar.mock.calls[0][0].html;

      expect(comercio).not.toBe(cliente);
    });

    it('debería registrar el fallo sin lanzar si el envío falla', async () => {
      mailer.enviar.mockRejectedValue(new Error('SMTP caído'));

      await expect(service.enviarVerificacionEmail('a@test.com', 'Ana', 'https://x/v'))
        .resolves.toBeUndefined();
      expect(repo.marcarFallido).toHaveBeenCalledWith(expect.anything(), 'SMTP caído');
    });
  });
});
