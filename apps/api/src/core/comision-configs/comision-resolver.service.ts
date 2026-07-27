import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { COMISION_PCT_DEFAULT, VerticalKey } from 'shared';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { ComisionConfigRepository } from './comision-config.repository';
import { TramoComision } from './comision-config.schema';

/** De dónde salió el porcentaje aplicado; se muestra en el reporte del admin. */
export type OrigenComision =
  | 'socio_fundador'
  | 'override_comercio'
  | 'tramo_vertical'
  | 'vertical'
  | 'defecto';

export interface ComisionResuelta {
  comisionPct: number;
  origen: OrigenComision;
  /** Tramo aplicado, si la comisión vino de la escala por importe. */
  tramoHastaEur?: number;
  stripePct: number;
  stripeFijoEur: number;
}

/**
 * Única fuente de verdad de "qué comisión se aplica a esta reserva".
 *
 * Antes de la Ola 8 la jerarquía estaba repartida entre el repositorio de
 * configuración y `BookingsService`. Con la llegada de los tramos y de los
 * socios fundadores, mantenerla dispersa habría hecho que el importe cobrado y
 * el reportado dejaran de coincidir. Aquí está entera, en orden y con su origen.
 *
 * Prioridad (§11.2 de CLAUDE.md, ampliada):
 * 1. Comisión congelada de socio fundador (si sigue vigente)
 * 2. `comisionPctOverride` del comercio
 * 3. Tramo por importe del vertical
 * 4. `comisionPct` del vertical
 * 5. `COMISION_PCT_DEFAULT`
 */
@Injectable()
export class ComisionResolverService {
  constructor(
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    private readonly configRepo: ComisionConfigRepository,
  ) {}

  async resolver(params: {
    vertical: VerticalKey;
    montoSubtotal: number;
    comercioId?: string;
  }): Promise<ComisionResuelta> {
    const config = await this.configRepo.obtenerComisionEfectiva(params.vertical);
    const tarifas = { stripePct: config.stripePct, stripeFijoEur: config.stripeFijoEur };

    const comercio = await this.buscarComercio(params.comercioId);

    if (comercio && this.congelacionVigente(comercio)) {
      return { comisionPct: comercio.comisionPctCongelada!, origen: 'socio_fundador', ...tarifas };
    }

    if (comercio?.comisionPctOverride != null) {
      return { comisionPct: comercio.comisionPctOverride, origen: 'override_comercio', ...tarifas };
    }

    const tramo = this.tramoPara(config.tramos, params.montoSubtotal);
    if (tramo) {
      return {
        comisionPct: tramo.comisionPct,
        origen: 'tramo_vertical',
        tramoHastaEur: tramo.hastaEur,
        ...tarifas,
      };
    }

    if (config.comisionPct != null) {
      return { comisionPct: config.comisionPct, origen: 'vertical', ...tarifas };
    }

    return { comisionPct: COMISION_PCT_DEFAULT, origen: 'defecto', ...tarifas };
  }

  /**
   * La congelación solo vale mientras no haya vencido: un socio fundador con la
   * fecha pasada vuelve a la tarifa vigente, que es el trato acordado.
   */
  private congelacionVigente(comercio: ComercioDocument): boolean {
    if (!comercio.socioFundador || comercio.comisionPctCongelada == null) return false;
    if (!comercio.congelacionHasta) return true;

    return comercio.congelacionHasta.getTime() > Date.now();
  }

  /** Primer tramo cuyo techo cubre el importe; los tramos se leen ordenados. */
  private tramoPara(tramos: TramoComision[] | undefined, montoSubtotal: number): TramoComision | null {
    if (!tramos?.length) return null;

    const ordenados = [...tramos].sort((a, b) => a.hastaEur - b.hastaEur);
    return ordenados.find((t) => montoSubtotal <= t.hastaEur) ?? ordenados[ordenados.length - 1];
  }

  private async buscarComercio(comercioId?: string): Promise<ComercioDocument | null> {
    if (!comercioId || !Types.ObjectId.isValid(comercioId)) return null;

    return this.comercioModel
      .findById(comercioId)
      .select('comisionPctOverride socioFundador comisionPctCongelada congelacionHasta')
      .exec();
  }
}
