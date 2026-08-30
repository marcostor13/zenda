import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReservaEstado } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { BloqueoServicio, BloqueoServicioDocument } from '../bloqueos/bloqueo-servicio.schema';

/**
 * Estados en los que una reserva sigue ocupando la plaza.
 *
 * Una cancelada o un no-show liberan la noche; una completada no, porque esas
 * noches ya se consumieron y siguen contando para el histórico del calendario.
 */
const ESTADOS_QUE_OCUPAN: ReservaEstado[] = [
  ReservaEstado.PENDIENTE,
  ReservaEstado.CONFIRMADA,
  ReservaEstado.AJUSTE_SOLICITADO,
  ReservaEstado.EN_CURSO,
  ReservaEstado.COMPLETADA,
  ReservaEstado.PAGO_RETENIDO,
  ReservaEstado.PAGO_LIBERADO,
  ReservaEstado.EN_DISPUTA,
];

/** Clave `YYYY-MM-DD` de un día, en UTC: el calendario se razona por fecha, no por instante. */
export const claveDia = (fecha: Date): string => fecha.toISOString().slice(0, 10);

/** Medianoche UTC del día de `fecha`. Normaliza para poder comparar e iterar noches. */
export const inicioDelDia = (fecha: Date): Date =>
  new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Ocupación que suma un cierre total. Agota cualquier inventario razonable sin
 * llegar a `MAX_SAFE_INTEGER`, que al restarlo daría números absurdos en las
 * plazas libres que se enseñan al comercio.
 */
const CIERRE_TOTAL = 9_999;

/** Noches de una estancia: `[entrada, salida)`. La noche de salida no se ocupa. */
export const nochesDe = (entrada: Date, salida: Date): string[] => {
  const noches: string[] = [];
  for (
    let dia = inicioDelDia(entrada);
    dia.getTime() < inicioDelDia(salida).getTime();
    dia = new Date(dia.getTime() + MS_POR_DIA)
  ) {
    noches.push(claveDia(dia));
  }
  return noches;
};

interface ConsultaOcupacion {
  servicioId: string;
  desde: Date;
  hasta: Date;
  /** Sólo cuentan las reservas de este espacio; sin él, todas las del servicio. */
  espacioId?: string;
}

/**
 * Cuántas plazas hay tomadas cada noche de un servicio.
 *
 * El calendario de disponibilidad no existe como colección propia: se deriva de
 * las reservas vivas. Vive en el core y no dentro de un vertical porque el
 * cálculo —solapar `[fechaInicio, fechaFin)` con un rango— es idéntico para
 * cualquier vertical que se reserve por noches (alojamiento, hoteles).
 *
 * **Cada reserva ocupa una unidad del espacio**, no una por perro: el número de
 * perros de una reserva cambia el precio, no cuántas suites hacen falta.
 */
@Injectable()
export class OcupacionRepository {
  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(BloqueoServicio.name) private readonly bloqueoModel: Model<BloqueoServicioDocument>,
  ) {}

  /** Mapa `YYYY-MM-DD` → reservas que ocupan esa noche, sólo con los días que tienen alguna. */
  async nochesOcupadas(consulta: ConsultaOcupacion): Promise<Map<string, number>> {
    const desde = inicioDelDia(consulta.desde);
    const hasta = inicioDelDia(consulta.hasta);

    const filtro: Record<string, unknown> = {
      servicioId: new Types.ObjectId(consulta.servicioId),
      estado: { $in: ESTADOS_QUE_OCUPAN },
      // Solapamiento de intervalos: empieza antes de que acabe el rango y
      // termina después de que empiece. Sin `fechaFin` es una reserva de un día.
      fechaInicio: { $lt: new Date(hasta.getTime() + MS_POR_DIA) },
      $or: [{ fechaFin: { $gt: desde } }, { fechaFin: { $exists: false } }],
    };

    if (consulta.espacioId) {
      filtro['detalle.espacioId'] = consulta.espacioId;
    }

    const reservas = await this.reservaModel
      .find(filtro)
      .select({ fechaInicio: 1, fechaFin: 1 })
      .lean()
      .exec();

    const ocupacion = new Map<string, number>();
    for (const reserva of reservas) {
      const salida = reserva.fechaFin ?? new Date(reserva.fechaInicio.getTime() + MS_POR_DIA);
      for (const noche of nochesDe(reserva.fechaInicio, salida)) {
        ocupacion.set(noche, (ocupacion.get(noche) ?? 0) + 1);
      }
    }

    await this.sumarBloqueos(ocupacion, consulta);
    return ocupacion;
  }

  /**
   * Añade a la ocupación lo que el comercio ha cerrado por su cuenta.
   *
   * Va aquí, y no en cada vertical, porque es el único sitio por el que pasan
   * alojamiento y hoteles para saber qué noches están tomadas: si un negocio
   * alquila dos suites por teléfono y no se descuentan, Doogking sigue
   * vendiéndolas y acaba habiendo dos reservas para la misma cama.
   *
   * Un bloqueo sin `cantidad` cierra el servicio entero ese día. Se suma un
   * número lo bastante grande para agotar cualquier inventario, porque desde
   * aquí no hay una capacidad que consultar sin acoplarse a cada vertical.
   */
  private async sumarBloqueos(
    ocupacion: Map<string, number>,
    consulta: ConsultaOcupacion,
  ): Promise<void> {
    const desde = inicioDelDia(consulta.desde);
    const hasta = inicioDelDia(consulta.hasta);

    const filtro: Record<string, unknown> = {
      servicioId: new Types.ObjectId(consulta.servicioId),
      desde: { $lt: new Date(hasta.getTime() + MS_POR_DIA) },
      hasta: { $gt: desde },
    };
    // Un bloqueo de un tipo de espacio concreto no cierra los demás.
    if (consulta.espacioId) {
      filtro['$or'] = [
        { espacioTipo: consulta.espacioId },
        { espacioTipo: { $in: [null, undefined] } },
      ];
    }

    const bloqueos = await this.bloqueoModel
      .find(filtro)
      .select({ desde: 1, hasta: 1, cantidad: 1 })
      .lean()
      .exec();

    for (const bloqueo of bloqueos) {
      const unidades = bloqueo.cantidad ?? CIERRE_TOTAL;
      const noches = nochesDe(bloqueo.desde, bloqueo.hasta);
      // Un tramo dentro del mismo día no genera ninguna noche completa, pero sí
      // cierra ese día: sin esto, bloquear "el martes de 9 a 14" no se notaba.
      const dias = noches.length ? noches : [claveDia(bloqueo.desde)];

      for (const dia of dias) {
        ocupacion.set(dia, (ocupacion.get(dia) ?? 0) + unidades);
      }
    }
  }
}
