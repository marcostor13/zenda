import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EntidadAuditada, regexLiteral } from 'shared';
import { UsersRepository } from '../users/users.repository';
import { RegistroAuditoria, RegistroAuditoriaDocument } from './auditoria.schema';

export interface RegistrarAccionParams {
  actorId: string;
  entidad: EntidadAuditada;
  entidadId?: string;
  descripcion: string;
  motivo?: string;
  antes?: Record<string, unknown>;
  despues?: Record<string, unknown>;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectModel(RegistroAuditoria.name) private readonly registroModel: Model<RegistroAuditoriaDocument>,
    private readonly usersRepo: UsersRepository,
  ) {}

  /**
   * Deja constancia de una acción administrativa. **Nunca hace fallar la
   * operación que la origina**: si la auditoría se cae, es peor perder el
   * cambio del administrador que perder el registro, así que sólo se avisa.
   */
  async registrar(params: RegistrarAccionParams): Promise<void> {
    try {
      const actor = await this.usersRepo.findById(params.actorId);
      await this.registroModel.create({
        actorId: new Types.ObjectId(params.actorId),
        actorNombre: actor?.nombre ?? 'Administración',
        entidad: params.entidad,
        entidadId: params.entidadId,
        descripcion: params.descripcion,
        motivo: params.motivo,
        antes: params.antes,
        despues: params.despues,
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar la acción administrativa: ${String(error)}`);
    }
  }

  async listar(
    filtros: { entidad?: EntidadAuditada; entidadId?: string; buscar?: string },
    page = 1,
    limite = 30,
  ): Promise<{ items: RegistroAuditoriaDocument[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filtros.entidad) query['entidad'] = filtros.entidad;
    if (filtros.entidadId) query['entidadId'] = filtros.entidadId;
    if (filtros.buscar) {
      const regex = regexLiteral(filtros.buscar);
      query['$or'] = [{ descripcion: regex }, { actorNombre: regex }, { motivo: regex }];
    }

    const skip = (page - 1) * limite;
    const [items, total] = await Promise.all([
      this.registroModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limite).lean<RegistroAuditoriaDocument[]>().exec(),
      this.registroModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }
}
