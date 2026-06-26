import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Vuelo, VueloDocument } from './vuelo.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('000000000000000000000003');
const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/** Siembra vuelos europeos demo la primera vez (colección de vuelos vacía). */
@Injectable()
export class VueloSeeder implements OnModuleInit {
  private readonly logger = new Logger(VueloSeeder.name);

  constructor(@InjectModel(Vuelo.name) private readonly vueloModel: Model<VueloDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.vueloModel.countDocuments({ vertical: VerticalKey.VUELOS }).exec();
    if (total > 0) return;
    try {
      await this.vueloModel.insertMany(this.demoVuelos());
      this.logger.log(`Sembrados ${this.demoVuelos().length} vuelos de demostración.`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar vuelos demo: ${(error as Error).message}`);
    }
  }

  private demoVuelos(): Partial<Vuelo>[] {
    return [
      this.vuelo({ origen: 'Madrid (MAD)', destino: 'Barcelona (BCN)', aerolinea: 'Iberia',
        precio: 79, asientos: 48, img: 358319 }),
      this.vuelo({ origen: 'Barcelona (BCN)', destino: 'París (CDG)', aerolinea: 'Vueling',
        precio: 119, asientos: 22, img: 62623 }),
      this.vuelo({ origen: 'Madrid (MAD)', destino: 'Roma (FCO)', aerolinea: 'Air Europa',
        precio: 99, asientos: 60, img: 723240 }),
    ];
  }

  private vuelo(d: {
    origen: string; destino: string; aerolinea: string; precio: number; asientos: number; img: number;
  }): Partial<Vuelo> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Vuelo['comercioId'],
      vertical: VerticalKey.VUELOS,
      titulo: `${d.origen} → ${d.destino}`,
      descripcion: `Vuelo directo ${d.origen} → ${d.destino} operado por ${d.aerolinea}.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: d.origen },
      precioBase: d.precio,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.4,
      totalReseñas: 540,
      origen: d.origen,
      destino: d.destino,
      aerolinea: d.aerolinea,
      fechaSalida: new Date('2026-08-01T08:00:00Z'),
      fechaLlegada: new Date('2026-08-01T09:30:00Z'),
      asientosTotales: d.asientos,
      asientosDisponibles: d.asientos,
      precioAsiento: d.precio,
    };
  }
}
