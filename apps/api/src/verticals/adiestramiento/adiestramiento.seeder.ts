import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Adiestramiento, AdiestramientoDocument, ModalidadAdiestramiento } from './adiestramiento.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000005');

const GEO_MADRID: [number, number] = [-3.7038, 40.4168];

/** Siembra servicios de adiestramiento canino demo de Madrid (colección vacía). */
@Injectable()
export class AdiestramientoSeeder implements OnModuleInit {
  private readonly logger = new Logger(AdiestramientoSeeder.name);

  constructor(@InjectModel(Adiestramiento.name) private readonly model: Model<AdiestramientoDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.ADIESTRAMIENTO }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembrados ${this.demo().length} servicios de adiestramiento demo (Madrid).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar adiestramientos demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Adiestramiento>[] {
    return [
      this.a({
        titulo: 'Educadores Caninos K9 Madrid',
        tipos: ['obediencia básica', 'modificación de conducta'],
        modalidad: 'programa', sesion: 40, programa: 320, sesiones: 10,
        edadMin: 4, capacidad: 6, aDomicilio: false,
        horario: 'L–V 10:00–19:00 · S 10:00–14:00',
      }),
      this.a({
        titulo: 'Adiestramiento Positivo Cachorros',
        tipos: ['cachorros', 'socialización', 'obediencia básica'],
        modalidad: 'sesion', sesion: 35, programa: 280, sesiones: 8,
        edadMin: 3, capacidad: 8, aDomicilio: true,
        horario: 'L–S 09:00–20:00',
      }),
      this.a({
        titulo: 'Escuela Canina Casa de Campo',
        tipos: ['obediencia avanzada', 'deporte canino', 'guardia y protección'],
        modalidad: 'sesion', sesion: 50, programa: 450, sesiones: 12,
        edadMin: 6, capacidad: 4, aDomicilio: false,
        horario: 'M–D 09:00–14:00 y 16:00–20:00',
      }),
    ];
  }

  private a(d: {
    titulo: string; tipos: string[]; modalidad: ModalidadAdiestramiento;
    sesion: number; programa: number; sesiones: number; edadMin: number;
    capacidad: number; aDomicilio: boolean; horario: string;
  }): Partial<Adiestramiento> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Adiestramiento['comercioId'],
      vertical: VerticalKey.ADIESTRAMIENTO,
      titulo: d.titulo,
      descripcion: `${d.titulo}: adiestramiento canino en positivo con educadores certificados y planes a medida. Madrid, España.`,
      imagenes: ['/images/categoria-adiestramiento.jpg'],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: GEO_MADRID } },
      precioBase: d.sesion,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.9,
      totalReseñas: 72,
      tiposAdiestramiento: d.tipos,
      modalidad: d.modalidad,
      precioSesion: d.sesion,
      precioPrograma: d.programa,
      sesionesPorPrograma: d.sesiones,
      edadMinimaMeses: d.edadMin,
      aDomicilio: d.aDomicilio,
      capacidadPorSesion: d.capacidad,
      cuposDisponibles: d.capacidad * 3,
      horario: d.horario,
    };
  }
}
