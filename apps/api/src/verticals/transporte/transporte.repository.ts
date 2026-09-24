import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerticalKey } from 'shared';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { Transporte } from './transporte.schema';

/** Lo que el cotizador necesita de cada empresa: su tarifario y lo justo para la tarjeta. */
export type TransporteCotizable = Transporte & { _id: Types.ObjectId };

/** Tope de empresas que se cotizan por búsqueda: la cotización es en memoria. */
const MAX_CANDIDATOS = 300;

/**
 * Todo el tarifario del alta (`ConfigTransporte`) y lo justo para la tarjeta.
 * Se excluye lo pesado que el cotizador no lee: la descripción y el horario.
 */
const CAMPOS_COTIZACION = '-descripcion -horario -excepcionesHorario -trayecto';

@Injectable()
export class TransporteRepository {
  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  /**
   * Empresas de transporte que se pueden reservar hoy. Filtra por las dos
   * igualdades con las que empieza el índice ESR de `servicios`; la cobertura se
   * decide después, en memoria, porque compara provincias normalizadas.
   */
  async reservables(): Promise<TransporteCotizable[]> {
    return this.servicioModel
      .find({ estado: 'publicado', comercioActivo: true, vertical: VerticalKey.TRANSPORTE })
      .select(CAMPOS_COTIZACION)
      .sort({ prioridadRanking: -1 })
      .limit(MAX_CANDIDATOS)
      .lean()
      .exec() as unknown as Promise<TransporteCotizable[]>;
  }

  async porId(servicioId: string): Promise<TransporteCotizable | null> {
    if (!Types.ObjectId.isValid(servicioId)) return null;
    return this.servicioModel
      .findOne({ _id: servicioId, vertical: VerticalKey.TRANSPORTE })
      .select(CAMPOS_COTIZACION)
      .lean()
      .exec() as unknown as Promise<TransporteCotizable | null>;
  }
}
