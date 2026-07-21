import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rol } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { NotificationsRepository } from './notifications.repository';
import { MailerService } from './mailer.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly mailer: MailerService,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  /**
   * Envía la confirmación al cliente y la alerta de nueva reserva al comercio.
   * Nunca lanza: un fallo de email no debe tumbar el webhook de pago que la invoca.
   */
  async notificarReservaConfirmada(reservaId: string): Promise<void> {
    try {
      const reserva = await this.reservaModel.findById(reservaId).lean().exec();
      if (!reserva) return;

      const [servicio, cliente, staffComercio] = await Promise.all([
        this.servicioModel.findById(reserva.servicioId).select('titulo').lean().exec(),
        this.usuarioModel.findById(reserva.usuarioId).select('nombre email').lean().exec(),
        this.usuarioModel
          .find({ comercioId: reserva.comercioId, rol: { $in: [Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF] } })
          .select('email')
          .lean()
          .exec(),
      ]);

      const servicioTitulo = servicio?.titulo ?? 'tu reserva';

      if (cliente) {
        await this.enviarYRegistrar({
          reservaId: reserva._id,
          tipo: 'reserva_confirmada',
          destinatario: cliente.email,
          asunto: `Reserva confirmada — ${reserva.codigo}`,
          cuerpo: this.plantillaClienteConfirmada(cliente.nombre, servicioTitulo, reserva.codigo),
        });
      }

      await Promise.all(
        staffComercio.map((u) =>
          this.enviarYRegistrar({
            reservaId: reserva._id,
            tipo: 'nueva_reserva_comercio',
            destinatario: u.email,
            asunto: `Nueva reserva recibida — ${reserva.codigo}`,
            cuerpo: this.plantillaComercioNuevaReserva(servicioTitulo, reserva.codigo),
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`No se pudo notificar la reserva ${reservaId}`, error);
    }
  }

  /** Envía el correo de verificación de email con el enlace de confirmación. */
  async enviarVerificacionEmail(destinatario: string, nombre: string, url: string): Promise<void> {
    await this.enviarYRegistrar({
      tipo: 'verificacion_email',
      destinatario,
      asunto: 'Verifica tu email — Doogking',
      cuerpo: this.plantillaVerificacion(nombre, url),
    });
  }

  private plantillaVerificacion(nombre: string, url: string): string {
    return `
      <h2>¡Bienvenido a Doogking, ${nombre}!</h2>
      <p>Confirma tu correo para activar tu cuenta y continuar.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#08258B;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">
          Verificar mi email
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:<br><a href="${url}">${url}</a></p>
      <p style="color:#8B9BBC;font-size:13px">El enlace caduca en 24 horas. Si no creaste esta cuenta, ignora este correo.</p>
    `;
  }

  private async enviarYRegistrar(data: Parameters<NotificationsRepository['crear']>[0]): Promise<void> {
    const notif = await this.repo.crear(data);
    try {
      await this.mailer.enviar({ to: data.destinatario, subject: data.asunto, html: data.cuerpo });
      await this.repo.marcarEnviado(notif._id);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      await this.repo.marcarFallido(notif._id, mensaje);
      this.logger.warn(`Email no enviado a ${data.destinatario}: ${mensaje}`);
    }
  }

  private plantillaClienteConfirmada(nombre: string, servicioTitulo: string, codigo: string): string {
    return `
      <h2>¡Reserva confirmada, ${nombre}!</h2>
      <p>Tu reserva de <strong>${servicioTitulo}</strong> ha sido confirmada.</p>
      <p>Código de reserva: <strong>${codigo}</strong></p>
      <p>Gracias por confiar en Doogking — The Royal Treatment for Every Dog.</p>
    `;
  }

  private plantillaComercioNuevaReserva(servicioTitulo: string, codigo: string): string {
    return `
      <h2>Nueva reserva recibida</h2>
      <p>Se ha confirmado una nueva reserva para <strong>${servicioTitulo}</strong>.</p>
      <p>Código de reserva: <strong>${codigo}</strong></p>
      <p>Consulta los detalles en tu panel de comercio.</p>
    `;
  }
}
