import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Taxi, TaxiDocument } from './taxi.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('000000000000000000000002');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/**
 * Siembra servicios de taxi de demostración la primera vez (colección de taxis
 * vacía). Vive en el propio vertical para no acoplar el core: el vertical es
 * autocontenido (schema + estrategia + seed + auto-registro).
 */
@Injectable()
export class TaxiSeeder implements OnModuleInit {
  private readonly logger = new Logger(TaxiSeeder.name);

  constructor(
    @InjectModel(Taxi.name) private readonly taxiModel: Model<TaxiDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const total = await this.taxiModel.countDocuments({ vertical: VerticalKey.TAXIS }).exec();
    if (total > 0) return;

    try {
      await this.taxiModel.insertMany(this.demoTaxis());
      this.logger.log(`Sembrados ${this.demoTaxis().length} servicios de taxi de demostración.`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar taxis demo: ${(error as Error).message}`);
    }
  }

  private demoTaxis(): Partial<Taxi>[] {
    return [
      this.taxi({ titulo: 'Traslado Aeropuerto Madrid-Barajas', ciudad: 'Madrid', tipo: 'sedan',
        capacidad: 4, base: 25, km: 1.2, unidades: 12, img: 170811,
        zonas: ['Madrid Centro', 'Salamanca', 'Chamartín', 'Barajas'] }),
      this.taxi({ titulo: 'VTC Premium Barcelona', ciudad: 'Barcelona', tipo: 'premium',
        capacidad: 4, base: 35, km: 1.8, unidades: 6, img: 116675,
        zonas: ['Eixample', 'El Prat', 'Gràcia'] }),
      this.taxi({ titulo: 'Van 8 plazas Valencia', ciudad: 'Valencia', tipo: 'van',
        capacidad: 8, base: 40, km: 1.5, unidades: 4, img: 3158562,
        zonas: ['Centro', 'Manises', 'Puerto'] }),
    ];
  }

  private taxi(d: {
    titulo: string; ciudad: string; tipo: string; capacidad: number;
    base: number; km: number; unidades: number; img: number; zonas: string[];
  }): Partial<Taxi> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Taxi['comercioId'],
      vertical: VerticalKey.TAXIS,
      titulo: d.titulo,
      descripcion: `${d.titulo}: traslados con conductor, tarifa transparente y reserva inmediata.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: d.ciudad },
      precioBase: d.base,
      moneda: 'EUR',
      estado: 'publicado',
      destacado: false,
      ratingPromedio: 4.7,
      totalReseñas: 320,
      tipoVehiculo: d.tipo as Taxi['tipoVehiculo'],
      capacidad: d.capacidad,
      zonaCobertura: d.zonas,
      tarifaBase: d.base,
      tarifaKm: d.km,
      unidadesDisponibles: d.unidades,
    };
  }
}
