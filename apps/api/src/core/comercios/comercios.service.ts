import { Injectable } from '@nestjs/common';
import { ComerciosRepository } from './comercios.repository';
import { ComercioDocument, EstadoComercio } from './comercio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { RegistrarComercioDto } from 'shared';

@Injectable()
export class ComerciosService {
  constructor(private readonly repo: ComerciosRepository) {}

  async registrar(dto: RegistrarComercioDto): Promise<ComercioDocument> {
    const existente = await this.repo.findByVatNumber(dto.vatNumber);
    if (existente) {
      throw new DomainException('Ya existe un comercio con ese identificador fiscal', 409);
    }

    return this.repo.crear({
      razonSocial: dto.razonSocial,
      vatNumber: dto.vatNumber,
      nombreComercial: dto.nombreComercial,
      logoUrl: dto.logoUrl,
      verticales: dto.verticales,
    });
  }

  async obtener(id: string): Promise<ComercioDocument> {
    const comercio = await this.repo.findById(id);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return comercio;
  }

  async listar(estado?: EstadoComercio): Promise<ComercioDocument[]> {
    return this.repo.listar(estado ? { estado } : {});
  }

  async cambiarEstado(id: string, estado: EstadoComercio): Promise<ComercioDocument> {
    const comercio = await this.repo.actualizarEstado(id, estado);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return comercio;
  }
}
