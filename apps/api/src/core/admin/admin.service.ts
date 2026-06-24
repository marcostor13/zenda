import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { ActualizarComisionDto, ReporteFinancieroDto, ReporteVerticalDto, PagoEstado, ReservaEstado } from 'shared';
import { ComisionConfigDocument } from '../comision-configs/comision-config.schema';

interface PagoLean {
  reservaId: Types.ObjectId;
  montoTotal: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
}

interface ReservaLean {
  _id: Types.ObjectId;
  vertical: string;
}

export interface FiltrosReporte {
  fechaDesde: Date;
  fechaHasta: Date;
  vertical?: string;
  comercioId?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly comisionConfigRepo: ComisionConfigRepository,
    private readonly comerciosRepo: ComerciosRepository,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
  ) {}

  // ── Comisiones ──────────────────────────────────────────────────────────────

  async listarComisiones(): Promise<ComisionConfigDocument[]> {
    return this.comisionConfigRepo.listarTodas();
  }

  async actualizarComision(
    dto: ActualizarComisionDto,
    adminId: string,
  ): Promise<ComisionConfigDocument> {
    return this.comisionConfigRepo.upsert(
      dto.vertical,
      {
        comisionPct: dto.comisionPct,
        stripePct: dto.stripePct,
        stripeFijoSoles: dto.stripeFijoSoles,
        activo: dto.activo,
      },
      adminId,
    );
  }

  // ── Reportes financieros ─────────────────────────────────────────────────────

  async generarReporteFinanciero(filtros: FiltrosReporte): Promise<ReporteFinancieroDto> {
    const matchReservas: Record<string, unknown> = {
      estado: ReservaEstado.CONFIRMADA,
      createdAt: { $gte: filtros.fechaDesde, $lte: filtros.fechaHasta },
    };

    if (filtros.vertical) matchReservas['vertical'] = filtros.vertical;
    if (filtros.comercioId) matchReservas['comercioId'] = filtros.comercioId;

    const reservasIds = await this.reservaModel
      .find(matchReservas)
      .select('_id vertical')
      .lean()
      .exec() as ReservaLean[];

    const reservaIdsArr = reservasIds.map((r) => r._id);

    const pagos = await this.pagoModel
      .find({
        reservaId: { $in: reservaIdsArr },
        estado: PagoEstado.APROBADO,
      })
      .lean()
      .exec() as PagoLean[];

    const totales = pagos.reduce(
      (acc, pago) => ({
        gmv: acc.gmv + pago.montoTotal,
        ingresosPlataforma: acc.ingresosPlataforma + pago.comisionPlataforma,
        costoStripe: acc.costoStripe + pago.stripeFee,
        liquidacionesComercio: acc.liquidacionesComercio + pago.montoLiquidacion,
      }),
      { gmv: 0, ingresosPlataforma: 0, costoStripe: 0, liquidacionesComercio: 0 },
    );

    const porVertical = this.agruparPorVertical(pagos, reservasIds);

    return {
      fechaDesde: filtros.fechaDesde.toISOString(),
      fechaHasta: filtros.fechaHasta.toISOString(),
      gmv: Math.round(totales.gmv * 100) / 100,
      ingresosPlataforma: Math.round(totales.ingresosPlataforma * 100) / 100,
      costoStripe: Math.round(totales.costoStripe * 100) / 100,
      margenNetoPlataforma: Math.round((totales.ingresosPlataforma - totales.costoStripe) * 100) / 100,
      liquidacionesComercio: Math.round(totales.liquidacionesComercio * 100) / 100,
      totalReservas: reservaIdsArr.length,
      porVertical,
    };
  }

  private agruparPorVertical(
    pagos: PagoLean[],
    reservas: ReservaLean[],
  ): ReporteVerticalDto[] {
    const reservaVerticalMap = new Map(
      reservas.map((r) => [r._id.toString(), r.vertical]),
    );

    const acumulador = new Map<string, ReporteVerticalDto>();

    for (const pago of pagos) {
      const vertical = reservaVerticalMap.get(pago.reservaId.toString()) ?? 'unknown';

      const entrada = acumulador.get(vertical) ?? {
        vertical,
        gmv: 0,
        comision: 0,
        costoStripe: 0,
        margenNeto: 0,
        totalReservas: 0,
      };

      entrada.gmv += pago.montoTotal;
      entrada.comision += pago.comisionPlataforma;
      entrada.costoStripe += pago.stripeFee;
      entrada.margenNeto += pago.comisionPlataforma - pago.stripeFee;
      entrada.totalReservas += 1;

      acumulador.set(vertical, entrada);
    }

    return Array.from(acumulador.values()).map((v) => ({
      ...v,
      gmv: Math.round(v.gmv * 100) / 100,
      comision: Math.round(v.comision * 100) / 100,
      costoStripe: Math.round(v.costoStripe * 100) / 100,
      margenNeto: Math.round(v.margenNeto * 100) / 100,
    }));
  }
}
