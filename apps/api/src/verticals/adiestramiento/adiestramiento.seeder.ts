import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey, horarioSemanal, DIAS_LABORABLES, HorarioDiaDto } from 'shared';
import { Adiestramiento, AdiestramientoDocument, ModalidadAdiestramiento } from './adiestramiento.schema';
import { DESPLAZAMIENTO_DEMO, ubicacionServicio } from '../ubicaciones-demo';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000005');

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
        horario: horarioSemanal(
          { dias: DIAS_LABORABLES, abre: '10:00', cierra: '19:00' },
          { dias: ['sabado'], abre: '10:00', cierra: '14:00' },
        ),
      }),
      this.a({
        titulo: 'Adiestramiento Positivo Cachorros',
        tipos: ['cachorros', 'socialización', 'obediencia básica'],
        modalidad: 'sesion', sesion: 35, programa: 280, sesiones: 8,
        edadMin: 3, capacidad: 8, aDomicilio: true,
        horario: horarioSemanal({ dias: [...DIAS_LABORABLES, 'sabado'], abre: '09:00', cierra: '20:00' }),
      }),
      this.a({
        titulo: 'Escuela Canina Casa de Campo',
        tipos: ['obediencia avanzada', 'deporte canino', 'guardia y protección'],
        modalidad: 'sesion', sesion: 50, programa: 450, sesiones: 12,
        edadMin: 6, capacidad: 4, aDomicilio: false,
        horario: horarioSemanal({
          dias: ['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
          abre: '09:00', cierra: '14:00', abre2: '16:00', cierra2: '20:00',
        }),
      }),
    ]
      // Cada listado a su barrio: con todos en el mismo punto los pines se
      // apilaban y el mapa del buscador parecía vacío.
      .map((servicio, indice) => ({
        ...servicio,
        ...ubicacionServicio(DESPLAZAMIENTO_DEMO.adiestramiento + indice),
      }));
  }

  private a(d: {
    titulo: string; tipos: string[]; modalidad: ModalidadAdiestramiento;
    sesion: number; programa: number; sesiones: number; edadMin: number;
    capacidad: number; aDomicilio: boolean; horario: HorarioDiaDto[];
  }): Partial<Adiestramiento> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Adiestramiento['comercioId'],
      vertical: VerticalKey.ADIESTRAMIENTO,
      titulo: d.titulo,
      descripcion: `${d.titulo}: adiestramiento canino en positivo con educadores certificados y planes a medida. Madrid, España.`,
      imagenes: ['/images/categoria-adiestramiento.jpg'],
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
