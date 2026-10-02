import { Injectable, Logger } from '@nestjs/common';
import { UnidadReservable, idDeUnidad } from './unidad-reservable';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CatalogRepository, BboxParams, BuscarServiciosParams, CiudadDestacada, FacetasResult, OrdenServicios, PuntoServicio,
} from './catalog.repository';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { ReviewsService } from '../reviews/reviews.service';
import { ResenaDocument } from '../reviews/resena.schema';
import { PerrosService } from '../perros/perros.service';
import { GeoService } from '../geo/geo.service';
import { CentrosPoblacionService } from '../geo/centros-poblacion.service';
import { AptitudPerro } from './servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { campoContador, plazasDeclaradas, sinPlazas } from './disponibilidad';
import {
  CrearServicioDto, ActualizarServicioDto, ActualizarDisponibilidadDto,
  ServicioClinicoTipo, esEspecialidadSuelta, HorarioDiaDto, ExcepcionHorarioDto, MIN_FOTOS_SERVICIO,
  BusquedaCercanosApi, RADIO_CERCANOS_KM, resolverMunicipio, etiquetaPuntuacion, perfilesSocialesNoAdmitidos,
  pareceObjectId, slugDeFicha, slugLibre,
  type ConfigGuarderia, ofreceResidencia, precioDesdeGuarderia,
  tieneValoraciones, precioDesdeServicio, formatearDireccion, lineaCalle,
} from 'shared';

/** Poblaciones que pinta "Servicios cerca de ti" en la portada, y su tope. */
const CIUDADES_DESTACADAS_DEFECTO = 8;
const CIUDADES_DESTACADAS_MAX = 20;

/** Campos de disponibilidad editables por el comercio, según el vertical del servicio. */
const CAMPOS_DISPONIBILIDAD_POR_VERTICAL: Record<string, Array<keyof ActualizarDisponibilidadDto>> = {
  alojamiento: ['espacios'],
  transporte: ['unidadesDisponibles'],
  veterinaria: ['citasDisponibles'],
  peluqueria: ['cuposDisponibles'],
  adiestramiento: ['cuposDisponibles'],
  hoteles: ['unidadesDisponibles'],
  funerarios: ['cuposDisponibles'],
};

