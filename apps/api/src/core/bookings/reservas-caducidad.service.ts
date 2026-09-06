import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PagoEstado, ReservaEstado } from 'shared';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { Reserva, ReservaDocument } from './reserva.schema';

/**
 * Cuánto se espera antes de dar por abandonada una reserva sin pagar.
 *
 * El `SlotHold` que retiene la plaza vive 15 minutos y el carrito 24 horas;
 * esto se pone por encima de ambos a propósito, para no matar nunca un cobro
 * todavía en marcha —una redirección al banco con 3-D Secure, un pago que el
 * cliente retoma más tarde— por muy lento que vaya.
 */
export const HORAS_CADUCIDAD_RESERVA_PENDIENTE = 24;

/** Tope por pasada: caducar es tarea de fondo, no puede acaparar la base. */
const MAXIMO_POR_PASADA = 200;

/**
 * Caduca las reservas que se quedaron a medio pagar.
 *
 * Una reserva nace `pendiente` y sólo sale de ahí cuando el webhook de la
 * pasarela confirma el cobro. Si el cliente cierra la pestaña antes de pagar,
 * nadie la mueve nunca: el `SlotHold` caduca y la plaza se libera, pero el
 * documento se queda `pendiente` **para siempre**. Y `pendiente` cuenta como
 * reserva viva, así que esas sobras bloqueaban el cierre de la cuenta del
 * comercio sin que nadie —ni el comercio ni el admin— pudiera resolverlas:
 * `cancelar()` sólo la acepta del cliente y `completar()` exige `confirmada`.
 *
 * Vive aparte de `BookingsService` porque es una tarea de mantenimiento, no
 * parte del flujo de reserva: se ejecuta sola y no la invoca ningún endpoint.
 */
@Injectable()
export class ReservasCaducidadService {
  private readonly logger = new Logger(ReservasCaducidadService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async caducarPendientesAbandonadas(): Promise<number> {
    const limite = new Date(Date.now() - HORAS_CADUCIDAD_RESERVA_PENDIENTE * 3_600_000);

    const candidatas = await this.reservaModel
      .find({ estado: ReservaEstado.PENDIENTE, createdAt: { $lt: limite } })
      .select('_id codigo')
      .limit(MAXIMO_POR_PASADA)
      .lean()
      .exec() as unknown as Array<{ _id: Types.ObjectId; codigo?: string }>;

    if (!candidatas.length) return 0;

    // Un pago aprobado sobre una reserva que sigue `pendiente` significa que el
    // webhook no llegó o falló: ahí hay dinero cobrado y un cliente esperando,
    // así que no se toca y se deja registrado para que alguien lo mire.
    const ids = candidatas.map((r) => r._id);
    const cobradas = await this.pagoModel
      .find({ reservaId: { $in: ids }, estado: PagoEstado.APROBADO })
      .select('reservaId')
      .lean()
      .exec() as unknown as Array<{ reservaId: Types.ObjectId }>;

    const conCobro = new Set(cobradas.map((p) => String(p.reservaId)));
    if (conCobro.size) {
      this.logger.warn(
        `${conCobro.size} reserva(s) llevan más de ${HORAS_CADUCIDAD_RESERVA_PENDIENTE} h ` +
          'pendientes con el pago aprobado: revisar el webhook de la pasarela.',
      );
    }

    const aCaducar = ids.filter((id) => !conCobro.has(String(id)));
    if (!aCaducar.length) return 0;

    const resultado = await this.reservaModel.updateMany(
      { _id: { $in: aCaducar }, estado: ReservaEstado.PENDIENTE },
      {
        $set: { estado: ReservaEstado.CANCELADA, holdId: undefined },
        $push: {
          historialEstados: {
            estado: ReservaEstado.CANCELADA,
            motivo: 'Caducada: no se completó el pago',
            por: 'sistema',
            at: new Date(),
          },
        },
      },
    ).exec();

    const caducadas = resultado.modifiedCount ?? 0;
    if (caducadas) this.logger.log(`${caducadas} reserva(s) pendientes caducadas por falta de pago`);
    return caducadas;
  }
}
