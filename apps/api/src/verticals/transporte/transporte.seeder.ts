import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Transporte, TransporteDocument } from './transporte.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000002');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO_MADRID: [number, number] = [-3.7038, 40.4168];

/** Siembra servicios demo de transporte de animales en Madrid (colección vacía). */
@Injectable()
export class TransporteSeeder implements OnModuleInit {
  private readonly logger = new Logger(TransporteSeeder.name);

  constructor(
    @InjectModel(Transporte.name) private readonly model: Model<TransporteDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.TRANSPORTE }).exec();
    if (total > 0) return;

    try {
      await this.model.insertMany(this.demoTransportes());
      this.logger.log(`Sembrados ${this.demoTransportes().length} servicios de transporte de animales demo (Madrid).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar transportes demo: ${(error as Error).message}`);
    }
  }

  private demoTransportes(): Partial<Transporte>[] {
    return [
      this.transporte({
        titulo: 'DogVan Madrid — Traslados acondicionados',
        descripcion: 'Traslados de perros por Madrid en van acondicionada con jaulas homologadas, climatización y conductor especializado en manejo canino.',
        tipo: 'van_acondicionada', capacidad: 4, base: 12, km: 1.2, unidades: 6,
        imagenes: ['/images/categoria-transporte.jpg', px(1904105)],
        zonas: ['Madrid Centro', 'Chamberí', 'Salamanca', 'Retiro', 'Chamartín'],
        acompanante: false,
      }),
      this.transporte({
        titulo: 'PetMove Aeropuerto Barajas',
        descripcion: 'Transfer especializado de mascotas hacia y desde el Aeropuerto Adolfo Suárez Madrid-Barajas. Furgón climatizado y acompañante humano durante todo el trayecto.',
        tipo: 'furgon_climatizado', capacidad: 4, base: 20, km: 1.5, unidades: 3,
        imagenes: ['/images/categoria-transporte.jpg', px(2253275)],
        zonas: ['Aeropuerto Barajas', 'Madrid Centro', 'Alcobendas', 'San Sebastián de los Reyes'],
        acompanante: true,
      }),
      this.transporte({
        titulo: 'Traslados Caninos Sierra',
        descripcion: 'Traslados de perros entre Madrid y la Sierra de Guadarrama en coche adaptado. Ideal para excursiones, residencias caninas y visitas al veterinario.',
        tipo: 'coche', capacidad: 2, base: 10, km: 0.9, unidades: 2,
        imagenes: ['/images/categoria-transporte.jpg', px(1108099)],
        zonas: ['Madrid', 'Collado Villalba', 'Cercedilla', 'Navacerrada'],
        acompanante: false,
      }),
    ];
  }

  private transporte(d: {
    titulo: string; descripcion: string; tipo: Transporte['tipoVehiculo'];
    capacidad: number; base: number; km: number; unidades: number;
    imagenes: string[]; zonas: string[]; acompanante: boolean;
  }): Partial<Transporte> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Transporte['comercioId'],
      vertical: VerticalKey.TRANSPORTE,
      titulo: d.titulo,
      descripcion: d.descripcion,
      imagenes: d.imagenes,
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: GEO_MADRID } },
      precioBase: d.base,
      moneda: 'EUR',
      estado: 'publicado',
      destacado: false,
      ratingPromedio: 4.8,
      totalReseñas: 145,
      tipoVehiculo: d.tipo,
      capacidadPerros: d.capacidad,
      zonaCobertura: d.zonas,
      tarifaBase: d.base,
      tarifaKm: d.km,
      jaulasIncluidas: true,
      acompananteHumano: d.acompanante,
      soloPerros: true,
      unidadesDisponibles: d.unidades,
    };
  }
}
