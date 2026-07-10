import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Alojamiento, AlojamientoDocument, EspacioCanino } from './alojamiento.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000001');

const GEO_MADRID: [number, number] = [-3.7038, 40.4168];

/** Siembra alojamientos caninos demo en Madrid (colección vacía). */
@Injectable()
export class AlojamientoSeeder implements OnModuleInit {
  private readonly logger = new Logger(AlojamientoSeeder.name);

  constructor(@InjectModel(Alojamiento.name) private readonly model: Model<AlojamientoDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.ALOJAMIENTO }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembrados ${this.demo().length} alojamientos caninos demo (Madrid).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar alojamientos caninos demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Alojamiento>[] {
    return [
      this.a({
        titulo: 'Villa Canina Retiro',
        descripcion:
          'Villa Canina Retiro: suites individuales con piscina canina, cámaras 24/7 y veterinario de guardia. Junto al parque de El Retiro, Madrid.',
        barrio: 'Retiro',
        direccion: 'Calle de Alfonso XII 40, Madrid',
        precioBase: 45,
        precioAnterior: 55,
        descuentoPct: 18,
        imagenes: ['/images/alojamiento-interior.jpg', '/images/ejemplo-alojamiento-1.jpg'],
        amenities: ['piscina canina', 'cámaras 24/7', 'veterinario de guardia', 'paseos diarios', 'patio privado'],
        espacios: [
          {
            tipo: 'suite',
            tamanoMaxPerro: 'grande',
            descripcion: 'Suite individual con cama ortopédica y salida a patio privado.',
            precioNoche: 45,
            precioAnterior: 55,
            amenities: ['cama ortopédica', 'climatización', 'webcam en directo'],
            imagenes: ['/images/alojamiento-interior.jpg'],
            cantidad: 6,
            disponible: true,
            cancelacionGratis: true,
          },
          {
            tipo: 'estandar',
            tamanoMaxPerro: 'mediano',
            descripcion: 'Espacio estándar con acceso a zona común de juegos.',
            precioNoche: 35,
            amenities: ['zona de juegos', 'climatización'],
            imagenes: ['/images/ejemplo-alojamiento-1.jpg'],
            cantidad: 4,
            disponible: true,
            cancelacionGratis: true,
          },
        ],
        espaciosDisponibles: 10,
        paseosIncluidos: true,
        camaras24h: true,
      }),
      this.a({
        titulo: 'City Paws Hotel Chamberí',
        descripcion:
          'City Paws Hotel Chamberí: suites climatizadas en pleno centro de Madrid, con paseos urbanos diarios y seguimiento por app.',
        barrio: 'Chamberí',
        direccion: 'Calle de Fuencarral 120, Madrid',
        precioBase: 30,
        imagenes: ['/images/alojamiento-boutique.jpg', '/images/ejemplo-alojamiento-2.jpg'],
        amenities: ['suites climatizadas', 'paseos diarios', 'cámaras 24/7', 'recogida a domicilio'],
        espacios: [
          {
            tipo: 'suite',
            tamanoMaxPerro: 'mediano',
            descripcion: 'Suite climatizada con luz natural y música relajante.',
            precioNoche: 30,
            amenities: ['climatización', 'música relajante'],
            imagenes: ['/images/alojamiento-boutique.jpg'],
            cantidad: 8,
            disponible: true,
            cancelacionGratis: true,
          },
        ],
        espaciosDisponibles: 8,
        paseosIncluidos: true,
        camaras24h: true,
      }),
      this.a({
        titulo: 'Residencia Campestre Las Rozas',
        descripcion:
          'Residencia Campestre Las Rozas: espacios compartidos con gran patio exterior y socialización supervisada, a 20 minutos de Madrid.',
        barrio: 'Las Rozas',
        direccion: 'Camino del Garzo 15, Las Rozas de Madrid',
        precioBase: 24,
        imagenes: ['/images/alojamiento-exterior.jpg', '/images/ejemplo-alojamiento-2.jpg'],
        amenities: ['patio exterior', 'socialización supervisada', 'paseos diarios', 'piscina de verano'],
        espacios: [
          {
            tipo: 'compartido',
            tamanoMaxPerro: 'gigante',
            descripcion: 'Espacio compartido con patio de 500 m² y grupos por tamaño.',
            precioNoche: 24,
            amenities: ['patio 500 m²', 'grupos por tamaño'],
            imagenes: ['/images/alojamiento-exterior.jpg'],
            cantidad: 12,
            disponible: true,
            cancelacionGratis: true,
          },
        ],
        espaciosDisponibles: 12,
        paseosIncluidos: true,
        camaras24h: false,
      }),
    ];
  }

  private a(d: {
    titulo: string;
    descripcion: string;
    barrio: string;
    direccion: string;
    precioBase: number;
    precioAnterior?: number;
    descuentoPct?: number;
    imagenes: string[];
    amenities: string[];
    espacios: EspacioCanino[];
    espaciosDisponibles: number;
    paseosIncluidos: boolean;
    camaras24h: boolean;
  }): Partial<Alojamiento> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Alojamiento['comercioId'],
      vertical: VerticalKey.ALOJAMIENTO,
      titulo: d.titulo,
      descripcion: d.descripcion,
      imagenes: d.imagenes,
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: GEO_MADRID } },
      precioBase: d.precioBase,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.8,
      totalReseñas: 96,
      espacios: d.espacios,
      amenities: d.amenities,
      checkIn: '12:00',
      checkOut: '11:00',
      politicaCancelacion: 'Cancelación gratuita hasta 48 horas antes del check-in.',
      requisitoVacunas: true,
      paseosIncluidos: d.paseosIncluidos,
      camaras24h: d.camaras24h,
      espaciosDisponibles: d.espaciosDisponibles,
      precioAnterior: d.precioAnterior,
      descuentoPct: d.descuentoPct,
      cancelacionGratis: true,
      barrio: d.barrio,
      direccion: d.direccion,
    };
  }
}
