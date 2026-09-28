import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PuntoGeo } from 'shared';
import { CentroPoblacion, CentroPoblacionDocument } from './centro-poblacion.schema';

@Injectable()
export class CentrosPoblacionRepository {
  constructor(
    @InjectModel(CentroPoblacion.name) private readonly modelo: Model<CentroPoblacionDocument>,
  ) {}

  async buscar(clave: string): Promise<PuntoGeo | null> {
    return this.modelo.findOne({ clave }).select('lat lng -_id').lean<PuntoGeo>().exec();
  }

  /** Upsert: dos altas simultáneas de la misma ciudad no pueden chocar por el índice único. */
  async guardar(clave: string, ciudad: string, punto: PuntoGeo): Promise<void> {
    await this.modelo
      .updateOne({ clave }, { $set: { ciudad, lat: punto.lat, lng: punto.lng } }, { upsert: true })
      .exec();
  }
}
