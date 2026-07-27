import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AsumeDescuento } from 'shared';
import { Campana, CampanaDocument } from './campana.schema';
import { Cupon, CuponDocument } from './cupon.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Lo que costó la campaña y lo que trajo, en una sola fila (HU-057). */
export interface MetricasCampana {
  campanaId: string;
  nombre: string;
  activa: boolean;
  enviados: number;
  cupones: number;
  usos: number;
  /** Usos sobre envíos: cuánta gente reservó tras recibir la campaña. */
  tasaConversion: number;
  /** Descuento concedido que paga la plataforma. */
  costePlataforma: number;
  /** Descuento que asume el comercio; no sale del margen de Doogking. */
  costeComercios: number;
}

@Injectable()
export class CampanasService {
  constructor(
    @InjectModel(Campana.name) private readonly campanaModel: Model<CampanaDocument>,
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
  ) {}

  listar(): Promise<CampanaDocument[]> {
    return this.campanaModel.find().sort({ createdAt: -1 }).exec();
  }

  crear(datos: Partial<Campana>, adminId: string): Promise<CampanaDocument> {
    if (!datos.desde || !datos.hasta) {
      throw new DomainException('Indica la vigencia de la campaña', 400);
    }
    if (new Date(datos.hasta) <= new Date(datos.desde)) {
      throw new DomainException('La campaña debe terminar después de empezar', 400);
    }

    return this.campanaModel.create({
      ...datos,
      creadaPor: Types.ObjectId.isValid(adminId) ? new Types.ObjectId(adminId) : undefined,
    });
  }

  async actualizar(id: string, datos: Partial<Campana>): Promise<CampanaDocument> {
    const campana = await this.campanaModel
      .findByIdAndUpdate(this.aObjectId(id), { $set: datos }, { new: true })
      .exec();

    if (!campana) {
      throw new DomainException('Campaña no encontrada', 404);
    }
    return campana;
  }

  /**
   * Métricas por campaña.
   *
   * Separa el coste según **quién asume el descuento**: mezclarlos daría un
   * margen falso, porque lo que paga el comercio no sale del bolsillo de la
   * plataforma.
   */
  async metricas(): Promise<MetricasCampana[]> {
    const campanas = await this.campanaModel.find().sort({ createdAt: -1 }).lean().exec();

    return Promise.all(campanas.map(async (campana) => {
      const cupones = await this.cuponModel
        .find({ campanaId: campana._id })
        .select('tipo valor usados asumeDescuento montoMinimo')
        .lean()
        .exec();

      const usos = cupones.reduce((suma, c) => suma + (c.usados ?? 0), 0);
      const coste = (asume: AsumeDescuento): number =>
        Math.round(cupones
          .filter((c) => (c.asumeDescuento ?? AsumeDescuento.PLATAFORMA) === asume)
          .reduce((suma, c) => suma + this.costeDe(c), 0) * 100) / 100;

      return {
        campanaId: String(campana._id),
        nombre: campana.nombre,
        activa: campana.activa,
        enviados: campana.enviados ?? 0,
        cupones: cupones.length,
        usos,
        tasaConversion: campana.enviados
          ? Math.round((usos / campana.enviados) * 1000) / 10
          : 0,
        costePlataforma: coste(AsumeDescuento.PLATAFORMA),
        costeComercios: coste(AsumeDescuento.COMERCIO),
      };
    }));
  }

  /**
   * Coste estimado de un cupón. Para porcentajes se usa el importe mínimo como
   * referencia: es lo único conocido sin recorrer todas las reservas, y se
   * queda corto antes que exagerar el gasto.
   */
  private costeDe(cupon: { tipo: string; valor: number; usados?: number; montoMinimo?: number }): number {
    const usos = cupon.usados ?? 0;
    if (!usos) return 0;

    return cupon.tipo === 'fijo'
      ? cupon.valor * usos
      : (cupon.montoMinimo ?? 0) * cupon.valor * usos;
  }

  private aObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new DomainException('Identificador no válido', 400);
    }
    return new Types.ObjectId(id);
  }
}
