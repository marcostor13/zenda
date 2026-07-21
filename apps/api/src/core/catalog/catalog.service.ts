import { Injectable } from '@nestjs/common';
import { CatalogRepository, BuscarServiciosParams } from './catalog.repository';
import { ReviewsService } from '../reviews/reviews.service';
import { ResenaDocument } from '../reviews/resena.schema';
import { PerrosService } from '../perros/perros.service';
import { AptitudPerro } from './servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CrearServicioDto, ActualizarServicioDto, ActualizarDisponibilidadDto } from 'shared';

/** Campos de disponibilidad editables por el comercio, según el vertical del servicio. */
const CAMPOS_DISPONIBILIDAD_POR_VERTICAL: Record<string, Array<keyof ActualizarDisponibilidadDto>> = {
  alojamiento: ['espacios'],
  transporte: ['unidadesDisponibles'],
  veterinaria: ['citasDisponibles'],
  peluqueria: ['cuposDisponibles'],
  adiestramiento: ['cuposDisponibles'],
  hoteles: ['unidadesDisponibles'],
};

/** Todos los campos propios de cada vertical (más allá de los del Servicio base), aceptados al crear/editar un listado. */
const CAMPOS_EXTRA_POR_VERTICAL: Record<string, string[]> = {
  alojamiento: [
    'espacios', 'amenities', 'checkIn', 'checkOut', 'politicaCancelacion',
    'requisitoVacunas', 'paseosIncluidos', 'camaras24h', 'cancelacionGratis',
    'barrio', 'direccion',
    'compatibilidadSocialAdmitida', 'requisitoMicrochip', 'requiereDesparasitacionInterna',
    'requiereDesparasitacionExterna', 'requiereVacunaTosPerreras', 'serviciosAdicionales',
  ],
  transporte: [
    'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm',
    'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
    'tiposTransporteOfrecidos', 'precioExclusivo', 'requisitoMicrochip', 'requisitoVacunas',
    'caracteristicasVehiculo', 'serviciosAdicionales',
  ],
  veterinaria: [
    'especialidades', 'serviciosClinicos', 'duracionCitaMin', 'citasPorDia',
    'citasDisponibles', 'atiendeUrgencias', 'horario', 'precioConsulta', 'especiesAtendidas',
  ],
  peluqueria: [
    'serviciosGrooming', 'duracionSlotMin', 'capacidadSimultanea',
    'cuposDisponibles', 'aDomicilio', 'horario',
    'politicaTemperamentoDificil', 'bozalObligatorioSiAgresivo', 'serviciosAdicionales',
    'razasEspecificas', 'requiereVacunasAlDia', 'requiereMicrochip',
  ],
  adiestramiento: [
    'tiposAdiestramiento', 'modalidad', 'precioSesion', 'precioPrograma',
    'sesionesPorPrograma', 'edadMinimaMeses', 'aDomicilio', 'capacidadPorSesion',
    'cuposDisponibles', 'horario', 'serviciosAdiestramiento', 'valoracionInicial',
  ],
  hoteles: [
    'admiteMascotas', 'maxMascotasPorReserva', 'pesoMaximoMascotaKg', 'razasRestringidas',
    'razasEspecificasRestringidas', 'especiesPermitidas', 'suplementoPorTamanoMascota',
    'suplementoSegundaMascotaPorNoche', 'serviciosPetfriendly', 'puedeQuedarseSoloEnHabitacion',
    'accesoZonasComunes', 'debeIrConCorrea', 'debeLlevarBozalSiCorresponde',
    'checkIn', 'checkOut', 'fianza', 'unidadesDisponibles',
  ],
};

/** Campos que deben venir informados para que el listado sea reservable desde el día uno. */
const CAMPOS_REQUERIDOS_POR_VERTICAL: Record<string, string[]> = {
  alojamiento: ['espacios'],
  transporte: ['tarifaBase', 'tarifaKm'],
  veterinaria: ['precioConsulta'],
  peluqueria: [],
  adiestramiento: ['precioSesion'],
  hoteles: [],
};

