import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EstadoSolicitudPresupuesto } from 'shared';
import { SolicitudPresupuesto, SolicitudPresupuestoDocument } from './solicitud-presupuesto.schema';

const MAX_LISTADO = 100;

@Injectable()
export class PresupuestosRepository {
  constructor(
    @InjectModel(SolicitudPresupuesto.name) private readonly model: Model<SolicitudPresupuestoDocument>,
  ) {}

  crear(datos: Partial<SolicitudPresupuesto>): Promise<SolicitudPresupuestoDocument> {
    return this.model.create(datos);
  }

  porId(id: string): Promise<SolicitudPresupuestoDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findById(id).exec();
  }

  deUsuario(usuarioId: string): Promise<SolicitudPresupuestoDocument[]> {
    return this.model
      .find({ usuarioId: new Types.ObjectId(usuarioId) })
      .sort({ createdAt: -1 })
      .limit(MAX_LISTADO)
      .exec();
  }

  deComercio(comercioId: string): Promise<SolicitudPresupuestoDocument[]> {
    return this.model
      .find({ 'respuestas.comercioId': new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .limit(MAX_LISTADO)
      .exec();
  }

  /** Solicitudes abiertas cuyo día ya pasó: nadie va a poder atenderlas. */
  caducadas(hoy: Date): Promise<SolicitudPresupuestoDocument[]> {
    return this.model
      .find({ estado: EstadoSolicitudPresupuesto.ABIERTA, fechaServicio: { $lt: hoy } })
      .limit(MAX_LISTADO)
      .exec();
  }
}
