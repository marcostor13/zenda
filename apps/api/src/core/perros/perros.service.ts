import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Perro, PerroDocument } from './perro.schema';
import { PerroHistorial, PerroHistorialDocument } from './perro-historial.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CrearPerroDto, ActualizarPerroDto, CrearPerroHistorialDto, TamanoPerro, TipoPelo } from 'shared';

type CrearPerroData = Omit<CrearPerroDto, 'fechaNacimiento' | 'fechaImplantacionMicrochip'> & {
  fechaNacimiento?: Date;
  fechaImplantacionMicrochip?: Date;
};

/** Vista de solo-salud del perro para la Historia Veterinaria Compartida (docs §5.5). */
export interface HistoriaCompartida {
  nombre: string;
  especie: string;
  raza?: string;
  fechaNacimiento?: Date;
  sexo?: string;
  esterilizado: boolean;
  peso?: number;
  vacunas: string[];
  alergias: string[];
  enfermedades: string[];
  medicacion: string[];
  dieta?: string;
  cartillaSanitariaUrl?: string;
  pasaporteEuropeoUrl?: string;
  certificadosUrl: string[];
  historial: Array<{
    vertical: string;
    nota: string;
    datosEstructurados: Record<string, unknown>;
    createdAt?: Date;
  }>;
}

@Injectable()
export class PerrosService {
  constructor(
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
    @InjectModel(PerroHistorial.name)
    private readonly historialModel: Model<PerroHistorialDocument>,
  ) {}

  async crear(propietarioId: string, dto: CrearPerroDto): Promise<PerroDocument> {
    const data: CrearPerroData = {
      ...dto,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      fechaImplantacionMicrochip: dto.fechaImplantacionMicrochip
        ? new Date(dto.fechaImplantacionMicrochip)
        : undefined,
    };

    return this.perroModel.create({ ...data, propietarioId });
  }

  listarPorPropietario(propietarioId: string): Promise<PerroDocument[]> {
    return this.perroModel
      .find({ propietarioId: new Types.ObjectId(propietarioId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async obtenerPropio(id: string, propietarioId: string): Promise<PerroDocument> {
    const perro = await this.perroModel.findById(id).exec();

    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }

    if (perro.propietarioId.toString() !== propietarioId) {
      throw new DomainException('No tienes permiso sobre esta ficha', 403);
    }

    return perro;
  }

  /**
   * Solo los campos de compatibilidad (sin datos sensibles de salud/comportamiento),
   * usados por el filtro de búsqueda del catálogo. No exige propiedad: sirve para
   * que cualquier búsqueda (autenticada o no) pueda filtrar por el perro elegido.
   */
  async obtenerPerfilCompatibilidad(
    id: string,
  ): Promise<{ tamano?: TamanoPerro; tipoPelo?: TipoPelo[]; temperamento?: string } | null> {
    const perro = await this.perroModel
      .findById(id)
      .select('tamano tipoPelo temperamento')
      .lean()
      .exec();

    if (!perro) return null;
    return { tamano: perro.tamano, tipoPelo: perro.tipoPelo, temperamento: perro.temperamento };
  }

  async actualizar(
    id: string,
    propietarioId: string,
    dto: ActualizarPerroDto,
  ): Promise<PerroDocument> {
    const perro = await this.obtenerPropio(id, propietarioId);

    Object.assign(perro, {
      ...dto,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : perro.fechaNacimiento,
      fechaImplantacionMicrochip: dto.fechaImplantacionMicrochip
        ? new Date(dto.fechaImplantacionMicrochip)
        : perro.fechaImplantacionMicrochip,
    });

    return perro.save();
  }

  async eliminar(id: string, propietarioId: string): Promise<void> {
    const perro = await this.obtenerPropio(id, propietarioId);
    await perro.deleteOne();
  }

  /**
   * Historia Veterinaria Compartida (docs/mejora_servicios.md §5.5): con autorización del
   * propietario, cualquier profesional de la plataforma puede consultar el historial de
   * salud del perro antes de una consulta, sin exigir propiedad de la ficha (a diferencia
   * de `obtenerPropio`). Si el propietario no autorizó compartir, se rechaza.
   */
  async obtenerHistoriaCompartida(perroId: string): Promise<HistoriaCompartida> {
    const perro = await this.perroModel
      .findById(perroId)
      .select('nombre especie raza fechaNacimiento sexo esterilizado peso vacunas alergias enfermedades medicacion dieta cartillaSanitariaUrl pasaporteEuropeoUrl certificadosUrl autorizaCompartirHistorial')
      .lean()
      .exec();

    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }
    if (!perro.autorizaCompartirHistorial) {
      throw new DomainException('El propietario no autorizó compartir el historial de este perro', 403);
    }

    const historial = await this.historialModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      nombre: perro.nombre,
      especie: perro.especie,
      raza: perro.raza,
      fechaNacimiento: perro.fechaNacimiento,
      sexo: perro.sexo,
      esterilizado: perro.esterilizado,
      peso: perro.peso,
      vacunas: perro.vacunas,
      alergias: perro.alergias,
      enfermedades: perro.enfermedades,
      medicacion: perro.medicacion,
      dieta: perro.dieta,
      cartillaSanitariaUrl: perro.cartillaSanitariaUrl,
      pasaporteEuropeoUrl: perro.pasaporteEuropeoUrl,
      certificadosUrl: perro.certificadosUrl,
      historial,
    };
  }

  async agregarHistorial(
    perroId: string,
    comercioId: string,
    dto: CrearPerroHistorialDto,
  ): Promise<PerroHistorialDocument> {
    const perro = await this.perroModel.findById(perroId).exec();

    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }

    return this.historialModel.create({ ...dto, perroId, comercioId });
  }

  async listarHistorial(perroId: string, propietarioId: string): Promise<PerroHistorialDocument[]> {
    await this.obtenerPropio(perroId, propietarioId);

    return this.historialModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
