import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EnvioEmail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío de email. Soporta dos configuraciones (lectura no-eager: si no hay
 * ninguna, el API arranca igual y el envío falla con un mensaje claro):
 *   1. Gmail — `EMAIL_USER` + `EMAIL_PASSWORD` (contraseña de aplicación).
 *   2. SMTP genérico — `SMTP_HOST` (+ SMTP_PORT/SMTP_USER/SMTP_PASS…).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter?: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const emailUser = config.get<string>('EMAIL_USER');
    const emailPassword = config.get<string>('EMAIL_PASSWORD');
    const smtpHost = config.get<string>('SMTP_HOST');

    if (emailUser && emailPassword) {
      // Gmail con contraseña de aplicación (requiere verificación en 2 pasos activa).
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPassword },
      });
      this.from = config.get<string>('EMAIL_FROM') ?? `Doogking <${emailUser}>`;
      return;
    }

    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.get<number>('SMTP_PORT') ?? 587,
        secure: config.get<string>('SMTP_SECURE') === 'true',
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        },
      });
      this.from = config.get<string>('SMTP_FROM') ?? 'Doogking <no-reply@doogking.eu>';
      return;
    }

    this.from = 'Doogking <no-reply@doogking.eu>';
  }

  async enviar(email: EnvioEmail): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email no configurado (falta EMAIL_USER/EMAIL_PASSWORD o SMTP_HOST): no se envió.');
    }
    await this.transporter.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
    });
  }
}
