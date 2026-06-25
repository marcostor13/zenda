import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Hotel, HotelDocument } from '../../verticals/hoteles/hotel.schema';

/** ObjectId fijo del comercio demo (datos de ejemplo). */
const DEMO_COMERCIO_ID = new Types.ObjectId('000000000000000000000001');

const px = (id: number, w = 800): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/**
 * Inserta hoteles europeos de demostración la primera vez que arranca la API
 * con la colección vacía, para que el catálogo devuelva datos reales sin
 * depender de mocks en el frontend. Idempotente: no hace nada si ya hay datos.
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
      this.logger.log(`Sembrados ${this.demoHoteles().length} hoteles de demostración.`);
    } catch (error) {
      // El seed es opcional: no debe impedir el arranque de la API.
      this.logger.warn(`No se pudieron sembrar hoteles demo: ${(error as Error).message}`);
    }
  }

  private demoHoteles(): Partial<Hotel>[] {
    return [
      this.hotel({
        titulo: 'Gran Hotel Madrid Salamanca', ciudad: 'Madrid', barrio: 'Salamanca',
        direccion: 'Calle de Serrano 463', estrellas: 5, rating: 9.2, reseñas: 2840,
        precio: 320, precioAnterior: 420, descuento: 24, img: [271624, 261102, 1134176],
        amenities: ['🌊 Piscina', '🅿️ Parking', '🍳 Desayuno', '💆 Spa'],
        desayuno: true, disponibles: 4, destacado: true,
      }),
      this.hotel({
        titulo: 'Hotel Catalonia Barcelona', ciudad: 'Barcelona', barrio: 'Eixample',
        direccion: 'Passeig de Gràcia 130', estrellas: 4, rating: 8.9, reseñas: 1240,
        precio: 185, img: [258154, 164595, 271643],
        amenities: ['♨️ Jacuzzi', '🍽️ Restaurante', '🛎️ Concierge'],
        desayuno: false, disponibles: 8, destacado: false,
      }),
      this.hotel({
        titulo: 'Grand Hotel Villa d’Este Como', ciudad: 'Como', barrio: 'Cernobbio',
        direccion: 'Via Regina 40', estrellas: 5, rating: 9.4, reseñas: 890,
        precio: 450, img: [1457842, 1571460, 1660995],
        amenities: ['🌊 Vista lago', '🛶 Kayak', '🍽️ Restaurante'],
        desayuno: true, disponibles: 2, destacado: true,
      }),
      this.hotel({
        titulo: 'JW Marriott Madrid', ciudad: 'Madrid', barrio: 'Centro',
        direccion: 'Paseo de la Castellana 615', estrellas: 5, rating: 9.1, reseñas: 3210,
        precio: 480, img: [279746, 271624, 261102],
        amenities: ['🏊 Piscina infinity', '💆 Spa', '🍸 Bar'],
        desayuno: false, disponibles: 12, destacado: false,
      }),
      this.hotel({
        titulo: 'Belmond Hotel Caruso Amalfi', ciudad: 'Amalfi', barrio: 'Ravello',
        direccion: 'Piazza San Giovanni del Toro 2', estrellas: 5, rating: 9.6, reseñas: 1520,
        precio: 890, img: [1134176, 164595, 258154],
        amenities: ['🌅 Vista al mar', '♨️ Jacuzzi', '🍷 Bodega'],
        desayuno: true, disponibles: 3, destacado: true,
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
      descripcion: `${d.titulo} ofrece una experiencia de alojamiento excepcional en ${d.ciudad}, ` +
        'con servicios premium, ubicación inmejorable y la mejor atención al huésped.',
      imagenes: d.img.map((id) => px(id)),
      ubicacion: { ciudad: d.ciudad },
      precioBase: d.precio,
      precioAnterior: d.precioAnterior,
      descuentoPct: d.descuento,
      moneda: 'EUR',
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
          id: 'r1', tipo: 'Habitación Superior',
          descripcion: 'Cómoda habitación con todas las comodidades.',
          capacidad: 2, camas: '1 cama doble', tamano: 32,
          precio: d.precio, precioAnterior: d.precioAnterior,
          amenities: ['📶 WiFi', '❄️ A/C', '📺 Smart TV'],
          imagenes: [px(d.img[1] ?? d.img[0], 600)], cantidad: Math.max(1, d.disponibles),
          disponible: d.disponibles > 0, cancelacionGratis: true,
        },
        {
          id: 'r2', tipo: 'Suite Deluxe',
          descripcion: 'Amplia suite con sala de estar y vistas.',
          capacidad: 3, camas: '1 cama king', tamano: 52,
          precio: Math.round(d.precio * 1.8), amenities: ['📶 WiFi', '❄️ A/C', '♨️ Jacuzzi'],
          imagenes: [px(d.img[2] ?? d.img[0], 600)], cantidad: 2,
          disponible: true, cancelacionGratis: true,
        },
      ],
    };
  }
}
