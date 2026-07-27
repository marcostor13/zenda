import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { EstadoSolicitudValoracion, ReservaEstado, TipoEvento } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { EventosService } from './eventos.service';
import { SolicitudValoracion, SolicitudValoracionDocument } from './solicitud-valoracion.schema';

/** Estados que **excluyen** pedir reseña: no hubo servicio que valorar (HU-053). */
const ESTADOS_EXCLUIDOS = [
  ReservaEstado.CANCELADA,
  ReservaEstado.REEMBOLSADA,
  ReservaEstado.EN_DISPUTA,
  ReservaEstado.NO_SHOW,
];

const DIAS_RECORDATORIO = 3;
const MAX_POR_TANDA = 200;

export interface ResumenTanda {
  procesadas: number;
  enviadas: number;
  omitidas: number;
}

export interface SeguimientoValoraciones {
  total: number;
  enviadas: number;
  abiertas: number;
  completadas: number;
  fallidas: number;
  /** Porcentaje de solicitudes que acabaron en reseña. */
  tasaConversion: number;
}

/**
 * Crecimiento: solicitud automática de reseñas y recuperación de abandonos.
 *
 * Las tandas se disparan desde fuera (cron de la plataforma → endpoint de
 * admin), **no desde un temporizador en proceso**: con más de una instancia del
 * API, un `setInterval` enviaría el mismo correo tantas veces como instancias
 * haya. Un disparador externo se ejecuta una sola vez.
 */
@Injectable()
export class GrowthService {
  private readonly logger = new Logger(GrowthService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(SolicitudValoracion.name)
    private readonly solicitudModel: Model<SolicitudValoracionDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
    private readonly eventosService: EventosService,
  ) {}

  /**
   * Pide reseña de todo lo completado que aún no la tenga pedida. Idempotente
   * por el índice único sobre `reservaId`: repetir la tanda no reenvía nada.
   */
  async solicitarValoracionesPendientes(): Promise<ResumenTanda> {
    const completadas = await this.reservaModel
      .find({ estado: ReservaEstado.COMPLETADA })
      .sort({ updatedAt: -1 })
      .limit(MAX_POR_TANDA)
      .select('_id usuarioId comercioId codigo estado')
      .lean()
      .exec();

    let enviadas = 0;
    let omitidas = 0;

    for (const reserva of completadas) {
      const yaExiste = await this.solicitudModel.exists({ reservaId: reserva._id });
      if (yaExiste) {
        omitidas++;
        continue;
      }

      const enviada = await this.crearYEnviar(reserva);
      enviada ? enviadas++ : omitidas++;
    }

    return { procesadas: completadas.length, enviadas, omitidas };
  }

  /** Único recordatorio, a los 3 días, solo a quien no ha respondido. */
  async enviarRecordatorios(): Promise<ResumenTanda> {
    const limite = new Date(Date.now() - DIAS_RECORDATORIO * 24 * 60 * 60 * 1000);

    const pendientes = await this.solicitudModel
      .find({
        estado: { $in: [EstadoSolicitudValoracion.ENVIADA, EstadoSolicitudValoracion.ABIERTA] },
        recordatorioEnviado: false,
        enviadaAt: { $lte: limite },
      })
      .limit(MAX_POR_TANDA)
      .exec();

    let enviadas = 0;

    for (const solicitud of pendientes) {
      const usuario = await this.usuarioModel
        .findById(solicitud.usuarioId).select('nombre email').lean().exec();
      if (!usuario) continue;

      const reserva = await this.reservaModel
        .findById(solicitud.reservaId).select('codigo').lean().exec();

      await this.notificationsService.solicitarValoracion({
        destinatario: usuario.email,
        nombre: usuario.nombre,
        codigoReserva: reserva?.codigo ?? '',
        token: solicitud.token,
        esRecordatorio: true,
      });

      solicitud.recordatorioEnviado = true;
      solicitud.recordatorioAt = new Date();
      await solicitud.save();
      enviadas++;
    }

    return { procesadas: pendientes.length, enviadas, omitidas: pendientes.length - enviadas };
  }

  /**
   * Avisa a quien dejó una reserva a medias (HU-056). Solo a usuarios
   * identificados y **solo si aceptaron marketing**: sin consentimiento no hay
   * envío, por mucho que el abandono esté detectado (RGPD).
   */
  async recuperarAbandonos(): Promise<ResumenTanda> {
    const abandonos = await this.eventosService.detectarAbandonos();

    let enviadas = 0;
    let omitidas = 0;

    for (const abandono of abandonos) {
      if (!abandono.usuarioId) { omitidas++; continue; }

      const usuario = await this.usuarioModel
        .findById(abandono.usuarioId).select('nombre email aceptaMarketing').lean().exec();

      if (!usuario?.aceptaMarketing) { omitidas++; continue; }

      await this.notificationsService.recuperarReserva({
        destinatario: usuario.email,
        nombre: usuario.nombre,
        paso: abandono.ultimoPaso,
        vertical: abandono.vertical,
      });

      // Push además del correo, si el usuario tiene la app. No se espera ni se
      // comprueba: es un canal adicional, no la vía principal.
      void this.pushService.enviarA(abandono.usuarioId, {
        titulo: 'Tu reserva se quedó a medias',
        cuerpo: 'Seguimos guardando lo que habías elegido. Retomarla te llevará un minuto.',
        ruta: '/reservas',
      });

      // Se marca el aviso como evento para no repetirlo en la próxima tanda.
      await this.eventosService.registrar({
        tipo: TipoEvento.RESERVA_ABANDONADA,
        usuarioId: abandono.usuarioId,
        sesionId: abandono.sesionId,
        servicioId: abandono.servicioId,
        vertical: abandono.vertical,
        paso: abandono.ultimoPaso,
        payload: { avisoEnviado: true },
      });
      enviadas++;
    }

    return { procesadas: abandonos.length, enviadas, omitidas };
  }

