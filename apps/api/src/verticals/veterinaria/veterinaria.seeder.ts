import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey, ServicioClinicoTipo, SERVICIO_CLINICO_LABELS } from 'shared';
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

  /** Servicio clínico del catálogo cerrado, con su etiqueta oficial. */
  private sc(
    tipo: ServicioClinicoTipo,
    precio: number,
    duracionMin: number,
    esPrecioCerrado = false,
  ): ServicioClinico {
    return { tipo, nombre: SERVICIO_CLINICO_LABELS[tipo], precio, duracionMin, esPrecioCerrado };
  }

  private demo(): Partial<Veterinaria>[] {
    return [
      // Solo servicios del catálogo cerrado: Doogking no intermedia
      // dermatología, cirugía ni pruebas de precio abierto (plan unificado §2.2).
      this.v({
        titulo: 'Clínica Veterinaria Royal Paws',
        especialidades: ['medicina general', 'vacunación', 'odontología', 'urgencias'],
        servicios: [
          this.sc(ServicioClinicoTipo.CONSULTA_GENERAL, 35, 30),
          this.sc(ServicioClinicoTipo.VACUNACION, 25, 15, true),
          this.sc(ServicioClinicoTipo.HIGIENE_DENTAL, 250, 60, true),
          this.sc(ServicioClinicoTipo.CONSULTA_URGENTE, 60, 30),
        ],
        precioConsulta: 35, citasPorDia: 16, urgencias: true,
        horario: 'L–D 24h (urgencias) · Consultas L–V 09:00–20:00',
        img: '/images/categoria-veterinaria.jpg',
      }),
      this.v({
        titulo: 'Hospital Veterinario Chamartín',
        especialidades: ['medicina general', 'traumatología'],
        servicios: [
          this.sc(ServicioClinicoTipo.CONSULTA_GENERAL, 40, 30),
          this.sc(ServicioClinicoTipo.CONSULTA_REVISION, 30, 20),
          this.sc(ServicioClinicoTipo.SEGUNDA_OPINION, 55, 40),
          this.sc(ServicioClinicoTipo.ESTERILIZACION, 320, 90, true),
        ],
        precioConsulta: 40, citasPorDia: 24, urgencias: false,
        horario: 'L–V 09:00–21:00 · S 10:00–14:00',
        img: '/images/hero-detalle.jpg',
      }),
      this.v({
        titulo: 'Veterinaria Lavapiés Low Cost',
        especialidades: ['medicina general', 'vacunación'],
        servicios: [
          this.sc(ServicioClinicoTipo.CONSULTA_GENERAL, 25, 20),
          this.sc(ServicioClinicoTipo.VACUNACION, 18, 15, true),
          this.sc(ServicioClinicoTipo.MICROCHIP, 30, 15, true),
          this.sc(ServicioClinicoTipo.TELECONSULTA, 15, 15, true),
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
