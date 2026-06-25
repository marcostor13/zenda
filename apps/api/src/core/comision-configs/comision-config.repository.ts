import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ComisionConfig, ComisionConfigDocument } from './comision-config.schema';
import { VerticalKey, COMISION_PCT_DEFAULT } from 'shared';

// Tarifa Stripe para tarjetas del EEE: 1.5% + €0.25 por transacción.
const STRIPE_PCT_DEFAULT = 0.015;
const STRIPE_FIJO_EUR_DEFAULT = 0.25;

@Injectable()
export class ComisionConfigRepository {
  constructor(
    @InjectModel(ComisionConfig.name)
    private readonly model: Model<ComisionConfigDocument>,
  ) {}

  async obtenerPorVertical(vertical: VerticalKey | 'global'): Promise<ComisionConfigDocument | null> {
    return this.model.findOne({ vertical, activo: true }).lean().exec() as Promise<ComisionConfigDocument | null>;
  }

  async obtenerComisionEfectiva(vertical: VerticalKey): Promise<ComisionConfigDocument> {
    const configVertical = await this.obtenerPorVertical(vertical);
    if (configVertical) return configVertical;

    const configGlobal = await this.obtenerPorVertical('global');
    if (configGlobal) return configGlobal;

    return {
      vertical: 'global',
      comisionPct: COMISION_PCT_DEFAULT,
      stripePct: STRIPE_PCT_DEFAULT,
      stripeFijoEur: STRIPE_FIJO_EUR_DEFAULT,
      activo: true,
    } as ComisionConfigDocument;
  }

  async upsert(
    vertical: string,
    datos: Partial<ComisionConfig>,
    adminId: string,
  ): Promise<ComisionConfigDocument> {
    return this.model.findOneAndUpdate(
      { vertical },
      { ...datos, vertical, actualizadoPor: adminId },
      { upsert: true, new: true },
    ).exec() as Promise<ComisionConfigDocument>;
  }

  async listarTodas(): Promise<ComisionConfigDocument[]> {
    return this.model.find().lean().exec() as Promise<ComisionConfigDocument[]>;
  }
}
