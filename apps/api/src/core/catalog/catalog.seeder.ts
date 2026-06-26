import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Hotel, HotelDocument } from '../../verticals/hoteles/hotel.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000001');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const GEO: Record<string, [number, number]> = {
  Lima:     [-77.0428, -12.0464],
  Cusco:    [-71.9675, -13.5319],
  Arequipa: [-71.5376, -16.4090],
};

/**
 * Inserta hoteles peruanos de demostración la primera vez que arranca la API
 * con la colección vacía. Idempotente: no hace nada si ya hay datos.
 * Para un seed completo con usuarios y comercios usa el script seed:all.
 */
@Injectable()
export class CatalogSeeder implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeeder.name);

  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<HotelDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const total = await this.hotelModel.estimatedDocumentCount().exec();
    if (total > 0) return;

    try {
      await this.hotelModel.insertMany(this.demoHoteles());
      this.logger.log(`Sembrados ${this.demoHoteles().length} hoteles de demostración (Perú).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar hoteles demo: ${(error as Error).message}`);
    }
  }

  private demoHoteles(): Partial<Hotel>[] {
    return [
      this.hotel({
        titulo: 'Hotel Miraflores Palace Lima', ciudad: 'Lima', barrio: 'Miraflores',
        direccion: 'Av. Malecón de la Reserva 1035, Miraflores', estrellas: 5,
        rating: 9.2, reseñas: 1840, precio: 480, precioAnterior: 620, descuento: 23,
        img: [271624, 258154, 261102],
        amenities: ['🌊 Vista al Pacífico', '🏊 Piscina', '💆 Spa', '🍳 Desayuno buffet'],
        desayuno: true, disponibles: 6, destacado: true,
      }),
      this.hotel({
        titulo: 'Casa Andina Premium San Isidro', ciudad: 'Lima', barrio: 'San Isidro',
        direccion: 'Calle Los Libertadores 490, San Isidro', estrellas: 5,
        rating: 8.8, reseñas: 2340, precio: 320,
        img: [164595, 279746, 258154],
        amenities: ['🍽️ Restaurante', '🏋️ Gimnasio', '📶 WiFi Premium'],
        desayuno: false, disponibles: 10, destacado: false,
      }),
      this.hotel({
        titulo: 'Palacio del Inka Cusco', ciudad: 'Cusco', barrio: 'Centro Histórico',
        direccion: 'Plazoleta Santo Domingo 259, Cusco', estrellas: 5,
        rating: 9.5, reseñas: 3120, precio: 550,
        img: [1457842, 1571460, 1660995],
        amenities: ['🏛️ Patrimonio UNESCO', '💆 Spa inca', '🍽️ Restaurante gourmet'],
        desayuno: true, disponibles: 4, destacado: true,
      }),
      this.hotel({
        titulo: 'Hotel Libertador Arequipa', ciudad: 'Arequipa', barrio: 'Selva Alegre',
        direccion: 'Calle Selva Alegre 100, Yanahuara, Arequipa', estrellas: 5,
        rating: 8.6, reseñas: 980, precio: 280,
        img: [1134176, 164595, 271624],
        amenities: ['🌋 Vista al Misti', '🏊 Piscina', '🍽️ Restaurante'],
        desayuno: false, disponibles: 8, destacado: false,
      }),
    ];
  }

  private hotel(d: {
    titulo: string; ciudad: string; barrio: string; direccion: string;
    estrellas: number; rating: number; reseñas: number; precio: number;
    precioAnterior?: number; descuento?: number; img: number[]; amenities: string[];
    desayuno: boolean; disponibles: number; destacado: boolean;
  }): Partial<Hotel> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Hotel['comercioId'],
      vertical: VerticalKey.HOTELES,
      titulo: d.titulo,
      descripcion: `${d.titulo} ofrece una experiencia de alojamiento excepcional en ${d.ciudad}, con servicios premium y la mejor atención al huésped.`,
      imagenes: d.img.map((id) => px(id)),
      ubicacion: { ciudad: d.ciudad, geo: { type: 'Point', coordinates: GEO[d.ciudad] ?? GEO['Lima'] } },
      precioBase: d.precio,
      precioAnterior: d.precioAnterior,
      descuentoPct: d.descuento,
      moneda: 'PEN',
      destacado: d.destacado,
      prioridadRanking: d.destacado ? 10 : 0,
      estado: 'publicado',
      ratingPromedio: d.rating,
      totalReseñas: d.reseñas,
      estrellas: d.estrellas,
      barrio: d.barrio,
      direccion: d.direccion,
      desayunoIncluido: d.desayuno,
      cancelacionGratis: true,
      habitacionesDisponibles: d.disponibles,
      amenities: d.amenities,
      checkIn: '15:00',
      checkOut: '12:00',
      politicaCancelacion: 'Cancelación gratuita hasta 24 h antes del check-in.',
      habitaciones: [
        {
          id: 'r1', tipo: 'Habitación Deluxe',
          descripcion: 'Cómoda habitación con todas las comodidades.',
          capacidad: 2, camas: '1 cama queen', tamano: 35,
          precio: d.precio,
          amenities: ['📶 WiFi', '❄️ A/C', '📺 Smart TV'],
          imagenes: [px(d.img[1] ?? d.img[0], 600)],
          cantidad: Math.max(1, Math.floor(d.disponibles * 0.7)),
          disponible: d.disponibles > 0, cancelacionGratis: true,
        },
        {
          id: 'r2', tipo: 'Suite Premium',
          descripcion: 'Amplia suite con sala de estar y vistas privilegiadas.',
          capacidad: 3, camas: '1 cama king', tamano: 60,
          precio: Math.round(d.precio * 1.8),
          amenities: ['📶 WiFi', '❄️ A/C', '♨️ Jacuzzi'],
          imagenes: [px(d.img[2] ?? d.img[0], 600)],
          cantidad: 2, disponible: true, cancelacionGratis: false,
        },
      ],
    };
  }
}
