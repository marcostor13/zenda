import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Hoteles, HotelesDocument, RazasRestringidas, SuplementoPorTamanoMascota } from './hoteles.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000005');

const GEO_MADRID: [number, number] = [-3.7038, 40.4168];

/** Siembra hoteles pet-friendly demo de Madrid (colección vacía). */
@Injectable()
export class HotelesSeeder implements OnModuleInit {
  private readonly logger = new Logger(HotelesSeeder.name);

  constructor(@InjectModel(Hoteles.name) private readonly model: Model<HotelesDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.HOTELES }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembrados ${this.demo().length} hoteles pet-friendly demo (Madrid).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar hoteles pet-friendly demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Hoteles>[] {
    return [
      this.h({
        titulo: 'Gran Hotel Pet Friendly Madrid',
        precioBase: 95,
        suplementos: [
          { tamano: 'mini', precioPorNoche: 8 },
          { tamano: 'pequeno', precioPorNoche: 10 },
          { tamano: 'mediano', precioPorNoche: 15 },
          { tamano: 'grande', precioPorNoche: 20 },
        ],
        suplementoSegundaMascota: 5,
        maxMascotasPorReserva: 2,
        pesoMaximoMascotaKg: 40,
        razasRestringidas: 'ninguna',
        servicios: ['Camas para perros', 'Comederos/bebederos', 'Kit de bienvenida', 'Zona de paseo', 'Menú para mascotas'],
        unidades: 12,
      }),
      this.h({
        titulo: 'Hotel Boutique Dog Friendly Retiro',
        precioBase: 140,
        suplementos: [
          { tamano: 'mini', precioPorNoche: 10 },
          { tamano: 'pequeno', precioPorNoche: 12 },
          { tamano: 'mediano', precioPorNoche: 18 },
        ],
        suplementoSegundaMascota: 8,
        maxMascotasPorReserva: 1,
        pesoMaximoMascotaKg: 25,
        razasRestringidas: 'razas_gigantes',
        servicios: ['Parque canino cercano', 'Paseo', 'Peluquería', 'Veterinario cercano'],
        unidades: 6,
      }),
      this.h({
        titulo: 'Apartahotel Canino Chamberí',
        precioBase: 70,
        suplementos: [
          { tamano: 'pequeno', precioPorNoche: 8 },
          { tamano: 'mediano', precioPorNoche: 12 },
          { tamano: 'grande', precioPorNoche: 18 },
          { tamano: 'gigante', precioPorNoche: 25 },
        ],
        suplementoSegundaMascota: 6,
        pesoMaximoMascotaKg: undefined,
        razasRestringidas: 'ninguna',
        servicios: ['Camas para perros', 'Guardería', 'Zona de paseo'],
        unidades: 10,
      }),
    ];
  }

  private h(d: {
    titulo: string; precioBase: number; suplementos: SuplementoPorTamanoMascota[];
    suplementoSegundaMascota: number; maxMascotasPorReserva?: number; pesoMaximoMascotaKg?: number;
    razasRestringidas: RazasRestringidas; servicios: string[]; unidades: number;
  }): Partial<Hoteles> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Hoteles['comercioId'],
      vertical: VerticalKey.HOTELES,
      titulo: d.titulo,
      descripcion: `${d.titulo}: alojamiento pet-friendly donde tú y tu perro os quedáis juntos, con servicios pensados para ambos. Madrid, España.`,
      imagenes: ['/images/categoria-alojamiento.jpg'],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: GEO_MADRID } },
      precioBase: d.precioBase,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.6,
      totalReseñas: 57,
      admiteMascotas: true,
      maxMascotasPorReserva: d.maxMascotasPorReserva,
      pesoMaximoMascotaKg: d.pesoMaximoMascotaKg,
      razasRestringidas: d.razasRestringidas,
      especiesPermitidas: ['perro'],
      suplementoPorTamanoMascota: d.suplementos,
      suplementoSegundaMascotaPorNoche: d.suplementoSegundaMascota,
      serviciosPetfriendly: d.servicios,
      checkIn: '15:00',
      checkOut: '12:00',
      unidadesDisponibles: d.unidades,
    };
  }
}
