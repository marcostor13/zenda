import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';

describe('MailerService', () => {
  it('debería lanzar si SMTP_HOST no está configurado (sin crashear el bootstrap)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    const service = moduleRef.get(MailerService);
    await expect(
      service.enviar({ to: 'x@x.com', subject: 'Asunto', html: '<p>hola</p>' }),
    ).rejects.toThrow('SMTP no configurado');
  });
});