/** Vista de tarjeta de servicio (catálogo genérico) que consume el frontend. */
export interface ServicioCardDto {
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
  espaciosDisponibles: number;
  paseosIncluidos: boolean;
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

/** Reseña real (no fabricada) tal como la ve el usuario en el detalle del servicio. */
export interface ResenaResumenDto {
  id: string;
  autorNombre: string;
  puntuacion: number;
  comentario: string;
  fecha: string;
  respuesta?: string | null;
}

export interface ServicioDetalleDto extends ServicioCardDto {
  descripcion: string;
  politicaCancelacion: string;
  checkIn: string;
  checkOut: string;
  requisitoVacunas: boolean;
  camaras24h: boolean;
  espacios: unknown[];
  habitaciones: HabitacionDto[];
  resenas: ResenaResumenDto[];
  comercioId: string;
  /** Residencia canina (Fase C): perfiles de compatibilidad social admitidos; vacío = cualquiera. */
  compatibilidadSocialAdmitida: string[];
  requisitoMicrochip: boolean;
  requiereDesparasitacionInterna: boolean;
  requiereDesparasitacionExterna: boolean;
  requiereVacunaTosPerreras: boolean;
  serviciosAdicionales: Array<{ nombre: string; precio: number }>;
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
  extra: Record<string, unknown>;
  aptitud?: AptitudPerro;
}

/** Estructura mínima de un documento de servicio ya "leaneado". */
interface ServicioLean {
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
  espaciosDisponibles?: number;
  paseosIncluidos?: boolean;
  requisitoVacunas?: boolean;
  camaras24h?: boolean;
  espacios?: unknown[];
  habitaciones?: HabitacionDto[];
  politicaCancelacion?: string;
  checkIn?: string;
  checkOut?: string;
  aptitud?: AptitudPerro;
  compatibilidadSocialAdmitida?: string[];
  requisitoMicrochip?: boolean;
  requiereDesparasitacionInterna?: boolean;
  requiereDesparasitacionExterna?: boolean;
  requiereVacunaTosPerreras?: boolean;
  serviciosAdicionales?: Array<{ nombre: string; precio: number }>;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly reviewsService: ReviewsService,
    private readonly perrosService: PerrosService,
  ) {}

