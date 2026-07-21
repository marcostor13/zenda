import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';

jest.mock('nodemailer');

const nodemailerMock = nodemailer as jest.Mocked<typeof nodemailer>;

const construir = async (valores: Record<string, string | undefined>): Promise<MailerService> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MailerService,
      { provide: ConfigService, useValue: { get: jest.fn((clave: string) => valores[clave]) } },
    ],
  }).compile();
  return moduleRef.get(MailerService);
};

describe('MailerService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('debería lanzar si no hay ninguna configuración de email (sin crashear el bootstrap)', async () => {
    const service = await construir({});
    await expect(
      service.enviar({ to: 'x@x.com', subject: 'Asunto', html: '<p>hola</p>' }),
    ).rejects.toThrow('Email no configurado');
  });

  it('debería usar Gmail cuando hay EMAIL_USER y EMAIL_PASSWORD', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailerMock.createTransport as jest.Mock).mockReturnValue({ sendMail } as never);

    const service = await construir({ EMAIL_USER: 'doog@gmail.com', EMAIL_PASSWORD: 'app-pass' });
    await service.enviar({ to: 'cliente@x.com', subject: 'Hola', html: '<p>hi</p>' });

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'gmail', auth: { user: 'doog@gmail.com', pass: 'app-pass' } }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Doogking <doog@gmail.com>', to: 'cliente@x.com' }),
    );
  });

  it('debería usar SMTP genérico cuando hay SMTP_HOST (sin credenciales de Gmail)', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailerMock.createTransport as jest.Mock).mockReturnValue({ sendMail } as never);

    const service = await construir({ SMTP_HOST: 'smtp.mailgun.org', SMTP_USER: 'u', SMTP_PASS: 'p' });
    await service.enviar({ to: 'cliente@x.com', subject: 'Hola', html: '<p>hi</p>' });

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.mailgun.org' }),
    );
    expect(sendMail).toHaveBeenCalled();
  });
});
