import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EnvioEmail {
  to: string;
  subject: string;
  html: string;
  /** Sobrescribe el nombre de remitente para este envío (mantiene el email real). */
  nombreRemitente?: string;
  /** Adjuntos pequeños, como el evento de calendario de una reserva. */
  adjuntos?: AdjuntoEmail[];
}

export interface AdjuntoEmail {
  nombre: string;
  contenido: string | Buffer;
  tipo?: string;
}

const API_RESEND = 'https://api.resend.com/emails';

/** Buzón desde el que sale todo el correo transaccional de la plataforma. */
export const REMITENTE_POR_DEFECTO = 'hola@doogking.com';
const NOMBRE_POR_DEFECTO = 'Doogking';

/**
 * Envío de email transaccional a través de **Resend**.
 *
 * Sustituye al envío por SMTP/Gmail con nodemailer. El motivo no es el
 * protocolo sino la entregabilidad: un correo de verificación que acaba en spam
 * es una cuenta que no se activa, y una cuenta de Gmail con contraseña de
 * aplicación no tiene ni SPF/DKIM propios del dominio, ni reputación, ni forma
 * de saber si el mensaje llegó. Resend firma con el dominio verificado y deja
 * el registro de cada envío.
 *
 * Se llama a la API con `fetch`, sin SDK: es un único POST con cuatro campos, y
 * es como se integran aquí el resto de servicios externos por HTTP (ver
 * `core/ai-search` y `core/planificador`).
 *
 * **Requisito de despliegue**: el dominio `doogking.com` tiene que estar
 * verificado en Resend (registros DNS de SPF y DKIM). Sin eso Resend sólo
 * acepta envíos a la dirección de la cuenta, y el resto responde 403.
 *
 * Lectura no-eager de la clave: sin `RESEND_API_KEY` el API arranca igual y el
 * envío falla con un mensaje claro, que `NotificationsService` registra como
 * 'fallido' en el outbox en vez de perderlo.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly apiKey?: string;
  private readonly emailRemitente: string;
  private readonly nombreRemitente: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY');
    this.emailRemitente = config.get<string>('EMAIL_FROM') ?? REMITENTE_POR_DEFECTO;
    this.nombreRemitente = config.get<string>('EMAIL_FROM_NOMBRE') ?? NOMBRE_POR_DEFECTO;

    if (!this.apiKey) {
      this.logger.warn(
        'Resend sin configurar (falta RESEND_API_KEY): no saldrá ningún correo. '
        + 'Los intentos quedan registrados como fallidos en la colección de notificaciones.',
      );
    }
  }

  get estaConfigurado(): boolean {
    return Boolean(this.apiKey);
  }

  async enviar(email: EnvioEmail): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Email no configurado (falta RESEND_API_KEY): no se envió.');
    }

    const respuesta = await fetch(API_RESEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.remitente(email.nombreRemitente),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        ...(email.adjuntos?.length
          ? {
              attachments: email.adjuntos.map((a) => ({
                filename: a.nombre,
                content: Buffer.from(a.contenido).toString('base64'),
                ...(a.tipo ? { content_type: a.tipo } : {}),
              })),
            }
          : {}),
      }),
    });

    if (!respuesta.ok) {
      throw new Error(`Resend rechazó el envío (${respuesta.status}): ${await this.motivo(respuesta)}`);
    }
  }

  /**
   * `Nombre <correo>`. El nombre se puede cambiar por envío —«Doogking | Equipo
   * de verificación»— pero la dirección no: es la del dominio verificado, y
   * mandar desde otra haría que Resend rechazara el correo.
   */
  private remitente(nombre?: string): string {
    return `${nombre ?? this.nombreRemitente} <${this.emailRemitente}>`;
  }

  /**
   * Resend explica el rechazo en el cuerpo, y ahí está lo único accionable: si
   * el dominio no está verificado, si la clave no vale o si se ha superado la
   * cuota. Sin esto, en el outbox sólo quedaba un número de estado.
   */
  private async motivo(respuesta: Response): Promise<string> {
    try {
      const cuerpo = await respuesta.json() as { message?: string; name?: string };
      return cuerpo.message ?? cuerpo.name ?? respuesta.statusText;
    } catch {
      return respuesta.statusText;
    }
  }
}
