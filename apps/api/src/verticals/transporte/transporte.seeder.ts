import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Transporte, TransporteDocument } from './transporte.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000004');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO_LIMA: [number, number] = [-77.0428, -12.0464];

/** Siembra servicios de transporte de carga peruanos demo (colección vacía). */
@Injectable()
export class TransporteSeeder implements OnModuleInit {
  private readonly logger = new Logger(TransporteSeeder.name);

  constructor(@InjectModel(Transporte.name) private readonly model: Model<TransporteDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.TRANSPORTE }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembrados ${this.demo().length} servicios de transporte demo (Perú).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar transportes demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Transporte>[] {
    return [
      this.t({ titulo: 'Mudanzas Express Lima', tipo: 'Mudanzas',
        capKg: 2000, capM3: 25, base: 350, km: 0.15, img: 4246120,
        rutas: ['Lima Norte', 'Lima Sur', 'Lima Este', 'Lima Centro', 'Callao'] }),
      this.t({ titulo: 'Carga Lima–Arequipa', tipo: 'Carga General',
        capKg: 5000, capM3: 40, base: 800, km: 0.12, img: 906494,
        rutas: ['Lima', 'Ica', 'Arequipa', 'Cusco'] }),
    ];
  }

  private t(d: {
    titulo: string; tipo: string; capKg: number; capM3: number;
    base: number; km: number; img: number; rutas: string[];
  }): Partial<Transporte> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Transporte['comercioId'],
      vertical: VerticalKey.TRANSPORTE,
      titulo: d.titulo,
      descripcion: `${d.titulo}: transporte de carga ${d.tipo.toLowerCase()} con GPS en tiempo real, seguro incluido y entrega door-to-door.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: 'Lima', geo: { type: 'Point', coordinates: GEO_LIMA } },
      precioBase: d.base,
      moneda: 'PEN',
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
