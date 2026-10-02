import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { EstadoModeracion } from 'shared';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Lugar, LugarDocument } from '../lugares/lugar.schema';

/** Cuántas fichas hay de una clase y en qué poblaciones se concentran. */
export interface GrupoInventario {
  clave: string;
  total: number;
  /** Poblaciones (o provincias, en Explora) con más fichas, de más a menos. */
  zonas: string[];
}

const ZONAS_POR_GRUPO = 8;

/**
 * Lo que hay publicado en la plataforma, contado por categoría.
 *
 * Existe para que el asistente sepa qué ofrece Doogking **de verdad**: sin
 * esto respondía sólo con un texto fijo que no mencionaba Explora y negaba que
 * hubiera playas o parques caninos aunque estuvieran publicados.
 *
 * Aplica los mismos filtros que lo público: servicios publicados de comercios
 * activos (la copia `comercioActivo`, que es por la que filtra el buscador) y
 * sitios con la moderación aprobada.
 */
@Injectable()
export class InventarioRepository {
  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Lugar.name) private readonly lugarModel: Model<LugarDocument>,
  ) {}

  async servicios(): Promise<GrupoInventario[]> {
    const filas = await this.servicioModel.aggregate<FilaInventario>(agrupacion({
      filtro: { estado: 'publicado', comercioActivo: true },
      clave: '$vertical',
      zona: '$ubicacion.ciudad',
    })).exec();
    return componer(filas);
  }

  /** En Explora se agrupa por provincia: los municipios son cientos. */
  async lugares(): Promise<GrupoInventario[]> {
    const filas = await this.lugarModel.aggregate<FilaInventario>(agrupacion({
      filtro: { estado: EstadoModeracion.PUBLICADO },
      clave: '$tipo',
      zona: { $ifNull: ['$ubicacion.provincia', '$ubicacion.ciudad'] },
    })).exec();
    return componer(filas);
  }
}

interface FilaInventario {
  _id: { clave: string; zona: string };
  n: number;
}

function agrupacion(opciones: { filtro: Record<string, unknown>; clave: string; zona: unknown }): PipelineStage[] {
  return [
    { $match: opciones.filtro },
    { $group: { _id: { clave: opciones.clave, zona: opciones.zona }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ];
}

/** Junta las filas población a población en un grupo por clave. */
function componer(filas: FilaInventario[]): GrupoInventario[] {
  const grupos = new Map<string, GrupoInventario>();
  for (const { _id, n } of filas) {
    if (!_id?.clave) continue;
    const grupo = grupos.get(_id.clave) ?? { clave: _id.clave, total: 0, zonas: [] };
    grupo.total += n;
    if (_id.zona && grupo.zonas.length < ZONAS_POR_GRUPO) grupo.zonas.push(_id.zona);
    grupos.set(_id.clave, grupo);
  }
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}
