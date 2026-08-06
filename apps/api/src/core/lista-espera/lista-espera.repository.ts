import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ListaEspera, ListaEsperaDocument } from './lista-espera.schema';

/** Resultado del alta: el documento y si ya existía antes de la llamada. */
export interface AltaListaEspera {
  readonly email: string;
  readonly yaRegistrado: boolean;
}

@Injectable()
export class ListaEsperaRepository {
  constructor(
    @InjectModel(ListaEspera.name)
    private readonly listaEsperaModel: Model<ListaEsperaDocument>,
  ) {}

  /**
   * Alta idempotente: reenviar el mismo email no duplica ni pisa el origen
   * original. `upsertedCount` distingue el alta nueva de la repetida sin una
   * segunda consulta.
   */
  async suscribir(email: string, origen: string): Promise<AltaListaEspera> {
    const resultado = await this.listaEsperaModel
      .updateOne({ email }, { $setOnInsert: { email, origen } }, { upsert: true })
      .exec();

    return { email, yaRegistrado: resultado.upsertedCount === 0 };
  }

  /** Últimos emails apuntados (panel admin). */
  async listar(limite: number): Promise<ListaEsperaDocument[]> {
    return this.listaEsperaModel
      .find()
      .select('email origen createdAt')
      .sort({ createdAt: -1 })
      .limit(limite)
      .lean<ListaEsperaDocument[]>()
      .exec();
  }

  async contar(): Promise<number> {
    return this.listaEsperaModel.countDocuments().exec();
  }
}
