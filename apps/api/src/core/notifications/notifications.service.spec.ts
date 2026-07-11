import { Test } from '@nestjs/testing';
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
      ],
    }).compile();

    const svc = moduleRef.get(NotificationsService);
    await expect(svc.notificarReservaConfirmada('no-existe')).resolves.toBeUndefined();
  });
});
