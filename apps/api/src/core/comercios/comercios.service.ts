import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ComerciosRepository } from './comercios.repository';
import { ComercioDocument, EstadoComercio } from './comercio.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { RegistrarComercioDto } from 'shared';

@Injectable()
export class ComerciosService {
  constructor(
    private readonly repo: ComerciosRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

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

  async obtenerReservasComercio(
    comercioId: string,
    limite = 20,
  ): Promise<ReservaDocument[]> {
    return this.reservaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .limit(limite)
      .lean()
      .exec() as unknown as ReservaDocument[];
  }

  async obtenerServiciosComercio(comercioId: string): Promise<ServicioDocument[]> {
    return this.servicioModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ prioridadRanking: -1, createdAt: -1 })
      .lean()
      .exec() as unknown as ServicioDocument[];
  }

  async cambiarEstadoServicio(
    servicioId: string,
    comercioId: string,
    estado: 'publicado' | 'pausado' | 'borrador',
  ): Promise<ServicioDocument> {
    const servicio = await this.servicioModel.findOneAndUpdate(
      { _id: new Types.ObjectId(servicioId), comercioId: new Types.ObjectId(comercioId) },
      { estado },
      { new: true },
    ).exec();
    if (!servicio) throw new DomainException('Servicio no encontrado', 404);
    return servicio as unknown as ServicioDocument;
  }

  async actualizarComercio(
    comercioId: string,
    datos: Partial<{ nombreComercial: string; logoUrl: string }>,
  ): Promise<ComercioDocument> {
    const actualizado = await this.repo.actualizar(comercioId, datos);
    if (!actualizado) throw new DomainException('Comercio no encontrado', 404);
    return actualizado;
  }

  // Reviews are not yet implemented — returns empty array so the frontend mock fallback kicks in.
  async obtenerResenasComercio(_comercioId: string): Promise<unknown[]> {
    return [];
  }
}