  async buscarServicios(filtros: {
    vertical?: string;
    ciudad?: string;
    precioMin?: number;
    precioMax?: number;
    page?: number;
    limit?: number;
    perroId?: string;
  }): Promise<PaginatedResult<ServicioCardDto>> {
    const perfilPerro = filtros.perroId
      ? (await this.perrosService.obtenerPerfilCompatibilidad(filtros.perroId)) ?? undefined
      : undefined;

    const params: BuscarServiciosParams = {
      vertical: filtros.vertical ?? 'alojamiento',
      ciudad: filtros.ciudad,
      precioMin: filtros.precioMin,
      precioMax: filtros.precioMax,
      page: Math.max(1, filtros.page ?? 1),
      limit: Math.min(MAX_LIMIT, Math.max(1, filtros.limit ?? DEFAULT_LIMIT)),
      perfilPerro,
    };

    const { items, total } = await this.repo.buscar(params);

    return {
      items: items.map((doc) => this.toCard(doc as unknown as ServicioLean)),
      total,
      page: params.page,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  async crearServicio(dto: CrearServicioDto, comercioId: string): Promise<ServicioCardDto> {
    // Sin comercio vinculado, `new ObjectId(undefined)` generaría un id aleatorio:
    // el listado se guardaría "huérfano" y nunca aparecería en "Mis listados".
    if (!comercioId) {
      throw new DomainException('Tu cuenta no está vinculada a ningún comercio; no puedes crear listados.', 403);
    }
    const extra = this.filtrarExtraPorVertical(dto.vertical, dto.extra ?? {});
    this.validarCamposRequeridos(dto.vertical, extra);

    const doc = await this.repo.crear({
      vertical: dto.vertical,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      precioBase: dto.precioBase,
      imagenes: dto.imagenes ?? [],
      comercioId,
      extra,
      aptitud: dto.aptitud,
    });
    return this.toCard(doc as unknown as ServicioLean);
  }

  async actualizarServicio(
    id: string,
    comercioId: string,
    dto: ActualizarServicioDto,
  ): Promise<ServicioCardDto> {
    const existente = await this.repo.obtenerPorIdYComercio(id, comercioId);
    if (!existente) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const vertical = (existente as unknown as Record<string, unknown>)['vertical'] as string;
    const extra = dto.extra ? this.filtrarExtraPorVertical(vertical, dto.extra) : undefined;

    const actualizado = await this.repo.actualizar(id, comercioId, {
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      precioBase: dto.precioBase,
      imagenes: dto.imagenes,
      extra,
      aptitud: dto.aptitud,
    });
    if (!actualizado) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    return this.toCard(actualizado as unknown as ServicioLean);
  }

  async obtenerServicioParaGestion(id: string, comercioId: string): Promise<ServicioGestionDto> {
    const doc = await this.repo.obtenerPorIdYComercio(id, comercioId);
    if (!doc) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const h = doc as unknown as ServicioLean & Record<string, unknown>;
    const vertical = h['vertical'] as string;
    const claves = CAMPOS_EXTRA_POR_VERTICAL[vertical] ?? [];
    const extra: Record<string, unknown> = {};
    for (const k of claves) {
      if (h[k] !== undefined) extra[k] = h[k];
    }

    return {
      id: String(h._id),
      vertical,
      titulo: h.titulo,
      descripcion: h.descripcion ?? '',
      ciudad: h.ubicacion?.ciudad ?? '',
      precioBase: h.precioBase,
      imagenes: h.imagenes ?? [],
      estado: (h['estado'] as string) ?? 'borrador',
      extra,
      aptitud: h.aptitud,
    };
  }

  /** Filtra los campos propios del vertical elegido; ignora cualquier otro campo enviado. */
  private filtrarExtraPorVertical(vertical: string, extra: Record<string, unknown>): Record<string, unknown> {
    const claves = CAMPOS_EXTRA_POR_VERTICAL[vertical] ?? [];
    const filtrado: Record<string, unknown> = {};
    for (const clave of claves) {
      if (extra[clave] !== undefined) filtrado[clave] = extra[clave];
    }
    return filtrado;
  }

  /** Evita crear listados que no se podrán reservar por falta de datos clave del vertical. */
  private validarCamposRequeridos(vertical: string, campos: Record<string, unknown>): void {
    const requeridos = CAMPOS_REQUERIDOS_POR_VERTICAL[vertical] ?? [];
    const faltantes = requeridos.filter((clave) => {
      const valor = campos[clave];
      if (valor === undefined || valor === null) return true;
      if (Array.isArray(valor)) return valor.length === 0;
      return false;
    });
    if (faltantes.length > 0) {
      throw new DomainException(
        `Faltan campos obligatorios para este tipo de servicio: ${faltantes.join(', ')}`,
        400,
      );
    }
  }

  /**
   * Permite al comercio editar la disponibilidad/cupos de un servicio ya
   * publicado, evitando la sobreventa (D1). Solo se aceptan los campos que
   * corresponden al vertical del servicio; el resto del payload se ignora.
   */
  async actualizarDisponibilidad(
    servicioId: string,
    comercioId: string,
    dto: ActualizarDisponibilidadDto,
  ): Promise<ServicioCardDto> {
    const servicio = await this.repo.obtenerPorId(servicioId);
    if (!servicio) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    if (String((servicio as unknown as ServicioLean).comercioId) !== comercioId) {
      throw new DomainException('No tienes permiso sobre este servicio', 403);
    }

    const vertical = (servicio as unknown as { vertical: string }).vertical;
    const clavesPermitidas = CAMPOS_DISPONIBILIDAD_POR_VERTICAL[vertical] ?? [];
    const campos: Record<string, unknown> = {};
    for (const clave of clavesPermitidas) {
      const valor = dto[clave];
      if (valor !== undefined) campos[clave] = valor;
    }

    if (Object.keys(campos).length === 0) {
      throw new DomainException(
        'No se proporcionó ningún campo de disponibilidad válido para este vertical',
        400,
      );
    }

    const actualizado = await this.repo.actualizarCampos(servicioId, campos);
    if (!actualizado) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    return this.toCard(actualizado as unknown as ServicioLean);
  }

  async obtenerServicio(id: string): Promise<ServicioDetalleDto> {
    const doc = await this.repo.obtenerPorId(id);
    if (!doc) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const resenas = await this.reviewsService.listarPorServicio(id);
    return this.toDetalle(doc as unknown as ServicioLean, resenas.map((r) => this.aResenaResumen(r)));
  }

  private aResenaResumen(r: ResenaDocument): ResenaResumenDto {
    const conFecha = r as unknown as { createdAt?: Date | string };
    const fecha = conFecha.createdAt instanceof Date ? conFecha.createdAt.toISOString() : (conFecha.createdAt ?? '');
    return {
      id: String(r._id),
      autorNombre: r.usuarioNombre,
      puntuacion: r.puntuacion,
      comentario: r.comentario,
      fecha,
      respuesta: r.respuesta,
    };
  }

  private toCard(h: ServicioLean): ServicioCardDto {
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
      espaciosDisponibles: h.espaciosDisponibles ?? 0,
      paseosIncluidos: h.paseosIncluidos ?? false,
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
      'compatibilidadSocialAdmitida', 'requisitoMicrochip', 'requiereDesparasitacionInterna',
      'requiereDesparasitacionExterna', 'requiereVacunaTosPerreras', 'serviciosAdicionales',
      // transporte de animales
      'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm', 'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
      // veterinaria
      'especialidades', 'serviciosClinicos', 'duracionCitaMin', 'citasPorDia', 'citasDisponibles', 'atiendeUrgencias', 'precioConsulta', 'especiesAtendidas',
      // peluquería canina
      'serviciosGrooming', 'duracionSlotMin', 'capacidadSimultanea', 'aDomicilio',
      'politicaTemperamentoDificil', 'bozalObligatorioSiAgresivo', 'serviciosAdicionales',
      'razasEspecificas', 'requiereVacunasAlDia', 'requiereMicrochip',
      // adiestramiento canino
      'tiposAdiestramiento', 'modalidad', 'precioSesion', 'precioPrograma', 'sesionesPorPrograma', 'edadMinimaMeses', 'capacidadPorSesion',
      'serviciosAdiestramiento', 'valoracionInicial',
      // hotel pet-friendly
      'admiteMascotas', 'maxMascotasPorReserva', 'pesoMaximoMascotaKg', 'razasRestringidas',
      'razasEspecificasRestringidas', 'especiesPermitidas', 'suplementoPorTamanoMascota',
      'suplementoSegundaMascotaPorNoche', 'serviciosPetfriendly', 'puedeQuedarseSoloEnHabitacion',
      'accesoZonasComunes', 'debeIrConCorrea', 'debeLlevarBozalSiCorresponde', 'fianza', 'unidadesDisponibles',
      // comunes a citas/cupos
      'cuposDisponibles', 'horario',
    ];
    const extra: Record<string, unknown> = {};
    for (const k of claves) {
      if (h[k] !== undefined) extra[k] = h[k];
    }
    return extra;
  }

  private toDetalle(h: ServicioLean, resenas: ResenaResumenDto[]): ServicioDetalleDto {
    return {
      ...this.toCard(h),
      descripcion: h.descripcion ?? '',
      politicaCancelacion: h.politicaCancelacion ?? 'Consulta las condiciones de cancelación.',
      checkIn: h.checkIn ?? '12:00',
      checkOut: h.checkOut ?? '11:00',
      requisitoVacunas: h.requisitoVacunas ?? true,
      camaras24h: h.camaras24h ?? false,
      espacios: h.espacios ?? [],
      habitaciones: this.espaciosComoHabitaciones(h).map((hab, i) => this.toHabitacion(hab, i)),
      resenas,
      comercioId: h.comercioId ? String(h.comercioId) : '',
      compatibilidadSocialAdmitida: h.compatibilidadSocialAdmitida ?? [],
      requisitoMicrochip: h.requisitoMicrochip ?? false,
      requiereDesparasitacionInterna: h.requiereDesparasitacionInterna ?? false,
      requiereDesparasitacionExterna: h.requiereDesparasitacionExterna ?? false,
      requiereVacunaTosPerreras: h.requiereVacunaTosPerreras ?? false,
      serviciosAdicionales: h.serviciosAdicionales ?? [],
    };
  }

  /**
   * Los alojamientos caninos guardan sus unidades reservables en `espacios`
   * (con `precioNoche`); se proyectan sobre el shape legacy `habitaciones`
   * para no romper a los consumidores existentes del detalle.
   */
  private espaciosComoHabitaciones(h: ServicioLean): HabitacionDto[] {
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
