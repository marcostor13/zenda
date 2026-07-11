import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EnvioEmail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío de email vía SMTP. Lectura no-eager: sin SMTP_HOST configurado el API
 * arranca igual y el envío simplemente no ocurre (se registra en el outbox
 * como fallido con un mensaje claro), en vez de crashear el bootstrap.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    if (!host) return;

    this.transporter = nodemailer.createTransport({
      host,
      port: config.get<number>('SMTP_PORT') ?? 587,
      secure: config.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async enviar(email: EnvioEmail): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP no configurado (falta SMTP_HOST): el email no se envió.');
    }
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? 'Doogking <no-reply@doogking.eu>',
      to: email.to,
      subject: email.subject,
      html: email.html,
    });
  }
}