  /**
   * Marca la apertura desde el píxel del correo. Es **nuestro** píxel, no el de
   * un proveedor: así el dato existe con cualquier SMTP y no depende de
   * contratar un servicio de email con webhooks.
   *
   * Nunca lanza: si el token no existe, el píxel se sirve igual. Un error aquí
   * rompería la imagen del correo del cliente.
   */
  async registrarApertura(token: string): Promise<void> {
    try {
      await this.solicitudModel
        .updateOne(
          // No se pisa una solicitud ya completada: valorar es más que abrir.
          { token, estado: { $ne: EstadoSolicitudValoracion.COMPLETADA }, abiertaAt: { $exists: false } },
          { $set: { estado: EstadoSolicitudValoracion.ABIERTA, abiertaAt: new Date() } },
        )
        .exec();
    } catch (error) {
      this.logger.warn(`Apertura no registrada: ${error}`);
    }
  }

  /** Marca la solicitud como abierta y devuelve la reserva a valorar. */
  async abrirPorToken(token: string): Promise<{ reservaId: string; codigo: string }> {
    const solicitud = await this.solicitudModel.findOne({ token }).exec();

    if (!solicitud) {
      throw new DomainException('Este enlace de valoración no es válido', 404);
    }
    if (solicitud.estado === EstadoSolicitudValoracion.COMPLETADA) {
      throw new DomainException('Ya has valorado esta reserva. ¡Gracias!', 409);
    }

    if (solicitud.estado !== EstadoSolicitudValoracion.ABIERTA) {
      solicitud.estado = EstadoSolicitudValoracion.ABIERTA;
      solicitud.abiertaAt = new Date();
      await solicitud.save();
    }

    const reserva = await this.reservaModel
      .findById(solicitud.reservaId).select('codigo').lean().exec();

    return { reservaId: solicitud.reservaId.toString(), codigo: reserva?.codigo ?? '' };
  }

  /** Cierra la solicitud cuando la reseña ya se ha publicado. */
  async marcarCompletada(reservaId: string): Promise<void> {
    await this.solicitudModel
      .updateOne(
        { reservaId: new Types.ObjectId(reservaId) },
        {
          $set: {
            estado: EstadoSolicitudValoracion.COMPLETADA,
            completadaAt: new Date(),
          },
        },
      )
      .exec();
  }

  /** Panel de seguimiento de la campaña de reseñas (HU-054). */
  async seguimiento(): Promise<SeguimientoValoraciones> {
    const porEstado = await this.solicitudModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: '$estado', n: { $sum: 1 } } },
    ]).exec();

    const contar = (estado: EstadoSolicitudValoracion): number =>
      porEstado.find((e) => e._id === estado)?.n ?? 0;

    const total = porEstado.reduce((suma, e) => suma + e.n, 0);
    const completadas = contar(EstadoSolicitudValoracion.COMPLETADA);

    return {
      total,
      enviadas: contar(EstadoSolicitudValoracion.ENVIADA),
      abiertas: contar(EstadoSolicitudValoracion.ABIERTA),
      completadas,
      fallidas: contar(EstadoSolicitudValoracion.FALLIDA),
      tasaConversion: total ? Math.round((completadas / total) * 1000) / 10 : 0,
    };
  }

  private async crearYEnviar(reserva: {
    _id: Types.ObjectId; usuarioId: Types.ObjectId; comercioId: Types.ObjectId;
    codigo: string; estado: ReservaEstado;
  }): Promise<boolean> {
    if (ESTADOS_EXCLUIDOS.includes(reserva.estado)) return false;

    const usuario = await this.usuarioModel
      .findById(reserva.usuarioId).select('nombre email').lean().exec();
    if (!usuario) return false;

    const solicitud = await this.solicitudModel.create({
      reservaId: reserva._id,
      usuarioId: reserva.usuarioId,
      comercioId: reserva.comercioId,
      token: randomBytes(24).toString('hex'),
      estado: EstadoSolicitudValoracion.PENDIENTE,
    });

    try {
      await this.notificationsService.solicitarValoracion({
        destinatario: usuario.email,
        nombre: usuario.nombre,
        codigoReserva: reserva.codigo,
        token: solicitud.token,
        esRecordatorio: false,
      });

      solicitud.estado = EstadoSolicitudValoracion.ENVIADA;
      solicitud.enviadaAt = new Date();
      await solicitud.save();
      return true;
    } catch (error) {
      solicitud.estado = EstadoSolicitudValoracion.FALLIDA;
      solicitud.error = error instanceof Error ? error.message : 'error desconocido';
      await solicitud.save();
      this.logger.warn(`Solicitud de valoración fallida para ${reserva.codigo}`);
      return false;
    }
  }
}
