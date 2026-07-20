import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FavoritoResumenDto, VerticalKey } from 'shared';
import { FavoritosRepository } from './favoritos.repository';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';

interface ServicioLean {
  _id: Types.ObjectId;
  titulo: string;
  imagenes: string[];
  ubicacion?: { ciudad?: string };
  vertical: VerticalKey;
  precioBase: number;
  moneda: string;
  ratingPromedio: number;
  totalReseñas: number;
}

@Injectable()
export class FavoritosService {
  constructor(
    private readonly favoritosRepo: FavoritosRepository,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async agregar(usuarioId: string, servicioId: string): Promise<{ servicioId: string; favorito: boolean }> {
    await this.favoritosRepo.agregar(usuarioId, servicioId);
    return { servicioId, favorito: true };
  }

  async eliminar(usuarioId: string, servicioId: string): Promise<{ servicioId: string; favorito: boolean }> {
    await this.favoritosRepo.eliminar(usuarioId, servicioId);
    return { servicioId, favorito: false };
  }

  listarIds(usuarioId: string): Promise<string[]> {
    return this.favoritosRepo.listarServicioIds(usuarioId);
  }

  contar(usuarioId: string): Promise<number> {
    return this.favoritosRepo.contar(usuarioId);
  }

  /** Lista de favoritos enriquecida con los datos del servicio, en orden de guardado. */
  async listar(usuarioId: string): Promise<FavoritoResumenDto[]> {
    const ids = await this.favoritosRepo.listarServicioIds(usuarioId);
    if (ids.length === 0) return [];

    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const servicios = (await this.servicioModel
      .find({ _id: { $in: objectIds } })
      .select('titulo imagenes ubicacion vertical precioBase moneda ratingPromedio totalReseñas')
      .lean()
      .exec()) as unknown as ServicioLean[];

    const porId = new Map(servicios.map((s) => [String(s._id), s]));

    // Respetar el orden de `ids` (más reciente primero) y descartar servicios borrados.
    return ids
      .map((id) => porId.get(id))
      .filter((s): s is ServicioLean => Boolean(s))
      .map((s) => ({
        servicioId: String(s._id),
        titulo: s.titulo,
        imagen: s.imagenes?.[0] ?? null,
        ciudad: s.ubicacion?.ciudad ?? '',
        vertical: s.vertical,
        precioBase: s.precioBase,
        moneda: s.moneda ?? 'EUR',
        ratingPromedio: s.ratingPromedio ?? 0,
        totalResenas: s.totalReseñas ?? 0,
        createdAt: new Date().toISOString(),
      }));
  }
}
