import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Transporte, TransporteDocument } from './transporte.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('000000000000000000000004');
const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/** Siembra servicios de transporte de carga demo (colección vacía). */
@Injectable()
export class TransporteSeeder implements OnModuleInit {
  private readonly logger = new Logger(TransporteSeeder.name);

  constructor(@InjectModel(Transporte.name) private readonly model: Model<TransporteDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.TRANSPORTE }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembrados ${this.demo().length} servicios de transporte demo.`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar transportes demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Transporte>[] {
    return [
      this.t({ titulo: 'Mudanzas Express Madrid', ciudad: 'Madrid', tipo: 'Mudanzas',
        capKg: 1500, capM3: 20, base: 150, km: 0.4, img: 4246120,
        rutas: ['Madrid', 'Toledo', 'Guadalajara'] }),
      this.t({ titulo: 'Carga Refrigerada Barcelona', ciudad: 'Barcelona', tipo: 'Refrigerado',
        capKg: 3000, capM3: 30, base: 220, km: 0.6, img: 906494,
        rutas: ['Barcelona', 'Girona', 'Tarragona'] }),
    ];
  }

  private t(d: {
    titulo: string; ciudad: string; tipo: string; capKg: number; capM3: number;
    base: number; km: number; img: number; rutas: string[];
  }): Partial<Transporte> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Transporte['comercioId'],
      vertical: VerticalKey.TRANSPORTE,
      titulo: d.titulo,
      descripcion: `${d.titulo}: transporte de carga ${d.tipo.toLowerCase()} con seguimiento y seguro incluido.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: d.ciudad },
      precioBase: d.base,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.6,
      totalReseñas: 210,
      tipoCarga: d.tipo,
      capacidadKg: d.capKg,
      capacidadM3: d.capM3,
      rutasCubiertas: d.rutas,
      tarifaBase: d.base,
      tarifaKg: d.km,
    };
  }
}
