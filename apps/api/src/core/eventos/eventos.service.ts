import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PasoEmbudo, TipoEvento } from 'shared';
import { Evento, EventoDocument } from './evento.schema';

export interface RegistrarEventoParams {
  tipo: TipoEvento;
  usuarioId?: string;
  sesionId?: string;
  reservaId?: string;
  carritoId?: string;
  servicioId?: string;
  vertical?: string;
  paso?: PasoEmbudo;
  msDesdeInicio?: number;
  payload?: Record<string, unknown>;
}

/** Un embudo que se quedó a medias, con el paso exacto donde se cortó. */
export interface AbandonoDetectado {
  sesionId?: string;
  usuarioId?: string;
  servicioId?: string;
  vertical?: string;
  ultimoPaso?: PasoEmbudo;
  desdeHace: Date;
}

export interface MetricaEmbudo {
  /** Reservas confirmadas con medición de tiempo completa. */
  medidas: number;
  /** Cuántas se completaron en menos de 30 s (meta T4). */
  bajo30s: number;
  porcentajeBajo30s: number;
  medianaSegundos: number;
}

/** Pasado este tiempo sin avanzar, un embudo se considera abandonado. */
const MINUTOS_PARA_ABANDONO = 60;
const META_SEGUNDOS = 30;

/**
 * Registro de eventos del embudo.
 *
 * Escribe siempre en segundo plano y **nunca lanza**: la telemetría no puede
 * tumbar una reserva. Si falla, se pierde una traza; si tumbara el flujo,
 * se perdería una venta.
 */
@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(
    @InjectModel(Evento.name) private readonly eventoModel: Model<EventoDocument>,
  ) {}

  async registrar(params: RegistrarEventoParams): Promise<void> {
    try {
      await this.eventoModel.create({
        tipo: params.tipo,
        usuarioId: this.aObjectId(params.usuarioId),
        sesionId: params.sesionId,
        reservaId: this.aObjectId(params.reservaId),
        carritoId: this.aObjectId(params.carritoId),
        servicioId: this.aObjectId(params.servicioId),
        vertical: params.vertical,
        paso: params.paso,
        msDesdeInicio: params.msDesdeInicio,
        payload: params.payload ?? {},
      });
    } catch (error) {
      this.logger.warn(`Evento ${params.tipo} no registrado: ${this.mensaje(error)}`);
    }
  }

  /**
   * Embudos que empezaron, no terminaron y llevan parados más de una hora.
   *
   * Se agrupa por sesión y se descarta la que tenga confirmación: sin ese
   * descarte se estaría persiguiendo a gente que **sí** reservó, que es la
   * forma más rápida de que marquen el correo como spam.
   */
  async detectarAbandonos(desdeHoras = 72): Promise<AbandonoDetectado[]> {
    const desde = new Date(Date.now() - desdeHoras * 60 * 60 * 1000);
    const hasta = new Date(Date.now() - MINUTOS_PARA_ABANDONO * 60 * 1000);

    const agrupados = await this.eventoModel.aggregate<{
      _id: string;
      usuarioId?: Types.ObjectId;
      servicioId?: Types.ObjectId;
      vertical?: string;
      ultimoPaso?: PasoEmbudo;
      ultimoAt: Date;
      confirmada: number;
      yaAvisado: number;
    }>([
      { $match: { createdAt: { $gte: desde }, sesionId: { $exists: true, $ne: null } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$sesionId',
          usuarioId: { $last: '$usuarioId' },
          servicioId: { $last: '$servicioId' },
          vertical: { $last: '$vertical' },
          ultimoPaso: { $last: '$paso' },
          ultimoAt: { $last: '$createdAt' },
          confirmada: {
            $sum: { $cond: [{ $eq: ['$tipo', TipoEvento.RESERVA_CONFIRMADA] }, 1, 0] },
          },
          yaAvisado: {
            $sum: { $cond: [{ $eq: ['$tipo', TipoEvento.RESERVA_ABANDONADA] }, 1, 0] },
          },
          inicios: {
            $sum: { $cond: [{ $eq: ['$tipo', TipoEvento.RESERVA_INICIADA] }, 1, 0] },
          },
        },
      },
      // Solo cuenta como abandono lo que llegó a empezar una reserva: mirar un
      // listado y marcharse no es un abandono, es navegar.
      { $match: { inicios: { $gt: 0 }, confirmada: 0, yaAvisado: 0, ultimoAt: { $lte: hasta } } },
      { $sort: { ultimoAt: -1 } },
      { $limit: 500 },
    ]).exec();

    return agrupados.map((a) => ({
      sesionId: a._id,
      usuarioId: a.usuarioId?.toString(),
      servicioId: a.servicioId?.toString(),
      vertical: a.vertical,
      ultimoPaso: a.ultimoPaso,
      desdeHace: a.ultimoAt,
    }));
  }

  /**
   * Métrica de la meta T4. Se calcula sobre reservas **confirmadas** con
   * medición completa: incluir las abandonadas mezclaría "tardó mucho" con
   * "nunca terminó", que son problemas distintos.
   */
  async metricaEmbudo(dias = 30): Promise<MetricaEmbudo> {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const confirmadas = await this.eventoModel
      .find({
        tipo: TipoEvento.RESERVA_CONFIRMADA,
        createdAt: { $gte: desde },
        msDesdeInicio: { $gt: 0 },
      })
      .select('msDesdeInicio')
      .lean()
      .exec();

    const medidas = confirmadas.length;
    if (!medidas) {
      return { medidas: 0, bajo30s: 0, porcentajeBajo30s: 0, medianaSegundos: 0 };
    }

    const segundos = confirmadas
      .map((e) => (e.msDesdeInicio ?? 0) / 1000)
      .sort((a, b) => a - b);
    const bajo30s = segundos.filter((s) => s <= META_SEGUNDOS).length;

    return {
      medidas,
      bajo30s,
      porcentajeBajo30s: Math.round((bajo30s / medidas) * 1000) / 10,
      medianaSegundos: Math.round(segundos[Math.floor(segundos.length / 2)] * 10) / 10,
    };
  }

  private aObjectId(id?: string): Types.ObjectId | undefined {
    return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
