import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Guarderia, GuarderiaDocument } from './guarderia.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000005');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO_LIMA: [number, number] = [-77.0428, -12.0464];

/** Siembra guarderías peruanas demo (colección vacía). */
@Injectable()
export class GuarderiaSeeder implements OnModuleInit {
  private readonly logger = new Logger(GuarderiaSeeder.name);

  constructor(@InjectModel(Guarderia.name) private readonly model: Model<GuarderiaDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.GUARDERIA }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembradas ${this.demo().length} guarderías demo (Lima).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar guarderías demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Guarderia>[] {
    return [
      this.g({ titulo: 'Nido Arcoiris Miraflores', edadMin: 0, edadMax: 3,
        cupos: 30, modalidad: 'mes', hora: 25, dia: 80, mes: 1200, img: 1148998,
        horario: 'L–V 07:00–18:00' }),
      this.g({ titulo: 'Wawa House San Isidro (bilingüe)', edadMin: 1, edadMax: 5,
        cupos: 24, modalidad: 'mes', hora: 30, dia: 95, mes: 1500, img: 296301,
        horario: 'L–V 07:30–18:30' }),
    ];
  }

  private g(d: {
    titulo: string; edadMin: number; edadMax: number; cupos: number;
    modalidad: 'hora' | 'dia' | 'mes'; hora: number; dia: number; mes: number;
    img: number; horario: string;
  }): Partial<Guarderia> {
    const precioBase = d.modalidad === 'hora' ? d.hora : d.modalidad === 'mes' ? d.mes : d.dia;
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Guarderia['comercioId'],
      vertical: VerticalKey.GUARDERIA,
      titulo: d.titulo,
      descripcion: `${d.titulo}: cuidado infantil con personal titulado, actividades pedagógicas y nutrición saludable. Lima, Perú.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: 'Lima', geo: { type: 'Point', coordinates: GEO_LIMA } },
      precioBase,
      moneda: 'PEN',
      estado: 'publicado',
      ratingPromedio: 4.9,
      totalReseñas: 120,
      rangoEdadMin: d.edadMin,
      rangoEdadMax: d.edadMax,
      cuposTotales: d.cupos,
      cuposDisponibles: Math.floor(d.cupos * 0.2),
      modalidad: d.modalidad,
      precioHora: d.hora,
      precioDia: d.dia,
      precioMes: d.mes,
      horario: d.horario,
    };
  }
}
