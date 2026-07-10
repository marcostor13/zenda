import { Injectable } from '@nestjs/common';
import { CatalogRepository, BuscarServiciosParams } from './catalog.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CrearServicioDto, ActualizarServicioDto, VerticalKey } from 'shared';

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

/** Vista completa (no normalizada) de un servicio propio, para precargar el formulario de edición. */
export interface ServicioGestionDto {
  id: string;
  vertical: string;
  titulo: string;
  descripcion: string;
  ciudad: string;
  precioBase: number;
  imagenes: string[];
  estado: string;
  [detalleKey: string]: unknown;
}

/** Campos propios de cada vertical que el comercio puede editar desde el formulario de listado
 *  (excluye contadores de disponibilidad en vivo, que gestiona el motor de reservas). */
const CAMPOS_VERTICAL: Record<string, string[]> = {
  [VerticalKey.ALOJAMIENTO]: [
    'espacios', 'amenities', 'checkIn', 'checkOut', 'politicaCancelacion',
    'requisitoVacunas', 'paseosIncluidos', 'camaras24h', 'cancelacionGratis', 'barrio', 'direccion',
  ],
  [VerticalKey.TRANSPORTE]: [
    'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm',
    'jaulasIncluidas', 'acompananteHumano', 'soloPerros',
  ],
  [VerticalKey.VETERINARIA]: [
    'especialidades', 'serviciosClinicos', 'duracionCitaMin', 'citasPorDia',
    'atiendeUrgencias', 'horario', 'precioConsulta',
  ],
  [VerticalKey.PELUQUERIA]: [
    'serviciosGrooming', 'duracionSlotMin', 'capacidadSimultanea', 'aDomicilio', 'horario',
  ],
  [VerticalKey.ADIESTRAMIENTO]: [
    'tiposAdiestramiento', 'modalidad', 'precioSesion', 'precioPrograma',
    'sesionesPorPrograma', 'edadMinimaMeses', 'aDomicilio', 'capacidadPorSesion', 'horario',
  ],
};

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
      vertical: filtros.vertical ?? 'alojamiento',
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

  async crearServicio(dto: CrearServicioDto, comercioId: string): Promise<HotelCardDto> {
    const doc = await this.repo.crear({
      vertical: dto.vertical,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      precioBase: dto.precioBase,
      imagenes: dto.imagenes ?? [],
      comercioId,
      detalle: this.detalleDelDto(dto.vertical, dto as unknown as Record<string, unknown>),
    });
    return this.toCard(doc as unknown as HotelLean);
  }

  async actualizarServicio(
    id: string,
    comercioId: string,
    dto: ActualizarServicioDto,
  ): Promise<HotelCardDto> {
    const existente = await this.repo.obtenerPorIdYComercio(id, comercioId);
    if (!existente) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const vertical = (existente as unknown as Record<string, unknown>)['vertical'] as string;

    const actualizado = await this.repo.actualizar(id, comercioId, {
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      precioBase: dto.precioBase,
      imagenes: dto.imagenes,
      detalle: this.detalleDelDto(vertical, dto as unknown as Record<string, unknown>),
    });
    if (!actualizado) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    return this.toCard(actualizado as unknown as HotelLean);
  }

  async obtenerServicioParaGestion(id: string, comercioId: string): Promise<ServicioGestionDto> {
    const doc = await this.repo.obtenerPorIdYComercio(id, comercioId);
    if (!doc) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const h = doc as unknown as HotelLean & Record<string, unknown>;
    const vertical = h['vertical'] as string;

    return {
      id: String(h._id),
      vertical,
      titulo: h.titulo,
      descripcion: h.descripcion ?? '',
      ciudad: h.ubicacion?.ciudad ?? '',
      precioBase: h.precioBase,
      imagenes: h.imagenes ?? [],
      estado: (h['estado'] as string) ?? 'borrador',
      [vertical]: this.camposVertical(vertical, h),
    };
  }

  /** Extrae del dto el sub-objeto de campos propios del vertical (misma clave que `vertical`). */
  private detalleDelDto(vertical: string, dto: Record<string, unknown>): Record<string, unknown> {
    return (dto[vertical] as Record<string, unknown>) ?? {};
  }

  /** Extrae del documento crudo únicamente los campos editables del vertical dado. */
  private camposVertical(vertical: string, doc: Record<string, unknown>): Record<string, unknown> {
    const claves = CAMPOS_VERTICAL[vertical] ?? [];
    const detalle: Record<string, unknown> = {};
    for (const k of claves) {
      if (doc[k] !== undefined) detalle[k] = doc[k];
    }
    return detalle;
  }

  async obtenerHotel(id: string): Promise<HotelDetalleDto> {
    const doc = await this.repo.obtenerPorId(id);
    if (!doc) {
      throw new DomainException('Servicio no encontrado', 404);
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

  /** Extrae los campos propios de cada vertical canina (los que no son del Servicio base). */
  private pickExtra(h: Record<string, unknown>): Record<string, unknown> {
    const claves = [
      // alojamiento canino
      'espacios', 'espaciosDisponibles', 'checkIn', 'checkOut', 'requisitoVacunas', 'paseosIncluidos', 'camaras24h',
      // transporte de animales
      'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm', 'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
      // veterinaria
      'especialidades', 'serviciosClinicos', 'duracionCitaMin', 'citasPorDia', 'citasDisponibles', 'atiendeUrgencias', 'precioConsulta',
      // peluquería canina
      'serviciosGrooming', 'duracionSlotMin', 'capacidadSimultanea', 'aDomicilio',
      // adiestramiento canino
      'tiposAdiestramiento', 'modalidad', 'precioSesion', 'precioPrograma', 'sesionesPorPrograma', 'edadMinimaMeses', 'capacidadPorSesion',
      // comunes a citas/cupos
      'cuposDisponibles', 'horario',
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
      checkIn: h.checkIn ?? '12:00',
      checkOut: h.checkOut ?? '11:00',
      habitaciones: this.espaciosComoHabitaciones(h).map((hab, i) => this.toHabitacion(hab, i)),
      resenas: [],
      comercioId: h.comercioId ? String(h.comercioId) : '',
    };
  }

  /**
   * Los alojamientos caninos guardan sus unidades reservables en `espacios`
   * (con `precioNoche`); se proyectan sobre el shape legacy `habitaciones`
   * para no romper a los consumidores existentes del detalle.
   */
  private espaciosComoHabitaciones(h: HotelLean): HabitacionDto[] {
    if (h.habitaciones?.length) return h.habitaciones;
    const espacios = (h as unknown as Record<string, unknown>)['espacios'] as
      | Array<Record<string, unknown>>
      | undefined;
    return (espacios ?? []).map((e) => ({
      id: (e['id'] as string) ?? '',
      tipo: (e['tipo'] as string) ?? 'estandar',
      descripcion: (e['descripcion'] as string) ?? '',
      capacidad: (e['cantidad'] as number) ?? 1,
      camas: (e['tamanoMaxPerro'] as string) ?? '',
      tamano: 0,
      precio: (e['precioNoche'] as number) ?? 0,
      precioAnterior: e['precioAnterior'] as number | undefined,
      amenities: (e['amenities'] as string[]) ?? [],
      imagenes: (e['imagenes'] as string[]) ?? [],
      disponible: (e['disponible'] as boolean) ?? true,
      cancelacionGratis: (e['cancelacionGratis'] as boolean) ?? true,
    }));
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
