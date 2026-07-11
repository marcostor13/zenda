import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notificacion, NotificacionDocument, TipoNotificacion } from './notificacion.schema';

export interface CrearNotificacionData {
  reservaId?: Types.ObjectId;
  tipo: TipoNotificacion;
  destinatario: string;
  asunto: string;
  cuerpo: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectModel(Notificacion.name) private readonly model: Model<NotificacionDocument>,
  ) {}

  crear(data: CrearNotificacionData): Promise<NotificacionDocument> {
    return this.model.create({ ...data, estado: 'pendiente' });
  }

  marcarEnviado(id: Types.ObjectId): Promise<void> {
    return this.model.updateOne({ _id: id }, { estado: 'enviado' }).exec().then(() => undefined);
  }

  marcarFallido(id: Types.ObjectId, error: string): Promise<void> {
    return this.model.updateOne({ _id: id }, { estado: 'fallido', error }).exec().then(() => undefined);
  }
}
