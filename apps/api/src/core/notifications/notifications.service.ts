import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private readonly config: ConfigService,
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

  /**
   * Avisa al cliente de que el comercio pide un ajuste de precio. Sin este
   * correo el cliente solo se enteraría si entra por su cuenta a la reserva, y
   * la regla del negocio es que ningún coste se aplica sin su aprobación.
   * Nunca lanza: el ajuste ya se registró y un fallo de email no debe revertirlo.
   */
  async notificarAjusteSolicitado(reservaId: string): Promise<void> {
    try {
      const reserva = await this.reservaModel.findById(reservaId).lean().exec();
      if (!reserva) return;

      const cliente = await this.usuarioModel
        .findById(reserva.usuarioId).select('nombre email').lean().exec();
      if (!cliente) return;

      // El motivo se compone de los suplementos propuestos: el cliente debe ver
      // exactamente por qué sube el importe, no un mensaje genérico.
      const motivo = reserva.suplementos
        .map((s) => `${s.concepto} (+${s.monto.toFixed(2)} €)${s.motivo ? ` — ${s.motivo}` : ''}`)
        .join('<br>');

      await this.enviarYRegistrar({
        reservaId: reserva._id,
        tipo: 'ajuste_solicitado',
        destinatario: cliente.email,
        asunto: `Cambio de importe en tu reserva ${reserva.codigo}`,
        cuerpo: this.plantillaAjusteSolicitado(
          cliente.nombre,
          reserva.codigo,
          reserva.montoTotal,
          reserva.montoAjustado ?? reserva.montoTotal,
          motivo || 'El profesional ha detectado necesidades adicionales en recepción.',
        ),
      });
    } catch (error) {
      this.logger.error(`No se pudo notificar el ajuste de la reserva ${reservaId}`, error);
    }
  }

  private plantillaAjusteSolicitado(
    nombre: string,
    codigo: string,
    importeInicial: number,
    importeNuevo: number,
    motivo: string,
  ): string {
    return `
      <h2>Hola ${nombre}, tu reserva ${codigo} necesita tu confirmación</h2>
      <p>El profesional propone un nuevo importe para el servicio:</p>
      <p style="font-size:18px">
        <span style="color:#8B9BBC;text-decoration:line-through">${importeInicial.toFixed(2)} €</span>
        &nbsp;→&nbsp;
        <strong style="color:#08258B">${importeNuevo.toFixed(2)} €</strong>
      </p>
      <p><strong>Motivo:</strong> ${motivo}</p>
      <p>No se te cobrará nada hasta que lo aceptes. Si lo rechazas, se te reembolsa el importe
         original menos el cargo mínimo de gestión.</p>
      <p style="color:#8B9BBC;font-size:13px">Entra en «Mis reservas» en Doogking para aceptar o rechazar el cambio.</p>
    `;
  }

  /**
   * Solicitud de reseña con **enlace único** a la reserva concreta (HU-053):
   * el usuario no tiene que buscar cuál valorar, y el token nos dice si abrió.
   */
  async solicitarValoracion(params: {
    destinatario: string;
    nombre: string;
    codigoReserva: string;
    token: string;
    esRecordatorio: boolean;
  }): Promise<void> {
    const url = `${this.urlBase()}/valorar/${params.token}`;

    await this.enviarYRegistrar({
      tipo: 'solicitud_valoracion',
      destinatario: params.destinatario,
      asunto: params.esRecordatorio
        ? `¿Cómo fue tu experiencia? — ${params.codigoReserva}`
        : `Cuéntanos qué tal fue, ${params.nombre}`,
      cuerpo: this.plantillaValoracion(
        params.nombre, params.codigoReserva, url, params.esRecordatorio, params.token,
      ),
    });
  }

  /** Aviso de reserva a medias, con el paso donde se quedó (HU-056). */
  async recuperarReserva(params: {
    destinatario: string;
    nombre: string;
    paso?: string;
    vertical?: string;
  }): Promise<void> {
    await this.enviarYRegistrar({
      tipo: 'recuperacion_reserva',
      destinatario: params.destinatario,
      asunto: 'Tu reserva se quedó a medias',
      cuerpo: this.plantillaRecuperacion(params.nombre, params.paso, params.vertical),
    });
  }

  private plantillaValoracion(
    nombre: string,
    codigo: string,
    url: string,
    esRecordatorio: boolean,
    token: string,
  ): string {
    return `
      <h2>${esRecordatorio ? `¿Nos cuentas, ${nombre}?` : `¡Gracias por confiar en nosotros, ${nombre}!`}</h2>
      <p>Tu reserva <strong>${codigo}</strong> ya está completada. Tu opinión ayuda a otros dueños
         a elegir bien, y al profesional a mejorar.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#FBAE17;color:#00135D;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700">
          Valorar en 30 segundos
        </a>
      </p>
      <p style="color:#8B9BBC;font-size:13px">
        Solo se puede valorar una vez por reserva.${esRecordatorio ? ' Este es el último recordatorio que te enviamos.' : ''}
      </p>
      <img src="${this.apiUrl()}/eventos/valoracion/${token}/pixel.gif"
           width="1" height="1" alt="" style="display:none">
    `;
  }

  private plantillaRecuperacion(nombre: string, paso?: string, vertical?: string): string {
    const donde = paso ? `en el paso de <strong>${paso}</strong>` : 'a mitad';

    return `
      <h2>Hola ${nombre}, tu reserva se quedó ${donde}</h2>
      <p>Seguimos guardando lo que habías elegido${vertical ? ` en ${vertical}` : ''}.
         Retomarla te llevará menos de un minuto.</p>
      <p style="margin:24px 0">
        <a href="${this.urlBase()}/reservas" style="background:#08258B;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">
          Retomar mi reserva
        </a>
      </p>
      <p style="color:#8B9BBC;font-size:13px">
        Recibes este aviso porque aceptaste comunicaciones comerciales. Puedes desactivarlas
        desde tu perfil cuando quieras.
      </p>
    `;
  }

  private urlBase(): string {
    return this.config.get<string>('APP_URL') ?? 'https://doogking.com';
  }

  /** Base del API: el píxel de apertura lo sirve el backend, no la web. */
  private apiUrl(): string {
    return this.config.get<string>('API_URL') ?? 'https://api.doogking.com';
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
