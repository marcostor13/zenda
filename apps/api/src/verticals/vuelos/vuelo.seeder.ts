import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Vuelo, VueloDocument } from './vuelo.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000003');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO: Record<string, [number, number]> = {
  'Lima (LIM)':     [-77.0428, -12.0464],
  'Cusco (CUZ)':    [-71.9675, -13.5319],
  'Arequipa (AQP)': [-71.5376, -16.4090],
  'Piura (PIU)':    [-80.6282,  -5.1945],
};

/** Siembra vuelos domésticos peruanos demo (colección vacía). */
@Injectable()
export class VueloSeeder implements OnModuleInit {
  private readonly logger = new Logger(VueloSeeder.name);

  constructor(@InjectModel(Vuelo.name) private readonly vueloModel: Model<VueloDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.vueloModel.countDocuments({ vertical: VerticalKey.VUELOS }).exec();
    if (total > 0) return;
    try {
      await this.vueloModel.insertMany(this.demoVuelos());
      this.logger.log(`Sembrados ${this.demoVuelos().length} vuelos de demostración (Perú).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar vuelos demo: ${(error as Error).message}`);
    }
  }

  private demoVuelos(): Partial<Vuelo>[] {
    return [
      this.vuelo({ origen: 'Lima (LIM)', destino: 'Cusco (CUZ)', aerolinea: 'Latam Peru',
        precio: 189, asientos: 120, img: 358319,
        salida: new Date('2026-09-01T06:00:00Z'), llegada: new Date('2026-09-01T07:20:00Z') }),
      this.vuelo({ origen: 'Lima (LIM)', destino: 'Arequipa (AQP)', aerolinea: 'Sky Airline',
        precio: 149, asientos: 90, img: 62623,
        salida: new Date('2026-09-05T07:30:00Z'), llegada: new Date('2026-09-05T09:00:00Z') }),
      this.vuelo({ origen: 'Lima (LIM)', destino: 'Piura (PIU)', aerolinea: 'Latam Peru',
        precio: 169, asientos: 80, img: 723240,
        salida: new Date('2026-09-10T09:00:00Z'), llegada: new Date('2026-09-10T10:30:00Z') }),
    ];
  }

  private vuelo(d: {
    origen: string; destino: string; aerolinea: string; precio: number;
    asientos: number; img: number; salida: Date; llegada: Date;
  }): Partial<Vuelo> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Vuelo['comercioId'],
      vertical: VerticalKey.VUELOS,
      titulo: `${d.origen} → ${d.destino}`,
      descripcion: `Vuelo directo ${d.origen} → ${d.destino} operado por ${d.aerolinea}. 1 maleta de mano incluida.`,
      imagenes: [px(d.img)],
      ubicacion: { ciudad: d.origen, geo: { type: 'Point', coordinates: GEO[d.origen] ?? GEO['Lima (LIM)'] } },
      precioBase: d.precio,
      moneda: 'PEN',
      estado: 'publicado',
      ratingPromedio: 4.4,
      totalReseñas: 540,
      origen: d.origen,
      destino: d.destino,
      aerolinea: d.aerolinea,
      fechaSalida: d.salida,
      fechaLlegada: d.llegada,
      asientosTotales: d.asientos,
      asientosDisponibles: Math.floor(d.asientos * 0.4),
      precioAsiento: d.precio,
    };
  }
}
