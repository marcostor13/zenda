import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Veterinaria, VeterinariaDocument, ServicioClinico } from './veterinaria.schema';

const DEMO_COMERCIO_ID = new Types.ObjectId('b00000000000000000000003');

const GEO_MADRID: [number, number] = [-3.7038, 40.4168];

/** Siembra clínicas veterinarias demo de Madrid (colección vacía). */
@Injectable()
export class VeterinariaSeeder implements OnModuleInit {
  private readonly logger = new Logger(VeterinariaSeeder.name);

  constructor(@InjectModel(Veterinaria.name) private readonly model: Model<VeterinariaDocument>) {}

  async onModuleInit(): Promise<void> {
    const total = await this.model.countDocuments({ vertical: VerticalKey.VETERINARIA }).exec();
    if (total > 0) return;
    try {
      await this.model.insertMany(this.demo());
      this.logger.log(`Sembradas ${this.demo().length} clínicas veterinarias demo (Madrid).`);
    } catch (error) {
      this.logger.warn(`No se pudieron sembrar clínicas veterinarias demo: ${(error as Error).message}`);
    }
  }

  private demo(): Partial<Veterinaria>[] {
    return [
      this.v({
        titulo: 'Clínica Veterinaria Royal Paws',
        especialidades: ['medicina general', 'vacunación', 'odontología', 'radiografía', 'urgencias'],
        servicios: [
          { nombre: 'Consulta general', precio: 35, duracionMin: 30 },
          { nombre: 'Vacunación', precio: 25, duracionMin: 15 },
          { nombre: 'Limpieza dental', precio: 250, duracionMin: 60 },
          { nombre: 'Radiografía', precio: 80, duracionMin: 30 },
        ],
        precioConsulta: 35, citasPorDia: 16, urgencias: true,
        horario: 'L–D 24h (urgencias) · Consultas L–V 09:00–20:00',
        img: '/images/categoria-veterinaria.jpg',
      }),
      this.v({
        titulo: 'Hospital Veterinario Chamartín',
        especialidades: ['medicina general', 'cirugía', 'dermatología', 'traumatología'],
        servicios: [
          { nombre: 'Consulta general', precio: 40, duracionMin: 30 },
          { nombre: 'Consulta dermatología', precio: 55, duracionMin: 30 },
          { nombre: 'Ecografía', precio: 70, duracionMin: 30 },
          { nombre: 'Cirugía menor', precio: 320, duracionMin: 90 },
        ],
        precioConsulta: 40, citasPorDia: 24, urgencias: false,
        horario: 'L–V 09:00–21:00 · S 10:00–14:00',
        img: '/images/hero-detalle.jpg',
      }),
      this.v({
        titulo: 'Veterinaria Lavapiés Low Cost',
        especialidades: ['medicina general', 'vacunación'],
        servicios: [
          { nombre: 'Consulta general', precio: 25, duracionMin: 20 },
          { nombre: 'Vacunación', precio: 18, duracionMin: 15 },
          { nombre: 'Desparasitación', precio: 15, duracionMin: 15 },
        ],
        precioConsulta: 25, citasPorDia: 20, urgencias: false,
        horario: 'L–S 10:00–20:00',
        img: '/images/categoria-veterinaria.jpg',
      }),
    ];
  }

  private v(d: {
    titulo: string; especialidades: string[]; servicios: ServicioClinico[];
    precioConsulta: number; citasPorDia: number; urgencias: boolean;
    horario: string; img: string;
  }): Partial<Veterinaria> {
    return {
      comercioId: DEMO_COMERCIO_ID as unknown as Veterinaria['comercioId'],
      vertical: VerticalKey.VETERINARIA,
      titulo: d.titulo,
      descripcion: `${d.titulo}: atención veterinaria para perros con equipo colegiado, diagnóstico por imagen y trato cercano. Madrid, España.`,
      imagenes: [d.img],
      ubicacion: { ciudad: 'Madrid', geo: { type: 'Point', coordinates: GEO_MADRID } },
      precioBase: d.precioConsulta,
      moneda: 'EUR',
      estado: 'publicado',
      ratingPromedio: 4.8,
      totalReseñas: 96,
      especialidades: d.especialidades,
      serviciosClinicos: d.servicios,
      duracionCitaMin: 30,
      citasPorDia: d.citasPorDia,
      citasDisponibles: Math.floor(d.citasPorDia * 0.5),
      atiendeUrgencias: d.urgencias,
      horario: d.horario,
      precioConsulta: d.precioConsulta,
    };
  }
}
