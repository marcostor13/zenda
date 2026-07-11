import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotificationsRepository } from './notifications.repository';
import { Notificacion } from './notificacion.schema';

describe('NotificationsRepository', () => {
  let repo: NotificationsRepository;
  let model: { create: jest.Mock; updateOne: jest.Mock };

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(undefined) }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsRepository,
        { provide: getModelToken(Notificacion.name), useValue: model },
      ],
    }).compile();

    repo = moduleRef.get(NotificationsRepository);
  });

  it('debería crear la notificación en estado pendiente', async () => {
    await repo.crear({ tipo: 'reserva_confirmada', destinatario: 'x@x.com', asunto: 'A', cuerpo: 'B' });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'pendiente', destinatario: 'x@x.com' }),
    );
  });

  it('debería marcar como enviado', async () => {
    const id = new Types.ObjectId();
    await repo.marcarEnviado(id);
    expect(model.updateOne).toHaveBeenCalledWith({ _id: id }, { estado: 'enviado' });
  });

  it('debería marcar como fallido con el mensaje de error', async () => {
    const id = new Types.ObjectId();
    await repo.marcarFallido(id, 'SMTP no configurado');
    expect(model.updateOne).toHaveBeenCalledWith({ _id: id }, { estado: 'fallido', error: 'SMTP no configurado' });
  });
});
