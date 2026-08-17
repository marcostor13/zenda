import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CatalogRepository, BboxParams, BuscarServiciosParams, FacetasResult, OrdenServicios, PuntoServicio,
} from './catalog.repository';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { ReviewsService } from '../reviews/reviews.service';
import { ResenaDocument } from '../reviews/resena.schema';
import { PerrosService } from '../perros/perros.service';
import { AptitudPerro } from './servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { campoContador, plazasDeclaradas, sinPlazas } from './disponibilidad';
import {
  CrearServicioDto, ActualizarServicioDto, ActualizarDisponibilidadDto,
  ServicioClinicoTipo, SERVICIOS_CLINICOS_EXCLUIDOS,
} from 'shared';

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
    'compatibilidadSocialAdmitida', 'conductasNoAdmitidas', 'requisitoMicrochip', 'requiereDesparasitacionInterna',
    'requiereDesparasitacionExterna', 'requiereVacunaTosPerreras', 'serviciosAdicionales',
  ],
  transporte: [
    'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm',
    'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
    'tiposTransporteOfrecidos', 'precioExclusivo', 'requisitoMicrochip', 'requisitoVacunas',
    'caracteristicasVehiculo', 'serviciosAdicionales',
    'radioCoberturaKm', 'distanciaMinimaKm', 'aceptaPPP', 'requiereTransportinPropio',
    'maxPerrosPorTrayecto', 'antelacionMinimaHoras',
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
  seguros: [
    'tiposSeguro', 'limitesCobertura', 'condicionesAdmision', 'primaAnualBase',
    'descuentoPagoAnualPct', 'duracionMeses', 'renovacionAutomatica', 'cupoPolizas',
    'documentoCondicionesUrl',
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
  seguros: ['primaAnualBase', 'tiposSeguro'],
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
  /** El comercio ofrece ventajas del programa Doogking Alpha (HU-13.3). */
  alphaAdherido?: boolean;
  /** Campos propios del vertical (taxi, vuelo, etc.) para cualquier UI. */
  extra?: Record<string, unknown>;
  /** Coordenadas del listado; ausentes mientras el comercio no las declare. */
  lat?: number;
  lng?: number;
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
  /** Puntuación por criterio (limpieza, trato…) según el vertical. Vacío si no se valoró. */
  aspectos?: Record<string, number>;
  fotos?: string[];
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
  /** Coordenadas ya guardadas del listado; ausentes si nunca se geolocalizó. */
  lat?: number;
  lng?: number;
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
  ubicacion?: { ciudad?: string; geo?: { coordinates?: number[] } };
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


/** Órdenes aceptados en la búsqueda; cualquier otro valor cae en `relevancia`. */
const ORDENES_VALIDOS: readonly OrdenServicios[] = [
  'relevancia', 'precio_asc', 'precio_desc', 'valoracion', 'distancia',
];

@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly reviewsService: ReviewsService,
    private readonly perrosService: PerrosService,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
  ) {}

  async buscarServicios(filtros: {
    vertical?: string;
    ciudad?: string;
    precioMin?: number;
    precioMax?: number;
    page?: number;
    limit?: number;
    perroId?: string;
    orden?: string;
    lat?: number;
    lng?: number;
    soloDisponibles?: boolean;
    bbox?: BboxParams;
    ratingMin?: number;
    amenities?: string[];
    filtrosVertical?: Record<string, unknown>;
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
      orden: ORDENES_VALIDOS.includes(filtros.orden as OrdenServicios)
        ? (filtros.orden as OrdenServicios)
        : 'relevancia',
      lat: filtros.lat,
      lng: filtros.lng,
      // Por defecto la búsqueda solo muestra lo reservable (P2); un consumidor
      // puede pedir el catálogo completo pasando `soloDisponibles=false`.
      soloDisponibles: filtros.soloDisponibles ?? true,
      bbox: filtros.bbox,
      ratingMin: filtros.ratingMin,
      amenities: filtros.amenities,
      filtrosVertical: filtros.filtrosVertical,
    };

    const { items, total } = await this.repo.buscar(params);
    const adheridos = await this.comerciosAdheridosAlpha(items as unknown as ServicioLean[]);

    return {
      items: items.map((doc) => {
        const lean = doc as unknown as ServicioLean;
        const card = this.toCard(lean);
        card.alphaAdherido = adheridos.has(String(lean.comercioId));
        return card;
      }),
      total,
      page: params.page,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  /**
   * Facetas de la búsqueda (PDF 27/07 §3): histograma de precios y contadores
   * por filtro para el panel lateral tipo Booking. Misma base de búsqueda que
   * `buscarServicios`, sin paginación (los contadores describen el total).
   */
  obtenerFacetas(filtros: { vertical?: string; ciudad?: string; bbox?: BboxParams }): Promise<FacetasResult> {
    return this.repo.facetas({
      vertical: filtros.vertical ?? 'alojamiento',
      ciudad: filtros.ciudad,
      page: 1,
      limit: 1,
      soloDisponibles: true,
      bbox: filtros.bbox,
    });
  }

  /**
   * Pines de la zona visible del mapa (búsqueda por mapa, estilo Booking).
   * Comparte filtros con `buscarServicios` para que el mapa y la lista nunca
   * cuenten cosas distintas, pero se pide aparte porque no se pagina.
   */
  async obtenerPuntosMapa(filtros: {
    vertical?: string;
    ciudad?: string;
    precioMin?: number;
    precioMax?: number;
    perroId?: string;
    soloDisponibles?: boolean;
    bbox?: BboxParams;
    ratingMin?: number;
    amenities?: string[];
    filtrosVertical?: Record<string, unknown>;
  }): Promise<PuntoServicio[]> {
    const perfilPerro = filtros.perroId
      ? (await this.perrosService.obtenerPerfilCompatibilidad(filtros.perroId)) ?? undefined
      : undefined;

    return this.repo.puntos({
      vertical: filtros.vertical ?? 'alojamiento',
      ciudad: filtros.ciudad,
      precioMin: filtros.precioMin,
      precioMax: filtros.precioMax,
      perfilPerro,
      page: 1,
      limit: 1,
      soloDisponibles: filtros.soloDisponibles ?? true,
      bbox: filtros.bbox,
      ratingMin: filtros.ratingMin,
      amenities: filtros.amenities,
      filtrosVertical: filtros.filtrosVertical,
    });
  }

  /**
   * Comercios de la página actual adheridos al programa Alpha (HU-13.3).
   *
   * Es una sola consulta con `$in` sobre los comercios ya listados, no una por
   * tarjeta: el flag vive en `comercios` y no se denormaliza en `servicios`
   * para que darse de alta o de baja del programa no obligue a reescribir
   * todos los listados del comercio.
   */
  private async comerciosAdheridosAlpha(items: ServicioLean[]): Promise<Set<string>> {
    const ids = [...new Set(items.map((s) => String(s.comercioId)).filter(Boolean))];
    if (ids.length === 0) return new Set();

    const adheridos = await this.comercioModel
      .find({ _id: { $in: ids }, alphaAdherido: true })
      .select('_id')
      .lean()
      .exec();

    return new Set(adheridos.map((c) => String(c._id)));
  }

  async crearServicio(dto: CrearServicioDto, comercioId: string): Promise<ServicioCardDto> {
    // Sin comercio vinculado, `new ObjectId(undefined)` generaría un id aleatorio:
    // el listado se guardaría "huérfano" y nunca aparecería en "Mis listados".
    if (!comercioId) {
      throw new DomainException('Tu cuenta no está vinculada a ningún comercio; no puedes crear listados.', 403);
    }
    const filtrado = this.filtrarExtraPorVertical(dto.vertical, dto.extra ?? {});
    this.validarCamposRequeridos(dto.vertical, filtrado);
    this.validarServiciosClinicos(dto.vertical, filtrado);
    // Un listado recién creado no tiene reservas, así que sus plazas libres son
    // toda su capacidad.
    const extra = this.conDisponibilidad(dto.vertical, filtrado);

    const doc = await this.repo.crear({
      vertical: dto.vertical,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      lat: dto.lat,
      lng: dto.lng,
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
    const filtrado = dto.extra ? this.filtrarExtraPorVertical(vertical, dto.extra) : undefined;
    if (filtrado) this.validarServiciosClinicos(vertical, filtrado);

    // Al editar solo se recalcula si el contador está a cero o no existe: así se
    // rescatan los listados que quedaron invisibles, pero no se pisa un contador
    // vivo que las reservas ya han ido descontando.
    const contadorActual = (existente as unknown as Record<string, unknown>)[campoContador(vertical) ?? ''];
    const extra = filtrado && sinPlazas(contadorActual)
      ? this.conDisponibilidad(vertical, filtrado)
      : filtrado;

    const actualizado = await this.repo.actualizar(id, comercioId, {
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      lat: dto.lat,
      lng: dto.lng,
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
      // GeoJSON guarda [lng, lat]; el formulario del comercio necesita saber si
      // el listado ya está geolocalizado para no avisar de algo que ya cumple.
      lat: this.coordenada(h, 1),
      lng: this.coordenada(h, 0),
      precioBase: h.precioBase,
      imagenes: h.imagenes ?? [],
      estado: (h['estado'] as string) ?? 'borrador',
      extra,
      aptitud: h.aptitud,
    };
  }

  private coordenada(h: ServicioLean, indice: 0 | 1): number | undefined {
    const valor = h.ubicacion?.geo?.coordinates?.[indice];
    return Number.isFinite(valor) ? valor : undefined;
  }

  /**
   * Rellena el contador de plazas libres a partir de la capacidad declarada.
   * Si el comercio ya envió un contador propio se respeta: manda lo que él diga.
   */
  private conDisponibilidad(vertical: string, extra: Record<string, unknown>): Record<string, unknown> {
    const contador = campoContador(vertical);
    if (!contador || extra[contador] !== undefined) return extra;

    const plazas = plazasDeclaradas(vertical, extra);
    return plazas === undefined ? extra : { ...extra, [contador]: plazas };
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
   * El catálogo clínico es cerrado: Doogking solo intermedia servicios de
   * precio acotado. Se valida aquí, y no solo en el formulario, para que la
   * regla se sostenga también contra llamadas directas al API.
   */
  private validarServiciosClinicos(vertical: string, extra: Record<string, unknown>): void {
    if (vertical !== 'veterinaria') return;

    const servicios = extra['serviciosClinicos'] as Array<Record<string, unknown>> | undefined;
    if (!servicios?.length) return;

    const permitidos = Object.values(ServicioClinicoTipo) as string[];

    for (const servicio of servicios) {
      const tipo = servicio['tipo'] as string | undefined;

      // Sin `tipo` es un listado antiguo todavía sin migrar: se deja pasar para
      // no bloquear al comercio, pero no se puede crear nada nuevo así.
      if (tipo === undefined) continue;

      if (permitidos.includes(tipo)) continue;

      const excluido = SERVICIOS_CLINICOS_EXCLUIDOS.some((e) => tipo.toLowerCase().includes(e));
      throw new DomainException(
        excluido
          ? 'Doogking no intermedia reservas de dermatología ni cirugía: esos tratamientos se presupuestan y facturan directamente con el cliente.'
          : `"${tipo}" no está en el catálogo de servicios veterinarios reservables.`,
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
      aspectos: r.aspectos ?? {},
      fotos: r.fotos ?? [],
    };
  }

  private toCard(h: ServicioLean): ServicioCardDto {
    const score = Math.round((h.ratingPromedio ?? 0) * 10) / 10;
    // GeoJSON guarda [lng, lat]; invertirlo aquí evita que cada consumidor
    // tenga que acordarse del orden y lo pinte en mitad del océano.
    const [lng, lat] = h.ubicacion?.geo?.coordinates ?? [];
    return {
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
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
      'compatibilidadSocialAdmitida', 'conductasNoAdmitidas', 'requisitoMicrochip', 'requiereDesparasitacionInterna',
      'requiereDesparasitacionExterna', 'requiereVacunaTosPerreras', 'serviciosAdicionales',
      // transporte de animales
      'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm', 'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
      'radioCoberturaKm', 'distanciaMinimaKm', 'aceptaPPP', 'requiereTransportinPropio',
      'maxPerrosPorTrayecto', 'antelacionMinimaHoras',
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
      // seguros
      'tiposSeguro', 'limitesCobertura', 'condicionesAdmision', 'primaAnualBase',
      'descuentoPagoAnualPct', 'duracionMeses', 'renovacionAutomatica', 'documentoCondicionesUrl',
      'modalidades', 'precioVisita', 'precioDiaCompleto', 'precioNoche', 'duracionVisitaMin',
      'tareasIncluidas', 'tamanosAdmitidos', 'aceptaPPP', 'administraMedicacion',
      'radioDesplazamientoKm',
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
      espacios: this.normalizarEspacios(h),
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
   * Normaliza los espacios reservables para el frontend: cada subdocumento
   * expone `id` (desde su `_id`), y `disponible`/arrays con valores por defecto,
   * para que la selección de espacio y la reserva funcionen aunque el comercio
   * no rellenara todos los campos.
   */
  private normalizarEspacios(h: ServicioLean): Record<string, unknown>[] {
    const espacios = (h as unknown as Record<string, unknown>)['espacios'] as
      | Array<Record<string, unknown>>
      | undefined;
    return (espacios ?? []).map((e, i) => ({
      id: String(e['id'] ?? e['_id'] ?? `esp-${i}`),
      tipo: (e['tipo'] as string) ?? 'estandar',
      descripcion: (e['descripcion'] as string) ?? '',
      tamanoMaxPerro: e['tamanoMaxPerro'] as string | undefined,
      precioNoche: (e['precioNoche'] as number) ?? h.precioBase ?? 0,
      precioAnterior: e['precioAnterior'] as number | undefined,
      cantidad: (e['cantidad'] as number) ?? 1,
      disponible: (e['disponible'] as boolean) ?? true,
      amenities: (e['amenities'] as string[]) ?? [],
      imagenes: (e['imagenes'] as string[]) ?? [],
      cancelacionGratis: (e['cancelacionGratis'] as boolean) ?? true,
    }));
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
