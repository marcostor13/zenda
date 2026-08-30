import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey, horarioSemanal, DIAS_LABORABLES, HorarioDiaDto } from 'shared';
import { Peluqueria, PeluqueriaDocument, ServicioGrooming } from './peluqueria.schema';
import { DESPLAZAMIENTO_DEMO, ubicacionServicio } from '../ubicaciones-demo';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000004');

/** Siembra peluquerías caninas demo de Madrid (colección vacía). */
@Injectable()
export class PeluqueriaSeeder implements OnModuleInit {
  private readonly logger = new Logger(PeluqueriaSeeder.name);

  constructor(@InjectModel(Peluqueria.name) private readonly model: Model<PeluqueriaDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.PELUQUERIA }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembradas ${this.demo().length} peluquerías caninas demo (Madrid).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar peluquerías caninas demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Peluqueria>[] {
    return [
      this.p({
        titulo: 'Estilo Canino Malasaña',
        servicios: [
          { nombre: 'Baño completo', precio: 25, duracionMin: 45 },
          { nombre: 'Corte de raza', precio: 40, duracionMin: 60 },
          { nombre: 'Deslanado', precio: 35, duracionMin: 60 },
          { nombre: 'Spa premium', precio: 55, duracionMin: 90 },
        ],
        capacidad: 3, aDomicilio: false,
        horario: horarioSemanal({ dias: [...DIAS_LABORABLES, 'sabado'], abre: '10:00', cierra: '20:00' }),
      }),
      this.p({
        titulo: 'Peluquería Guau Salamanca',
        servicios: [
          { nombre: 'Baño completo', precio: 30, duracionMin: 45 },
          { nombre: 'Corte de raza', precio: 45, duracionMin: 60, tamanoPerro: 'mediano' },
          { nombre: 'Corte de uñas', precio: 12, duracionMin: 15 },
          { nombre: 'Spa premium', precio: 65, duracionMin: 90 },
        ],
        capacidad: 2, aDomicilio: true,
        horario: horarioSemanal(
          { dias: DIAS_LABORABLES, abre: '09:30', cierra: '19:30' },
          { dias: ['sabado'], abre: '10:00', cierra: '14:00' },
        ),
      }),
      this.p({
        titulo: 'Dog Groom Chueca',
        servicios: [
          { nombre: 'Baño completo', precio: 22, duracionMin: 40 },
          { nombre: 'Deslanado', precio: 32, duracionMin: 60, tamanoPerro: 'grande' },
          { nombre: 'Higiene dental y oídos', precio: 18, duracionMin: 20 },
        ],
        capacidad: 2, aDomicilio: false,
        horario: horarioSemanal({ dias: ['martes', 'miercoles', 'jueves', 'viernes', 'sabado'], abre: '10:00', cierra: '19:00' }),
      }),
    ]
      // Cada listado a su barrio: con todos en el mismo punto los pines se
      // apilaban y el mapa del buscador parecía vacío.
      .map((servicio, indice) => ({
        ...servicio,
        ...ubicacionServicio(DESPLAZAMIENTO_DEMO.peluqueria + indice),
      }));
  }

  private p(d: {
    titulo: string; servicios: ServicioGrooming[]; capacidad: number;
    aDomicilio: boolean; horario: HorarioDiaDto[];
  }): Partial<Peluqueria> {
    const precioBase = Math.min(...d.servicios.map((s) => s.precio));
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Peluqueria['comercioId'],
      vertical: VerticalKey.PELUQUERIA,
      titulo: d.titulo,
      descripcion: `${d.titulo}: grooming profesional para perros con productos hipoalergénicos y trato paciente. Madrid, España.`,
      imagenes: ['/images/categoria-peluqueria.jpg'],
      precioBase,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.7,
      totalReseñas: 84,
      serviciosGrooming: d.servicios,
      duracionSlotMin: 60,
      capacidadSimultanea: d.capacidad,
      cuposDisponibles: d.capacidad * 4,
      aDomicilio: d.aDomicilio,
      horario: d.horario,
    };
  }
}
