import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EntidadAuditada, PagoEstado } from 'shared';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Liquidacion, LiquidacionDocument } from './liquidacion.schema';

/*
 * El periodo llega de dos `input type="date"`, o sea fechas sin hora
 * (`2026-09-30`), que `new Date` interpreta como medianoche **UTC**. De ahí que
 * el rango se cierre también en UTC: usar la hora local del servidor haría que
 * el mismo periodo liquidara importes distintos según dónde esté desplegado el
 * API, y quien cobra no puede depender de eso.
 *
 * `hasta` se extiende al final del día porque, tal cual llegaba, `$lte` dejaba
 * fuera **todo el último día**: una liquidación "del 1 al 30" no pagaba nada de
 * lo cobrado el 30.
 */
function finDelDia(fecha: Date): Date {
  const fin = new Date(fecha);
  fin.setUTCHours(23, 59, 59, 999);
  return fin;
}

function inicioDelDia(fecha: Date): Date {
  const inicio = new Date(fecha);
  inicio.setUTCHours(0, 0, 0, 0);
  return inicio;
}

@Injectable()
export class LiquidacionesService {
  constructor(
    @InjectModel(Liquidacion.name) private readonly liquidacionModel: Model<LiquidacionDocument>,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    private readonly comerciosRepo: ComerciosRepository,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Calcula lo que le corresponde a un comercio en un periodo a partir de los
   * pagos aprobados y lo deja registrado. **No mueve dinero**: deja constancia
   * de la cantidad, y marcar como pagada es un paso aparte y manual.
   */
  async generar(
    comercioId: string,
    desde: Date,
    hasta: Date,
    adminId: string,
  ): Promise<LiquidacionDocument> {
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      throw new DomainException('Las fechas del periodo no son válidas', 400);
    }

    const comercio = await this.comerciosRepo.findById(comercioId);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    if (hasta < desde) {
      throw new DomainException('El periodo termina antes de empezar', 400);
    }

    const inicio = inicioDelDia(desde);
    const fin = finDelDia(hasta);
    await this.rechazarSiSolapa(comercioId, inicio, fin);

    const reservas = await this.reservaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .select('_id')
      .lean()
      .exec() as unknown as Array<{ _id: Types.ObjectId }>;

    const [totales] = await this.pagoModel.aggregate<{
      bruto: number; comision: number; stripe: number; neto: number; pagos: number;
    }>([
      {
        $match: {
          reservaId: { $in: reservas.map((r) => r._id) },
          estado: PagoEstado.APROBADO,
          createdAt: { $gte: inicio, $lte: fin },
        },
      },
      {
        $group: {
          _id: null,
          bruto: { $sum: '$montoTotal' },
          comision: { $sum: '$comisionPlataforma' },
          stripe: { $sum: '$stripeFee' },
          neto: { $sum: '$montoLiquidacion' },
          pagos: { $sum: 1 },
        },
      },
    ]).exec();

    if (!totales || totales.pagos === 0) {
      throw new DomainException('No hay pagos cobrados de ese comercio en el periodo', 400);
    }

    const dosDecimales = (n: number): number => Math.round(n * 100) / 100;
    const liquidacion = await this.liquidacionModel.create({
      comercioId: new Types.ObjectId(comercioId),
      comercioNombre: comercio.nombreComercial,
      desde: inicio,
      hasta: fin,
      facturacionBruta: dosDecimales(totales.bruto),
      comisionPlataforma: dosDecimales(totales.comision),
      stripeFee: dosDecimales(totales.stripe),
      importeNeto: dosDecimales(totales.neto),
      reservas: totales.pagos,
      generadaPorId: new Types.ObjectId(adminId),
    });

    await this.auditoria.registrar({
      actorId: adminId,
      entidad: EntidadAuditada.COMERCIO,
      entidadId: comercioId,
      descripcion: `Liquidación generada para ${comercio.nombreComercial}: ${dosDecimales(totales.neto)} €`,
      despues: { desde: inicio, hasta: fin, importeNeto: dosDecimales(totales.neto) },
    });

    return liquidacion;
  }

  /**
   * Impide liquidar dos veces los mismos pagos. Nada marca un pago como "ya
   * liquidado", así que si dos periodos del mismo comercio se pisan, sus pagos
   * entran en las dos liquidaciones y el comercio cobra de más. Generar el
   * mismo periodo dos veces —el descuido más fácil de cometer— era exactamente
   * eso, y no avisaba de nada.
   */
  private async rechazarSiSolapa(comercioId: string, desde: Date, hasta: Date): Promise<void> {
    const solapada = await this.liquidacionModel
      .findOne({
        comercioId: new Types.ObjectId(comercioId),
        desde: { $lte: hasta },
        hasta: { $gte: desde },
      })
      .select('desde hasta')
      .lean<{ desde: Date; hasta: Date }>()
      .exec();

    if (solapada) {
      const dia = (f: Date): string => new Date(f).toISOString().slice(0, 10);
      throw new DomainException(
        `Ese periodo ya está liquidado (del ${dia(solapada.desde)} al ${dia(solapada.hasta)}). ` +
          'Elige un rango que no se solape.',
        409,
      );
    }
  }

  async listar(
    filtros: { comercioId?: string; estado?: string },
    page = 1,
    limite = 20,
  ): Promise<{ items: LiquidacionDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filtros.comercioId) query['comercioId'] = new Types.ObjectId(filtros.comercioId);
    if (filtros.estado) query['estado'] = filtros.estado;

    const skip = (page - 1) * limite;
    const [items, total] = await Promise.all([
      this.liquidacionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limite).lean<LiquidacionDocument[]>().exec(),
      this.liquidacionModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /** Marca la transferencia como hecha; la referencia permite casarla con el banco. */
  async marcarPagada(id: string, referencia: string, adminId: string): Promise<LiquidacionDocument> {
    if (!referencia?.trim()) {
      throw new DomainException('Indica la referencia de la transferencia', 400);
    }

    const actual = await this.liquidacionModel.findById(id).select('estado referencia').lean<{
      estado: string; referencia?: string;
    }>().exec();

    if (!actual) {
      throw new DomainException('Liquidación no encontrada', 404);
    }

    // Volver a marcarla pisaba la fecha y la referencia de la transferencia real
    // y dejaba dos apuntes de auditoría para un solo pago: al cuadrar con el
    // banco no había forma de saber cuál era la buena.
    if (actual.estado === 'pagada') {
      throw new DomainException(
        `Esa liquidación ya se marcó como pagada${actual.referencia ? ` (ref. ${actual.referencia})` : ''}.`,
        409,
      );
    }

    const liquidacion = await this.liquidacionModel
      .findByIdAndUpdate(
        id,
        { $set: { estado: 'pagada', fechaPago: new Date(), referencia: referencia.trim() } },
        { new: true },
      )
      .exec();

    if (!liquidacion) {
      throw new DomainException('Liquidación no encontrada', 404);
    }

    await this.auditoria.registrar({
      actorId: adminId,
      entidad: EntidadAuditada.COMERCIO,
      entidadId: String(liquidacion.comercioId),
      descripcion: `Liquidación de ${liquidacion.comercioNombre} marcada como pagada (${liquidacion.importeNeto} €)`,
      motivo: referencia.trim(),
    });

    return liquidacion;
  }
}