/** Todos los campos propios de cada vertical (más allá de los del Servicio base), aceptados al crear/editar un listado. */
const CAMPOS_EXTRA_POR_VERTICAL: Record<string, string[]> = {
  alojamiento: [
    'espacios', 'amenities', 'checkIn', 'checkOut', 'politicaCancelacion',
    'requisitoVacunas', 'paseosIncluidos', 'camaras24h', 'cancelacionGratis',
    'compatibilidadSocialAdmitida', 'compatibilidadSocialNoAdmitida', 'conductasNoAdmitidas', 'requisitoMicrochip', 'requiereDesparasitacionInterna',
    'requiereDesparasitacionExterna', 'requiereVacunaTosPerreras', 'serviciosAdicionales',
    // Residencia y/o guardería de día.
    'modalidades', 'guarderia',
  ],
  transporte: [
    'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm', 'tarifaEsperaPorHora',
    'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
    'tiposTransporteOfrecidos', 'precioExclusivo', 'requisitoMicrochip', 'requisitoVacunas',
    'caracteristicasVehiculo', 'serviciosAdicionales',
    'radioCoberturaKm', 'trayecto',
    'distanciaMinimaKm', 'aceptaPPP', 'requiereTransportinPropio',
    'maxPerrosPorTrayecto', 'antelacionMinimaHoras',
    // Alta guiada de "Transporte de mascotas": los seis pasos del asistente.
    'plantilla', 'quienViaja', 'tiposTrayecto', 'ambitos', 'tipoRecogida', 'finalidades',
    'modoCobertura', 'direccionBase', 'radioKm', 'distanciaMaximaKm', 'municipiosCobertura',
    'paisesCobertura', 'puntosTrayecto', 'baseKilometraje', 'tipoIdaVuelta', 'politicaParadas',
    'esperaIncluidaMin', 'politicaPeajes',
    'reglasTarifa', 'redondeoDistancia', 'suplementos', 'precioOrientativo', 'precioDesde',
    'horasRespuestaPresupuesto', 'validezPresupuestoHoras',
    'especiesAdmitidas', 'tamanosAdmitidos', 'maxMascotasPorReserva', 'compartido',
    'situacionesConfirmacion', 'plazasAcompanantes', 'precioAcompanante', 'equipajeAdmitido',
    'equipamientoVehiculo', 'requisitosDocumentales',
    'modoDisponibilidad', 'ventanaRecogida', 'confirmacionHoras', 'frecuenciasRecurrencia',
    'periodoMaximoSemanas', 'salidas', 'respuestaUrgenteHoras',
    'politicaCancelacionTransporte', 'cortesiaMinutos', 'accionNoShow',
  ],
  veterinaria: [
    'especialidades', 'serviciosClinicos', 'tiposServicioClinico', 'duracionCitaMin', 'citasPorDia',
    'citasDisponibles', 'atiendeUrgencias', 'precioConsulta', 'especiesAtendidas',
  ],
  peluqueria: [
    'serviciosGrooming', 'duracionSlotMin', 'capacidadSimultanea',
    'cuposDisponibles', 'aDomicilio',
    'politicaTemperamentoDificil', 'bozalObligatorioSiAgresivo', 'serviciosAdicionales',
    'razasEspecificas', 'requiereVacunasAlDia', 'requiereMicrochip',
  ],
  adiestramiento: [
    'tiposAdiestramiento', 'modalidad', 'precioSesion', 'precioPrograma',
    'sesionesPorPrograma', 'edadMinimaMeses', 'aDomicilio', 'capacidadPorSesion',
    'cuposDisponibles', 'serviciosAdiestramiento', 'valoracionesIniciales',
    // Fichas anteriores a los precios por modalidad guardaban una sola valoración.
    'valoracionInicial',
  ],
  hoteles: [
    'admiteMascotas', 'maxMascotasPorReserva', 'pesoMaximoMascotaKg', 'razasRestringidas',
    'razasEspecificasRestringidas', 'especiesPermitidas', 'suplementoPorTamanoMascota',
    'suplementoSegundaMascotaPorNoche', 'serviciosPetfriendly', 'puedeQuedarseSoloEnHabitacion',
    'accesoZonasComunes', 'debeIrConCorrea', 'debeLlevarBozalSiCorresponde',
    'checkIn', 'checkOut', 'fianza', 'unidadesDisponibles', 'espacios',
  ],
  seguros: [
    'tiposSeguro', 'limitesCobertura', 'condicionesAdmision', 'primaAnualBase',
    'descuentoPagoAnualPct', 'duracionMeses', 'renovacionAutomatica', 'cupoPolizas',
    'documentoCondicionesUrl',
    // Alta por solicitud revisada a mano (no es un listado como los demás).
    'solicitud', 'estadoSolicitud',
  ],
  funerarios: [
    'serviciosFunerarios', 'tiposServicioFunerario', 'extras', 'ofreceRecogida', 'radioRecogidaKm', 'modoPrecioRecogida',
    'precioRecogida', 'precioRecogidaPorKm', 'zonasRecogida', 'lugaresRecogida',
    'servicioUrgente', 'atiende24h', 'suplementoUrgencia', 'franjasDisponibles',
    'declaraAutorizaciones', 'cremacionPropia', 'terceroCrematorio',
    'politicaCancelacionFunerario', 'cuposDisponibles',
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
  // Seguros no exige nada al crear: lo que se entrega es una solicitud de alta
  // con su documentación, y las coberturas y primas se configuran al aprobarla.
  seguros: [],
  funerarios: ['serviciosFunerarios'],
};

/** Vista de tarjeta de servicio (catálogo genérico) que consume el frontend. */
export interface ServicioCardDto {
  id: string;
  /** Dirección legible de la ficha; ausente mientras la migración no la rellene. */
  slug?: string;
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
  /**
   * Horario de atención del servicio y sus días especiales. Viajan aparte de
   * `extra` porque son del Servicio base, no de un vertical: los tiene una
   * clínica igual que una residencia canina.
   */
  horario?: HorarioDiaDto[];
  excepcionesHorario?: ExcepcionHorarioDto[];
  /** Coordenadas del listado; ausentes mientras el comercio no las declare. */
  lat?: number;
  lng?: number;
  /** Distancia a la población buscada; sólo en los resultados de "lo más cercano". */
  distanciaKm?: number;
  /** Km al centro de la población del servicio; ausente si no tiene coordenadas. */
  distanciaCentroKm?: number;
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
  /**
   * Residencia canina: perfiles de compatibilidad social que el centro NO
   * admite; vacío = cualquiera. Ya resuelto para fichas del modelo anterior
   * (ver `perfilesSocialesNoAdmitidos`).
   */
  compatibilidadSocialNoAdmitida: string[];
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
  /**
   * Sólo cuando la población pedida no tenía nada: entonces `items` son los
   * servicios más cercanos a ella y esto dice cuál es el primero y a qué distancia.
   */
  cercanos?: BusquedaCercanosApi;
}

/** Vista completa (no normalizada) de un servicio propio, para precargar el formulario de edición. */
export interface ServicioGestionDto {
  id: string;
  vertical: string;
  titulo: string;
  descripcion: string;
  ciudad: string;
  /** Dirección exacta desde la que se presta el servicio. */
  calle?: string;
  numero?: string;
  provincia?: string;
  codigoPostal?: string;
  pais?: string;
  /** Horario de atención del servicio y sus festivos/cierres puntuales. */
  horario: HorarioDiaDto[];
  excepcionesHorario: ExcepcionHorarioDto[];
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
  slug?: string;
  estado?: string;
  comercioId?: unknown;
  titulo: string;
  descripcion?: string;
  imagenes?: string[];
  ubicacion?: {
    ciudad?: string;
    calle?: string;
    numero?: string;
    provincia?: string;
    codigoPostal?: string;
    pais?: string;
    geo?: { coordinates?: number[] };
  };
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
  compatibilidadSocialNoAdmitida?: string[];
  requisitoMicrochip?: boolean;
  requiereDesparasitacionInterna?: boolean;
  requiereDesparasitacionExterna?: boolean;
  requiereVacunaTosPerreras?: boolean;
  serviciosAdicionales?: Array<{ nombre: string; precio: number }>;
  distanciaCentroKm?: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;


/** Órdenes aceptados en la búsqueda; cualquier otro valor cae en `relevancia`. */
const ORDENES_VALIDOS: readonly OrdenServicios[] = [
  'relevancia', 'precio_asc', 'precio_desc', 'valoracion', 'distancia',
];

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly repo: CatalogRepository,
    private readonly reviewsService: ReviewsService,
    private readonly perrosService: PerrosService,
    private readonly geoService: GeoService,
    private readonly centrosPoblacion: CentrosPoblacionService,
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

    const encontrados = await this.repo.buscar(params);
    const cercanos = encontrados.total === 0 ? await this.buscarCercanos(params) : null;
    const { items, total } = cercanos ?? encontrados;
    const adheridos = await this.comerciosAdheridosAlpha(items as unknown as ServicioLean[]);

    const cards = items.map((doc, i) => {
      const lean = doc as unknown as ServicioLean;
      const card = this.toCard(lean);
      card.alphaAdherido = adheridos.has(String(lean.comercioId));
      if (cercanos) card.distanciaKm = cercanos.distanciasKm[i];
      return card;
    });

    return {
      items: cards,
      total,
      page: params.page,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
      ...(cercanos ? { cercanos: this.resumenCercanos(params.ciudad ?? '', cards) } : {}),
    };
  }

  /**
   * Una población sin nada: lo que hay alrededor, de más cerca a más lejos.
   * Sólo al buscar por población escrita; con el mapa, la zona ya la eligió
   * el usuario y un vacío ahí es la respuesta.
   *
   * El punto de partida sale, por orden, de las coordenadas que mandó el
   * buscador al elegir la población, de las fichas que ya hay en ella (aunque
   * no se muestren) y, si no, del geocodificador.
   */
  private async buscarCercanos(params: BuscarServiciosParams) {
    if (!params.ciudad?.trim() || params.bbox) return null;

    if (!(await this.repo.hayServiciosUbicados(params))) return null;

    const centro = params.lat != null && params.lng != null
      ? { lat: params.lat, lng: params.lng }
      : (await this.repo.centroDePoblacion(params.ciudad)) ?? (await this.geoService.coordenadasDePoblacion(params.ciudad));
    if (!centro) return null;

    const cercanos = await this.repo.buscarCercanos({ ...params, ...centro, radioKm: RADIO_CERCANOS_KM });
    // Página a la que ya no llegan resultados: se contesta vacío, sin aviso.
    return cercanos.items.length ? cercanos : null;
  }

  private resumenCercanos(ciudad: string, cards: ServicioCardDto[]): BusquedaCercanosApi {
    const [primero] = cards;
    return {
      ciudadBuscada: resolverMunicipio(ciudad)?.municipio.nombre ?? ciudad.trim(),
      radioKm: RADIO_CERCANOS_KM,
      masCercano: { id: primero.id, slug: primero.slug, nombre: primero.nombre, ciudad: primero.ciudad, distanciaKm: primero.distanciaKm ?? 0 },
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

  /** Poblaciones con más oferta publicada, con una foto real de cada una (portada). */
  obtenerCiudadesDestacadas(limite = CIUDADES_DESTACADAS_DEFECTO): Promise<CiudadDestacada[]> {
    const tope = Number.isFinite(limite) && limite > 0 ? Math.min(Math.floor(limite), CIUDADES_DESTACADAS_MAX) : CIUDADES_DESTACADAS_DEFECTO;
    return this.repo.ciudadesDestacadas(tope);
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

    // Un comercio pendiente de aprobación puede preparar sus listados, pero no
    // aparecen en el buscador hasta que el admin lo activa (HU J1).
    const comercio = await this.comercioModel
      .findById(comercioId).select('estado altaCompletada').lean().exec();

    const doc = await this.repo.crear({
      vertical: dto.vertical,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      ciudad: dto.ciudad,
      lat: dto.lat,
      lng: dto.lng,
      calle: dto.calle,
      numero: dto.numero,
      provincia: dto.provincia,
      codigoPostal: dto.codigoPostal,
      pais: dto.pais,
      horario: dto.horario,
      excepcionesHorario: dto.excepcionesHorario,
      precioBase: this.precioBaseCoherente(dto.vertical, dto.precioBase, extra) ?? dto.precioBase,
      imagenes: dto.imagenes ?? [],
      comercioId,
      comercioActivo: comercio?.estado === 'activo',
      estado: this.estadoInicial(dto.imagenes ?? [], comercio),
      extra,
      aptitud: dto.aptitud,
    });
    const slug = await this.asignarSlug({
      id: String(doc._id), vertical: dto.vertical, titulo: dto.titulo, ciudad: dto.ciudad,
    });
    if (slug) doc.slug = slug;
    return this.toCard(await this.conDistanciaAlCentro(doc as unknown as ServicioLean));
  }

  /**
   * Genera la dirección legible del servicio y la guarda.
   *
   * Va en un paso aparte del alta para no tocar la creación por discriminador.
   * Si dos altas homónimas llegan a la vez, el índice único rechaza a la
   * segunda con un E11000 y se reintenta con el siguiente sufijo libre. Nunca
   * rompe el guardado: sin slug la ficha sigue abriéndose por su id.
   */
  private async asignarSlug(datos: {
    id: string; vertical: string; titulo: string; ciudad?: string;
  }): Promise<string | undefined> {
    const base = slugDeFicha(datos.titulo, datos.ciudad, 'servicio');
    for (let intento = 0; intento < 3; intento += 1) {
      try {
        const slug = await slugLibre(base, (candidato) => this.repo.existeSlug(datos.vertical, candidato, datos.id));
        await this.repo.fijarSlug(datos.id, slug);
        return slug;
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) {
          this.logger.warn(`Sin slug para el servicio ${datos.id}: ${(error as Error).message}`);
          return undefined;
        }
      }
    }
    return undefined;
  }

  /**
   * El slug se recalcula sólo si la ficha no lo tiene (listado anterior a la
   * migración) o si sigue en borrador y cambia su título o su ciudad: una
   * ficha en borrador no es pública y su dirección no circula todavía.
   */
  private debeRecalcularSlug(existente: ServicioLean, dto: ActualizarServicioDto): boolean {
    if (!existente.slug) return true;
    const cambiaNombre = dto.titulo !== undefined || dto.ciudad !== undefined;
    return existente.estado === 'borrador' && cambiaNombre;
  }

  /**
   * Calcula y guarda los km al centro de la población del servicio. Nunca
   * rompe el guardado: sin geocodificador la tarjeta sale sin distancia.
   */
  private async conDistanciaAlCentro(servicio: ServicioLean): Promise<ServicioLean> {
    const [lng, lat] = servicio.ubicacion?.geo?.coordinates ?? [];
    const ciudad = servicio.ubicacion?.ciudad;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !ciudad) return servicio;

    try {
      const km = await this.centrosPoblacion.distanciaAlCentro({ lat, lng }, ciudad, servicio.ubicacion?.provincia);
      if (km === null) return servicio;
      await this.repo.actualizarCampos(String(servicio._id), { distanciaCentroKm: km });
      servicio.distanciaCentroKm = km;
    } catch (error) {
      this.logger.warn(`Sin distancia al centro para ${String(servicio._id)}: ${(error as Error).message}`);
    }
    return servicio;
  }

  /**
   * Una ficha nueva nace publicada, no aparcada en borrador.
   *
   * Dejarla en borrador obligaba a rematar el alta y volver a entrar por «Mis
   * servicios» a darle a publicar, un paso que nadie asocia con «ya he
   * terminado». Nace publicada sólo si de verdad se podría publicar a mano
   * —mismas condiciones que {@link ComerciosService.cambiarEstadoServicio}—;
   * si no, sigue en borrador y se publica sola al cerrar el alta.
   *
   * Salir publicada no la pone en el buscador todavía: eso lo decide
   * `comercioActivo`, que sólo es cierto con el negocio ya aprobado.
   */
  /**
   * El `precioBase` que se guarda es el «desde» real: el del producto más
   * barato que publica el servicio. El comercio lo escribía a mano como
   * «precio orientativo» y el buscador filtraba y ordenaba por él mientras la
   * ficha cobraba otro. Sin productos con precio se queda el que escribió.
   */
  private precioBaseCoherente(
    vertical: string, precioBase: number | undefined, extra: Record<string, unknown> | undefined,
  ): number | undefined {
    const desde = precioDesdeServicio({ vertical, precioBase, extra });
    return desde > 0 ? desde : precioBase;
  }

  private estadoInicial(
    imagenes: string[], comercio: { altaCompletada?: boolean } | null,
  ): 'borrador' | 'publicado' {
    const cumple = comercio?.altaCompletada === true && imagenes.length >= MIN_FOTOS_SERVICIO;
    return cumple ? 'publicado' : 'borrador';
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
      calle: dto.calle,
      numero: dto.numero,
      provincia: dto.provincia,
      codigoPostal: dto.codigoPostal,
      pais: dto.pais,
      horario: dto.horario,
      excepcionesHorario: dto.excepcionesHorario,
      precioBase: extra
        ? this.precioBaseCoherente(vertical, dto.precioBase ?? existente.precioBase, extra)
        : dto.precioBase,
      imagenes: dto.imagenes,
      extra,
      aptitud: dto.aptitud,
    });
    if (!actualizado) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const cambiaUbicacion = dto.ciudad !== undefined || dto.lat !== undefined || dto.lng !== undefined;
    const servicio = actualizado as unknown as ServicioLean;
    if (this.debeRecalcularSlug(existente as unknown as ServicioLean, dto)) {
      const slug = await this.asignarSlug({
        id, vertical, titulo: servicio.titulo, ciudad: servicio.ubicacion?.ciudad,
      });
      if (slug) servicio.slug = slug;
    }
    return this.toCard(cambiaUbicacion ? await this.conDistanciaAlCentro(servicio) : servicio);
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
      calle: h.ubicacion?.calle,
      numero: h.ubicacion?.numero,
      provincia: h.ubicacion?.provincia,
      codigoPostal: h.ubicacion?.codigoPostal,
      pais: h.ubicacion?.pais,
      horario: (h['horario'] as ServicioGestionDto['horario']) ?? [],
      excepcionesHorario: (h['excepcionesHorario'] as ServicioGestionDto['excepcionesHorario']) ?? [],
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
    /*
     * Transporte tiene dos formas válidas de tener precio: la tarifa base + km
     * del formulario antiguo, o al menos una regla de tarifa del alta guiada.
     * Exigir siempre las dos primeras haría imposible publicar un servicio de
     * precio fijo por zonas, que es justo lo que el alta nueva permite.
     */
    if (vertical === 'transporte' && Array.isArray(campos['reglasTarifa']) && campos['reglasTarifa'].length > 0) {
      return;
    }

    /*
     * Un centro que sólo hace guardería de día no tiene suites: lo que lo hace
     * reservable son las plazas y al menos un precio de guardería.
     */
    if (vertical === 'alojamiento' && !ofreceResidencia({ modalidades: campos['modalidades'] as string[] | undefined })) {
      if (!precioDesdeGuarderia(campos['guarderia'] as ConfigGuarderia | undefined)
        || !(Number((campos['guarderia'] as ConfigGuarderia | undefined)?.plazasPorDia) > 0)) {
        throw new DomainException('Indica las plazas por día y al menos un precio de la guardería de día.', 400);
      }
      return;
    }

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

      if (!permitidos.includes(tipo)) {
        throw new DomainException(
          `"${tipo}" no está en el catálogo de servicios veterinarios reservables.`, 400,
        );
      }

      if (tipo === ServicioClinicoTipo.OTRO) {
        this.validarServicioLibre(servicio['nombre'] as string | undefined);
      }
    }
  }

  /**
   * La regla de oro de `veterinarios.md`: si el cliente no puede saber cuánto
   * va a pagar antes de acudir, eso no se publica como reserva directa. Una
   * especialidad suelta —«cardiología»— describe a quién ves, no lo que cuesta.
   */
  private validarServicioLibre(nombre?: string): void {
    if (!nombre?.trim()) {
      throw new DomainException('Ponle nombre al servicio que has añadido.', 400);
    }
    if (!esEspecialidadSuelta(nombre)) return;

    throw new DomainException(
      `"${nombre.trim()}" es una especialidad, no un servicio con precio. Publica el acto concreto ` +
      `—por ejemplo «Primera consulta de ${nombre.trim().toLowerCase()}» con su importe—, ` +
      'que es lo que el cliente puede reservar y pagar.',
      400,
    );
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

  /**
   * Ficha pública por slug (`reino-canino-valencia`) **o** por id.
   *
   * El id se sigue aceptando porque los enlaces antiguos están en marcadores,
   * correos y chats; la respuesta lleva el `slug` y la web redirige a él. El
   * slug es único por vertical, así que la web manda la categoría de la ruta;
   * sin ella se toma la primera coincidencia.
   */
  async obtenerServicio(idOSlug: string, vertical?: string): Promise<ServicioDetalleDto> {
    const doc = pareceObjectId(idOSlug)
      ? await this.repo.obtenerPorId(idOSlug)
      : await this.repo.obtenerPorSlug(idOSlug.trim().toLowerCase(), vertical);
    if (!doc) {
      throw new DomainException('Servicio no encontrado', 404);
    }
    const resenas = await this.reviewsService.listarPorServicio(String(doc._id));
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
    const numResenas = h.totalReseñas ?? 0;
    // Sin reseñas no hay nota: un `ratingPromedio` heredado sin nadie detrás
    // salía como «4,2 · Muy bueno» (o «0 · Correcto») en un servicio sin valorar.
    const score = tieneValoraciones(h.ratingPromedio, numResenas)
      ? Math.round((h.ratingPromedio ?? 0) * 10) / 10
      : 0;
    const extra = this.pickExtra(h as unknown as Record<string, unknown>);
    const vertical = (h as unknown as Record<string, unknown>)['vertical'] as string | undefined;
    // GeoJSON guarda [lng, lat]; invertirlo aquí evita que cada consumidor
    // tenga que acordarse del orden y lo pinte en mitad del océano.
    const [lng, lat] = h.ubicacion?.geo?.coordinates ?? [];
    return {
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      id: String(h._id),
      slug: h.slug || undefined,
      nombre: h.titulo,
      ciudad: h.ubicacion?.ciudad ?? '',
      barrio: h.barrio ?? '',
      direccion: this.lineaDireccion(h),
      estrellas: h.estrellas ?? 3,
      score,
      scoreLabel: etiquetaPuntuacion(score, numResenas),
      numResenas,
      // El «desde» de la ficha: el producto más barato que publica, no el
      // precio orientativo que escribió el comercio (ver `precioDesdeServicio`).
      precioPorNoche: precioDesdeServicio({ vertical, precioBase: h.precioBase, extra }),
      precioAnterior: h.precioAnterior,
      descuentoPct: h.descuentoPct,
      imagenes: h.imagenes ?? [],
      amenities: h.amenities ?? [],
      cancelacionGratis: h.cancelacionGratis ?? true,
      desayunoIncluido: h.desayunoIncluido ?? false,
      espaciosDisponibles: h.espaciosDisponibles ?? 0,
      paseosIncluidos: h.paseosIncluidos ?? false,
      destacado: h.destacado ?? false,
      vertical,
      horario: (h as unknown as Record<string, unknown>)['horario'] as HorarioDiaDto[] | undefined,
      excepcionesHorario: (h as unknown as Record<string, unknown>)['excepcionesHorario'] as ExcepcionHorarioDto[] | undefined,
      extra,
      distanciaCentroKm: h.distanciaCentroKm,
    };
  }

  /**
   * Línea de dirección de la ficha: calle y número de la ubicación del servicio.
   *
   * La dirección dejó de ser un texto libre del bloque de alojamiento —se pedía
   * dos veces y podía contradecir al mapa— y pasó a la ubicación estructurada.
   * Los listados creados antes de la mudanza conservan el campo antiguo, así que
   * se sigue leyendo como respaldo para no vaciarles la ficha.
   */
  private lineaDireccion(h: ServicioLean): string {
    const { calle, numero } = h.ubicacion ?? {};
    // `lineaCalle` descarta una calle sin nombre («1») y `formatearDireccion`
    // limpia el texto antiguo: de ahí salía el «1, 1, , Valencia» de la ficha.
    return lineaCalle(calle, numero) || formatearDireccion([h.direccion]);
  }

  /** Extrae los campos propios de cada vertical canina (los que no son del Servicio base). */
  private pickExtra(h: Record<string, unknown>): Record<string, unknown> {
    const claves = [
      // alojamiento canino
      'espacios', 'espaciosDisponibles', 'checkIn', 'checkOut', 'requisitoVacunas', 'paseosIncluidos', 'camaras24h',
      'compatibilidadSocialAdmitida', 'compatibilidadSocialNoAdmitida', 'conductasNoAdmitidas', 'requisitoMicrochip', 'requiereDesparasitacionInterna',
      'requiereDesparasitacionExterna', 'requiereVacunaTosPerreras', 'serviciosAdicionales',
      'modalidades', 'guarderia',
      // transporte de animales
      'tipoVehiculo', 'capacidadPerros', 'zonaCobertura', 'tarifaBase', 'tarifaKm', 'tarifaEsperaPorHora', 'jaulasIncluidas', 'acompananteHumano', 'soloPerros', 'unidadesDisponibles',
      'radioCoberturaKm', 'trayecto',
      'distanciaMinimaKm', 'aceptaPPP', 'requiereTransportinPropio',
      'maxPerrosPorTrayecto', 'antelacionMinimaHoras',
      // veterinaria
      'especialidades', 'serviciosClinicos', 'tiposServicioClinico', 'duracionCitaMin', 'citasPorDia', 'citasDisponibles', 'atiendeUrgencias', 'precioConsulta', 'especiesAtendidas',
      // peluquería canina
      'serviciosGrooming', 'duracionSlotMin', 'capacidadSimultanea', 'aDomicilio',
      'politicaTemperamentoDificil', 'bozalObligatorioSiAgresivo', 'serviciosAdicionales',
      'razasEspecificas', 'requiereVacunasAlDia', 'requiereMicrochip',
      // adiestramiento canino
      'tiposAdiestramiento', 'modalidad', 'precioSesion', 'precioPrograma', 'sesionesPorPrograma', 'edadMinimaMeses', 'capacidadPorSesion',
      'serviciosAdiestramiento', 'valoracionesIniciales', 'valoracionInicial',
      // hotel pet-friendly
      'admiteMascotas', 'maxMascotasPorReserva', 'pesoMaximoMascotaKg', 'razasRestringidas',
      'razasEspecificasRestringidas', 'especiesPermitidas', 'suplementoPorTamanoMascota',
      'suplementoSegundaMascotaPorNoche', 'serviciosPetfriendly', 'puedeQuedarseSoloEnHabitacion',
      'accesoZonasComunes', 'debeIrConCorrea', 'debeLlevarBozalSiCorresponde', 'fianza', 'unidadesDisponibles',
      // Los tipos de habitación del hotel viajan en `espacios`, igual que los
      // de alojamiento: el detalle público ya sabe pintarlos con sus fotos.
      // seguros
      'tiposSeguro', 'limitesCobertura', 'condicionesAdmision', 'primaAnualBase',
      'descuentoPagoAnualPct', 'duracionMeses', 'renovacionAutomatica', 'documentoCondicionesUrl',
      // La solicitud no se proyecta en el detalle público: son datos de contacto
      // y documentación privada. Sólo viaja su estado.
      'estadoSolicitud',
      // servicios funerarios
      'serviciosFunerarios', 'tiposServicioFunerario', 'extras', 'ofreceRecogida', 'radioRecogidaKm', 'modoPrecioRecogida',
      'precioRecogida', 'precioRecogidaPorKm', 'zonasRecogida', 'lugaresRecogida',
      'servicioUrgente', 'atiende24h', 'suplementoUrgencia', 'franjasDisponibles',
      'cremacionPropia', 'terceroCrematorio', 'politicaCancelacionFunerario',
      // comunes a citas/cupos
      'cuposDisponibles',
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
      compatibilidadSocialNoAdmitida: perfilesSocialesNoAdmitidos(h),
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
      id: idDeUnidad(e as unknown as UnidadReservable & { _id?: unknown }, i),
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

}
