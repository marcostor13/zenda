import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SuplementoConfig, SuplementoConfigDocument } from './suplemento-config.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CrearSuplementoConfigDto, ActualizarSuplementoConfigDto } from 'shared';

@Injectable()
export class SuplementosService {
  constructor(
    @InjectModel(SuplementoConfig.name)
    private readonly suplementoModel: Model<SuplementoConfigDocument>,
  ) {}

  crear(comercioId: string, dto: CrearSuplementoConfigDto): Promise<SuplementoConfigDocument> {
    return this.suplementoModel.create({ ...dto, comercioId });
  }

  listarPorComercio(comercioId: string): Promise<SuplementoConfigDocument[]> {
    return this.suplementoModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async actualizar(
    id: string,
    comercioId: string,
    dto: ActualizarSuplementoConfigDto,
  ): Promise<SuplementoConfigDocument> {
    const config = await this.obtenerPropio(id, comercioId);
    Object.assign(config, dto);
    return config.save();
  }

  async eliminar(id: string, comercioId: string): Promise<void> {
    const config = await this.obtenerPropio(id, comercioId);
    await config.deleteOne();
  }

  private async obtenerPropio(id: string, comercioId: string): Promise<SuplementoConfigDocument> {
    const config = await this.suplementoModel.findById(id).exec();

    if (!config) {
      throw new DomainException('Suplemento no encontrado', 404);
    }

    if (config.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre este suplemento', 403);
    }

    return config;
  }
}
