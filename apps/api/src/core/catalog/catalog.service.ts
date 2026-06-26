import { Injectable } from '@nestjs/common';
import { CatalogRepository, BuscarServiciosParams } from './catalog.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Vista de tarjeta de hotel que consume el frontend. */
export interface HotelCardDto {
  id: string;
  nombre: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  estrellas: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  precioPorNoche: number;
  precioAnterior?: number;
  descuentoPct?: number;
  imagenes: string[];
  amenities: string[];
  cancelacionGratis: boolean;
  desayunoIncluido: boolean;
  habitacionesDisponibles: number;
  destacado: boolean;
  /** Clave del vertical del servicio. */
  vertical?: string;
  /** Campos propios del vertical (taxi, vuelo, etc.) para cualquier UI. */
  extra?: Record<string, unknown>;
}

export interface HabitacionDto {
  id: string;
  tipo: string;
  descripcion: string;
  capacidad: number;
  camas: string;
  tamano: number;
  precio: number;
  precioAnterior?: number;
  amenities: string[];
  imagenes: string[];
  disponible: boolean;
  cancelacionGratis: boolean;
}

export interface HotelDetalleDto extends HotelCardDto {
  descripcion: string;
  politicaCancelacion: string;
  checkIn: string;
  checkOut: string;
  habitaciones: HabitacionDto[];
  resenas: unknown[];
  comercioId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

/** Estructura mínima de un documento de hotel ya "leaneado". */
interface HotelLean {
  _id: unknown;
  comercioId?: unknown;
  titulo: string;
  descripcion?: string;
  imagenes?: string[];
  ubicacion?: { ciudad?: string };
  precioBase: number;
  precioAnterior?: number;
  descuentoPct?: number;
  destacado?: boolean;
  ratingPromedio?: number;
  totalReseñas?: number;
  amenities?: string[];
  estrellas?: number;
  barrio?: string;
  direccion?: string;
  desayunoIncluido?: boolean;
  cancelacionGratis?: boolean;
  habitacionesDisponibles?: number;
  habitaciones?: HabitacionDto[];
  politicaCancelacion?: string;
  checkIn?: string;
  checkOut?: string;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

@Injectable()
export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  async buscarHoteles(filtros: {
    vertical?: string;
    ciudad?: string;
    precioMin?: number;
    precioMax?: number;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<HotelCardDto>> {
    const params: BuscarServiciosParams = {
      vertical: filtros.vertical ?? 'hoteles',
      ciudad: filtros.ciudad,
      precioMin: filtros.precioMin,
      precioMax: filtros.precioMax,
      page: Math.max(1, filtros.page ?? 1),
      limit: Math.min(MAX_LIMIT, Math.max(1, filtros.limit ?? DEFAULT_LIMIT)),
    };

    const { items, total } = await this.repo.buscar(params);

    return {
      items: items.map((doc) => this.toCard(doc as unknown as HotelLean)),
      total,
      page: params.page,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  async obtenerHotel(id: string): Promise<HotelDetalleDto> {
    const doc = await this.repo.obtenerPorId(id);
    if (!doc) {
      throw new DomainException('Hotel no encontrado', 404);
    }
    return this.toDetalle(doc as unknown as HotelLean);
  }

  private toCard(h: HotelLean): HotelCardDto {
    const score = Math.round((h.ratingPromedio ?? 0) * 10) / 10;
    return {
      id: String(h._id),
      nombre: h.titulo,
      ciudad: h.ubicacion?.ciudad ?? '',
      barrio: h.barrio ?? '',
      direccion: h.direccion ?? '',
      estrellas: h.estrellas ?? 3,
      score,
      scoreLabel: this.scoreLabel(score),
      numResenas: h.totalReseñas ?? 0,
      precioPorNoche: h.precioBase,
      precioAnterior: h.precioAnterior,
      descuentoPct: h.descuentoPct,
      imagenes: h.imagenes ?? [],
      amenities: h.amenities ?? [],
      cancelacionGratis: h.cancelacionGratis ?? true,
      desayunoIncluido: h.desayunoIncluido ?? false,
      habitacionesDisponibles: h.habitacionesDisponibles ?? 0,
      destacado: h.destacado ?? false,
      vertical: (h as unknown as Record<string, unknown>)['vertical'] as string | undefined,
      extra: this.pickExtra(h as unknown as Record<string, unknown>),
    };
  }

  /** Extrae los campos propios de cada vertical (los que no son del Servicio base). */
  private pickExtra(h: Record<string, unknown>): Record<string, unknown> {
    const claves = [
      // taxis
      'tipoVehiculo', 'capacidad', 'zonaCobertura', 'tarifaBase', 'tarifaKm', 'unidadesDisponibles',
      // vuelos
      'origen', 'destino', 'aerolinea', 'fechaSalida', 'fechaLlegada', 'asientosDisponibles', 'precioAsiento',
      // transporte
      'tipoCarga', 'capacidadKg', 'capacidadM3', 'rutasCubiertas',
      // guardería
      'rangoEdadMin', 'rangoEdadMax', 'cuposDisponibles', 'modalidad', 'precioHora', 'precioDia', 'precioMes', 'horario',
    ];
    const extra: Record<string, unknown> = {};
    for (const k of claves) {
      if (h[k] !== undefined) extra[k] = h[k];
    }
    return extra;
  }

  private toDetalle(h: HotelLean): HotelDetalleDto {
    return {
      ...this.toCard(h),
      descripcion: h.descripcion ?? '',
      politicaCancelacion: h.politicaCancelacion ?? 'Consulta las condiciones de cancelación.',
      checkIn: h.checkIn ?? '15:00',
      checkOut: h.checkOut ?? '12:00',
      habitaciones: (h.habitaciones ?? []).map((hab, i) => this.toHabitacion(hab, i)),
      resenas: [],
      comercioId: h.comercioId ? String(h.comercioId) : '',
    };
  }

  private toHabitacion(hab: HabitacionDto, index: number): HabitacionDto {
    return {
      id: hab.id ?? `hab-${index}`,
      tipo: hab.tipo,
      descripcion: hab.descripcion ?? '',
      capacidad: hab.capacidad,
      camas: hab.camas ?? '',
      tamano: hab.tamano ?? 0,
      precio: hab.precio,
      precioAnterior: hab.precioAnterior,
      amenities: hab.amenities ?? [],
      imagenes: hab.imagenes ?? [],
      disponible: hab.disponible ?? true,
      cancelacionGratis: hab.cancelacionGratis ?? true,
    };
  }

  private scoreLabel(score: number): string {
    if (score >= 9) return 'Excepcional';
    if (score >= 8) return 'Muy bueno';
    if (score >= 7) return 'Bueno';
    if (score >= 6) return 'Aceptable';
    return 'Correcto';
  }
}
