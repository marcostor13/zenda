import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Taxi, TaxiDocument } from './taxi.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000002');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO_LIMA: [number, number] = [-77.0428, -12.0464];

/** Siembra servicios de taxi peruanos demo (colección vacía). */
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
      this.logger.log(`Sembrados ${this.demoTaxis().length} servicios de taxi de demostración (Lima).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar taxis demo: ${(error as Error).message}`);
    }
  }

  private demoTaxis(): Partial<Taxi>[] {
    return [
      this.taxi({ titulo: 'Transfer Aeropuerto Jorge Chávez', tipo: 'sedan',
        capacidad: 4, base: 45, km: 2.5, unidades: 20, img: 170811,
        zonas: ['Miraflores', 'San Isidro', 'Barranco', 'Callao', 'San Borja'] }),
      this.taxi({ titulo: 'Lima Business VIP Transfer', tipo: 'premium',
        capacidad: 4, base: 80, km: 4.0, unidades: 8, img: 116675,
        zonas: ['Miraflores', 'San Isidro', 'La Molina', 'Surco'] }),
      this.taxi({ titulo: 'Van Grupal Lima (8 personas)', tipo: 'van',
        capacidad: 8, base: 120, km: 3.5, unidades: 5, img: 3158562,
        zonas: ['Lima Centro', 'Miraflores', 'Barranco', 'Callao'] }),
    ];
  }

  private taxi(d: {
    titulo: string; tipo: string; capacidad: number;
    base: number; km: number; unidades: number; img: number; zonas: string[];
  }): Partial<Taxi> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Taxi['comercioId'],
      vertical: VerticalKey.TAXIS,
      titulo: d.titulo,
      descripcion: `${d.titulo}: traslados en Lima con conductor, tarifa transparente y reserva inmediata.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: 'Lima', geo: { type: 'Point', coordinates: GEO_LIMA } },
      precioBase: d.base,
      moneda: 'PEN',
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
