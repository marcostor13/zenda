import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MascotaAdicional, Reserva, ReservaDocument, SuplementoAplicado } from './reserva.schema';
import { conHoraReal } from './momento-reserva.util';
import { HuecosService, ServicioConCitas } from './huecos.service';
import { AvailabilityRegistry } from '../availability/availability.registry';
import {
  DiaCalendario, PoliticaReembolso, implementaCalendario, implementaCancelacion, implementaSeguimiento,
} from '../availability/availability.strategy';
import { PresupuestosService } from '../presupuestos/presupuestos.service';
import { CatalogRepository } from '../catalog/catalog.repository';
import { CuponesService } from '../cupones/cupones.service';
import { PerrosService } from '../perros/perros.service';
import { construirSnapshotPerro } from '../perros/perro-snapshot.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ComisionResolverService } from '../comision-configs/comision-resolver.service';
import { EventosService } from '../eventos/eventos.service';
import { BloqueosService } from '../bloqueos/bloqueos.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  VerticalKey, ReservaEstado, IVA_RATE, COMISION_PCT_DEFAULT, TipoEvento,
  DisponibilidadRespuesta, ExcepcionHorarioDto, HuecosDelDiaRespuestaApi, HorarioDiaDto, claveDiaEnZona, comprobarHorario,
  esHoraValida, esMedianocheUtc, fechaYHoraEnZona, horaEnZona, MAX_OCURRENCIAS_SERIE, ocurrenciasDeSerie,
} from 'shared';
import { nanoid } from 'nanoid';

export interface SuplementoSolicitado {
  concepto: string;
  monto: number;
  motivo?: string;
}

export interface RecurrenciaParams {
  diasSemana: number[];
  hora: string;
  fechaFin: Date;
  /** El mismo día de cada mes en vez de días de la semana. */
  mensual?: boolean;
}

/**
 * Lo mínimo para preguntar por disponibilidad: sin cupón ni recurrencia, que
 * sólo influyen en el importe y en cuántas reservas se generan al confirmar.
 */
export interface ComprobarDisponibilidadParams {
  usuarioId: string;
  servicioId: string;
  comercioId?: string;
  vertical?: VerticalKey;
  perroId?: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  detalle?: Record<string, unknown>;
}

export interface CrearReservaParams {
  usuarioId: string;
  servicioId: string;
  /**
   * Lo que declaró el cliente. **No es la fuente de verdad**: el comercio y el
   * vertical se leen del servicio reservado y estos valores sólo se usan para
   * detectar que la petición no cuadra. Ver `resolverServicio`.
   */
  comercioId?: string;
  vertical?: VerticalKey;
  perroId?: string;
  /** Más mascotas del cliente en la misma reserva (un traslado lleva a varias). */
  perroIdsAdicionales?: string[];
  /** Presupuesto aceptado: el importe sale de él, no de la tarifa. */
  presupuestoId?: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  detalle?: Record<string, unknown>;
  comisionPct?: number;
  cuponCodigo?: string;
  recurrencia?: RecurrenciaParams;
}

const MAX_OCURRENCIAS_RECURRENCIA = MAX_OCURRENCIAS_SERIE;

/** Estados en los que el comercio puede ir marcando el viaje. */
const ESTADOS_EN_SERVICIO: readonly ReservaEstado[] = [ReservaEstado.CONFIRMADA, ReservaEstado.EN_CURSO];

/** Resultado de cancelar una reserva: qué se devuelve según la política del vertical. */
export interface CancelacionResultado {
  reserva: ReservaDocument;
  politica: PoliticaReembolso;
  importeReembolso: number;
}

const MOTIVO_HORA_OCUPADA = 'Esa hora ya está reservada. Elige otra de las citas disponibles.';

/** Días como mucho por consulta de calendario: el cliente pide de mes en mes. */
const MAX_DIAS_CALENDARIO = 120;

export interface CalendarioDisponibilidadParams {
  usuarioId: string;
  servicioId: string;
  desde: Date;
  hasta: Date;
  espacioId?: string;
}

export interface HuecosDelDiaParams {
  /** Sin sesión también se pueden ver las citas: el asistente admite invitados. */
  usuarioId?: string;
  servicioId: string;
  /** Día del comercio, `YYYY-MM-DD`. */
  fecha: string;
  perroId?: string;
  cantidad?: number;
  detalle?: Record<string, unknown>;
}

export interface CalendarioDisponibilidadRespuesta {
  /** false = este vertical no se reserva por rango de fechas. */
  soportado: boolean;
  dias: DiaCalendario[];
}

/** Lo que la reserva necesita saber del servicio, además de a quién pertenece. */
interface ServicioResuelto {
  comercioId: string;
  vertical: VerticalKey;
  horario?: HorarioDiaDto[];
  excepcionesHorario?: ExcepcionHorarioDto[];
}

/** Cuándo empieza y acaba de verdad lo reservado, ya en hora del comercio. */
interface MomentoReserva {
  inicio: Date;
  fin?: Date;
  /** Es una cita con duración (veterinaria, peluquería…), no un día o una estancia. */
  esCita: boolean;
  duracionMin?: number;
}

const MS_POR_MINUTO = 60_000;

/** Importes en euros con dos decimales: el céntimo es la unidad mínima de cobro. */
const redondearEuros = (importe: number): number => Math.round(importe * 100) / 100;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    private readonly availabilityRegistry: AvailabilityRegistry,
    private readonly catalogRepository: CatalogRepository,
    private readonly cuponesService: CuponesService,
    private readonly perrosService: PerrosService,
    private readonly notificationsService: NotificationsService,
    private readonly comisionResolver: ComisionResolverService,
    private readonly eventosService: EventosService,
    private readonly bloqueosService: BloqueosService,
    private readonly huecosService: HuecosService,
    private readonly presupuestosService: PresupuestosService,
  ) {}

  /**
   * ¿Se puede reservar esto con estos datos? Sin crear nada ni bloquear cupo.
   *
   * Existe para que el cliente lo sepa en el primer paso, al elegir fechas, en
   * lugar de chocar con el 409 al final del embudo —con los datos personales ya
   * rellenados y el pago delante—, que es donde se descubría hasta ahora.
   *
   * Las estrategias señalan la incompatibilidad de dos formas: devolviendo
   * `disponible: false` (no hay hueco) o lanzando una `DomainException` 409
   * (este espacio no admite a ese perro). Las dos son la misma respuesta para
   * quien pregunta, así que aquí se unifican: una consulta nunca falla, informa.
   */
  async comprobarDisponibilidad(
    params: ComprobarDisponibilidadParams,
  ): Promise<DisponibilidadRespuesta> {
    const servicio = await this.resolverServicio(params);
    const estrategia = this.availabilityRegistry.obtener(servicio.vertical);
    const fechaInicio = this.inicioConHora(params.fechaInicio, params.detalle);

    const perroSnapshot = params.perroId
      ? construirSnapshotPerro(await this.perrosService.obtenerPropio(params.perroId, params.usuarioId))
      : undefined;

    try {
      const resultado = await estrategia.checkAvailability(params.servicioId, {
        fechaInicio,
        fechaFin: params.fechaFin,
        cantidad: params.cantidad ?? 1,
        parametrosExtra: this.construirParametrosExtra(params.detalle, perroSnapshot),
      });

      const momento = this.momentoDe(fechaInicio, params.fechaFin, resultado.metadata, params.cantidad);
      const horario = this.comprobarHorarioDeCita(servicio, momento);
      if (resultado.disponible && !horario.permitido) {
        return { disponible: false, motivo: horario.motivo, capacidadRestante: resultado.capacidadRestante };
      }
      if (resultado.disponible && !(await this.quedaPlazaParaLaCita(params.servicioId, servicio, momento, resultado.metadata))) {
        return { disponible: false, motivo: MOTIVO_HORA_OCUPADA, capacidadRestante: resultado.capacidadRestante };
      }

      if (resultado.disponible) {
        return {
          disponible: true,
          precioEstimado: resultado.precioCalculado,
          capacidadRestante: resultado.capacidadRestante,
        };
      }

      return {
        disponible: false,
        motivo: resultado.motivo ?? 'El servicio no está disponible para las fechas seleccionadas',
        capacidadRestante: resultado.capacidadRestante,
      };
    } catch (error) {
      // Un 409 de la estrategia es una respuesta de negocio ("no admite este
      // perro"), no un fallo: se devuelve como motivo. El resto —404, 400, un
      // error de infraestructura— sí sube, porque no es algo que el cliente
      // pueda arreglar cambiando las fechas.
      if (error instanceof DomainException && error.statusCode === 409) {
        return { disponible: false, motivo: error.message };
      }
      throw error;
    }
  }

  /**
   * Citas que se pueden coger un día, para que el cliente elija una en vez de
   * escribir una hora sin saber cuáles quedan libres.
   *
   * La duración la dice la estrategia del vertical (según el servicio y el
   * tamaño del perro); si no la da, ese vertical no se reserva por citas.
   */
  async huecosDelDia(params: HuecosDelDiaParams): Promise<HuecosDelDiaRespuestaApi> {
    const servicio = await this.resolverServicio(params);
    const estrategia = this.availabilityRegistry.obtener(servicio.vertical);
    const perroSnapshot = params.perroId && params.usuarioId
      ? construirSnapshotPerro(await this.perrosService.obtenerPropio(params.perroId, params.usuarioId))
      : undefined;

    let resultado;
    try {
      resultado = await estrategia.checkAvailability(params.servicioId, {
        fechaInicio: fechaYHoraEnZona(params.fecha, '12:00'),
        cantidad: params.cantidad ?? 1,
        parametrosExtra: this.construirParametrosExtra(params.detalle, perroSnapshot),
      });
    } catch (error) {
      if (error instanceof DomainException && error.statusCode === 409) {
        return { soportado: true, estado: 'cerrado', motivo: error.message, huecos: [] };
      }
      throw error;
    }

    if (!resultado.disponible) {
      return { soportado: true, estado: 'cerrado', motivo: resultado.motivo, huecos: [] };
    }
    const momento = this.momentoDe(fechaYHoraEnZona(params.fecha, '12:00'), undefined, resultado.metadata, params.cantidad);
    if (!momento.duracionMin) return { soportado: false, estado: 'sin_horario', huecos: [] };

    const conCitas = this.servicioConCitas(params.servicioId, servicio, momento.duracionMin, resultado.metadata);
    return this.huecosService.huecosDelDia(conCitas, params.fecha);
  }

  /**
   * Días reservables de un servicio en un rango, para pintar el calendario.
   *
   * Sólo lo contestan los verticales que se reservan por rango de fechas. Para
   * el resto se responde `soportado: false` y el cliente se queda con los
   * campos de fecha de siempre, en vez de inventarse un calendario que no
   * significa nada en una peluquería que trabaja por huecos horarios.
   */
  async calendarioDisponibilidad(
    params: CalendarioDisponibilidadParams,
  ): Promise<CalendarioDisponibilidadRespuesta> {
    const { vertical } = await this.resolverServicio(params);
    const estrategia = this.availabilityRegistry.obtener(vertical);

    if (!implementaCalendario(estrategia)) {
      return { soportado: false, dias: [] };
    }

    if (params.hasta.getTime() < params.desde.getTime()) {
      throw new DomainException('El fin del rango no puede ser anterior al inicio', 400);
    }

    const dias = await estrategia.calendario(params.servicioId, {
      desde: params.desde,
      hasta: this.recortarRango(params.desde, params.hasta),
      espacioId: params.espacioId,
    });

    return { soportado: true, dias };
  }

  /**
   * Tope de días por consulta. El cliente pide de mes en mes; sin tope, una
   * petición con un rango de años recorrería la colección entera de reservas.
   */
  private recortarRango(desde: Date, hasta: Date): Date {
    const maximo = new Date(desde.getTime() + MAX_DIAS_CALENDARIO * 24 * 60 * 60 * 1000);
    return hasta.getTime() > maximo.getTime() ? maximo : hasta;
  }

  async crear(params: CrearReservaParams): Promise<ReservaDocument> {
    // El comercio y el vertical salen del servicio, nunca del cuerpo de la
    // petición: de ellos dependen la comisión y a quién se liquida el dinero.
    const servicio = await this.resolverServicio(params);
    const { comercioId, vertical } = servicio;
    // "El 20 a las 10:00": el día y la hora que eligió el cliente, en hora del
    // comercio. Los verticales de cita mandan el día y la hora por separado.
    const fechaInicio = this.inicioConHora(params.fechaInicio, params.detalle);

    // Validar la recurrencia antes de tocar disponibilidad: falla rápido, no deja holds huérfanos.
    const ocurrenciasRecurrentes = params.recurrencia
      ? this.calcularOcurrenciasRecurrentes(fechaInicio, params.recurrencia)
      : [];

    const perroSnapshot = params.perroId
      ? construirSnapshotPerro(await this.perrosService.obtenerPropio(params.perroId, params.usuarioId))
      : undefined;
    const perrosAdicionales = await this.mascotasAdicionales(params);

    // Un presupuesto aceptado fija el importe: la estrategia sólo comprueba que
    // el viaje sigue siendo posible, no le pone precio.
    const precioAcordado = params.presupuestoId
      ? await this.presupuestosService.importeParaReserva(params.presupuestoId, params.usuarioId, params.servicioId)
      : undefined;

    /*
     * Lo que el comercio ha cerrado a mano manda sobre cualquier cupo. Se mira
     * aquí, antes de la estrategia del vertical, porque es una regla común: los
     * verticales de cita sólo cuentan cupos y no saben nada de fechas, así que
     * repartir la comprobación entre los cinco la habría dejado a medias.
     *
     * Sólo corta el cierre **total**; los parciales restan inventario y los
     * resuelve el calendario de ocupación.
     */
    const cierre = await this.bloqueosService.cierreQueSolapa(
      params.servicioId, fechaInicio, params.fechaFin,
    );
    if (cierre) {
      throw new DomainException(`El comercio no atiende en esas fechas: ${cierre.motivo}`, 409);
    }

    const estrategia = this.availabilityRegistry.obtener(vertical);

    const disponibilidad = await estrategia.checkAvailability(params.servicioId, {
      fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
      parametrosExtra: {
        ...this.construirParametrosExtra(params.detalle, perroSnapshot),
        ...(precioAcordado !== undefined ? { precioAcordado } : {}),
      },
    });

    if (!disponibilidad.disponible) {
      throw new DomainException(
        disponibilidad.motivo ?? 'El servicio no está disponible para las fechas seleccionadas',
        409,
      );
    }

    const momento = this.momentoDe(fechaInicio, params.fechaFin, disponibilidad.metadata, params.cantidad);
    const horario = this.comprobarHorarioDeCita(servicio, momento);
    if (!horario.permitido) {
      throw new DomainException(horario.motivo ?? 'Esa hora está fuera del horario del comercio.', 409);
    }
    // Sin esto dos clientes podían coger la misma hora: los cupos son del día.
    if (!(await this.quedaPlazaParaLaCita(params.servicioId, servicio, momento, disponibilidad.metadata))) {
      throw new DomainException(MOTIVO_HORA_OCUPADA, 409);
    }

    const hold = await estrategia.reserveSlot(params.servicioId, {
      usuarioId: params.usuarioId,
      fechaInicio,
      fechaFin: momento.fin,
      cantidad: params.cantidad ?? 1,
    });

    /*
     * Los precios que declara el comercio **llevan el IVA incluido**: es lo que
     * el cliente ve en el buscador y lo que va a pagar, sin sorpresas al llegar
     * al último paso. La base imponible se obtiene dividiendo, no sumando.
     *
     * Una serie recurrente se cobra entera en la reserva origen: antes se
     * cobraba un solo viaje y el resto se confirmaba gratis al pagar.
     */
    const viajes = 1 + ocurrenciasRecurrentes.length;
    const precioUnitario = precioAcordado ?? disponibilidad.precioCalculado ?? 0;
    const precioBase = redondearEuros(precioUnitario * viajes);
    let montoTotal = precioBase;
    let descuentoMonto = 0;

    if (params.cuponCodigo) {
      const descuento = await this.cuponesService.validar(params.cuponCodigo, vertical, montoTotal);
      descuentoMonto = descuento.descuento;
      montoTotal = redondearEuros(montoTotal - descuentoMonto);
    }

    // Céntimos, no coma flotante: sin redondear se persistían importes como
    // 121.34000000000002. `PaymentsService` recalcula el desglose redondeando,
    // así que la reserva y lo que de verdad se cobra dejaban de cuadrar, y los
    // agregados del reporte financiero del admin sumaban ese ruido.
    montoTotal = redondearEuros(montoTotal);
    const montoSubtotal = redondearEuros(montoTotal / (1 + IVA_RATE));

    // La jerarquía de comisiones vive entera en el resolver: socio fundador →
    // override del comercio → tramo por importe → vertical → defecto.
    const comision = params.comisionPct != null
      ? { comisionPct: params.comisionPct, origen: 'override_comercio' as const }
      : await this.comisionResolver.resolver({
          vertical,
          montoSubtotal,
          comercioId,
        });

    // La comisión va sobre la base imponible, no sobre el total: el IVA no es
    // ingreso del comercio y cobrar comisión sobre él sería cobrar sobre un
    // dinero que va a Hacienda.
    const comisionPct = comision.comisionPct;
    const comisionMonto = redondearEuros(montoSubtotal * comisionPct);
    const detalle = this.detalleDeReserva(params.detalle, momento, disponibilidad.metadata, { viajes, precioUnitario });

    const reserva = new this.reservaModel({
      codigo: this.generarCodigo(),
      usuarioId: params.usuarioId,
      comercioId,
      servicioId: params.servicioId,
      vertical,
      perroId: params.perroId,
      perroSnapshot,
      perrosAdicionales,
      detalle,
      fechaInicio,
      fechaFin: momento.fin,
      cantidad: params.cantidad ?? 1,
      montoSubtotal,
      comisionMonto,
      comisionOrigen: comision.origen,
      montoTotal,
      descuentoMonto,
      cuponCodigo: params.cuponCodigo,
      estado: ReservaEstado.PENDIENTE,
      holdId: hold.holdId,
      presupuestoId: params.presupuestoId,
      aceptacion: this.aceptacionRequerida(disponibilidad.metadata),
      historialEstados: [{ estado: ReservaEstado.PENDIENTE, por: 'sistema', at: new Date() }],
    });

    const guardada = await reserva.save();

    if (ocurrenciasRecurrentes.length) {
      // Las hijas van a 0 €: el importe de toda la serie está en la origen, que
      // es la que se paga. Si llevasen importe, el GMV la contaría dos veces.
      await this.reservaModel.insertMany(
        ocurrenciasRecurrentes.map((fecha) => ({
          codigo: this.generarCodigo(),
          usuarioId: params.usuarioId,
          comercioId,
          servicioId: params.servicioId,
          vertical,
          perroId: params.perroId,
          perroSnapshot,
          perrosAdicionales,
          detalle: { ...detalle, cubiertaPorSerie: true },
          fechaInicio: fecha,
          // Cada sesión de la serie dura lo mismo que la primera.
          fechaFin: momento.fin ? new Date(fecha.getTime() + (momento.fin.getTime() - fechaInicio.getTime())) : undefined,
          cantidad: params.cantidad ?? 1,
          montoSubtotal: 0,
          comisionMonto: 0,
          montoTotal: 0,
          descuentoMonto: 0,
          estado: ReservaEstado.PENDIENTE,
          reservaOrigenId: guardada._id,
        })),
      );
    }

    return guardada;
  }

  /** Fichas congeladas de las demás mascotas del viaje; cada una tiene que ser del cliente. */
  private async mascotasAdicionales(params: CrearReservaParams): Promise<MascotaAdicional[] | undefined> {
    const ids = [...new Set(params.perroIdsAdicionales ?? [])].filter((id) => id !== params.perroId);
    if (!ids.length) return undefined;
    const perros = await Promise.all(ids.map((id) => this.perrosService.obtenerPropio(id, params.usuarioId)));
    return perros.map((perro) => ({ perroId: perro._id as Types.ObjectId, snapshot: construirSnapshotPerro(perro) }));
  }

  /** La estrategia dice si el comercio tiene que dar el visto bueno (viajes sin hora cerrada, urgencias). */
  private aceptacionRequerida(metadata: Record<string, unknown> | undefined): Reserva['aceptacion'] {
    if (metadata?.['requiereAceptacion'] !== true) return undefined;
    const plazoMin = Math.max(5, Number(metadata['plazoAceptacionMin']) || 60);
    return { requerida: true, estado: 'pendiente', plazoMin };
  }

  /**
   * Patrón simple de recurrencia (docs §4.3): NO revalida disponibilidad por ocurrencia
   * (no es un scheduler), solo genera reservas hija con los mismos datos que la
   * reserva origen, en cada día de la semana solicitado —o el mismo día de cada
   * mes— hasta `fechaFin`.
   *
   * Días, día de la semana y hora se cuentan en el calendario del comercio. El
   * cálculo vive en `shared` (`ocurrenciasDeSerie`) para que la web diga cuántos
   * viajes son antes de pagar con exactamente la misma cuenta.
   */
  private calcularOcurrenciasRecurrentes(fechaInicio: Date, recurrencia: RecurrenciaParams): Date[] {
    if (recurrencia.fechaFin.getTime() <= fechaInicio.getTime()) {
      throw new DomainException('La fecha de fin de la recurrencia debe ser posterior a la fecha de inicio', 400);
    }

    const dias = ocurrenciasDeSerie(claveDiaEnZona(fechaInicio), {
      diasSemana: recurrencia.diasSemana,
      fechaFin: claveDiaEnZona(recurrencia.fechaFin),
      mensual: recurrencia.mensual,
    });
    if (dias.length > MAX_OCURRENCIAS_RECURRENCIA) {
      throw new DomainException(
        `La recurrencia generaría más de ${MAX_OCURRENCIAS_RECURRENCIA} reservas; acorta la fecha de fin`,
        400,
      );
    }

    const hora = esHoraValida(recurrencia.hora) ? recurrencia.hora : horaEnZona(fechaInicio);
    return dias.map((dia) => fechaYHoraEnZona(dia, hora));
  }

  /**
   * Día + hora de la cita como un único instante en hora del comercio.
   *
   * Veterinaria y peluquería mandan `fechaInicio: "2026-09-20"` y la hora en
   * `detalle.hora`. Guardarlo tal cual dejaba la cita a medianoche UTC (las 02:00
   * en Madrid) y la agenda no podía situarla a su hora.
   */
  private inicioConHora(fechaInicio: Date, detalle?: Record<string, unknown>): Date {
    const hora = detalle?.['hora'];
    if (!esHoraValida(hora) || !esMedianocheUtc(fechaInicio)) return fechaInicio;
    return fechaYHoraEnZona(fechaInicio.toISOString().slice(0, 10), hora);
  }

  /**
   * Inicio, fin y duración de lo reservado. Si la estrategia del vertical dice
   * cuánto dura (`metadata.duracionMin`), es una cita: sin fin declarado se
   * calcula, porque sin él la agenda la pintaba ocupando el día entero.
   */
  private momentoDe(
    inicio: Date,
    fechaFin: Date | undefined,
    metadata: Record<string, unknown> | undefined,
    cantidad?: number,
  ): MomentoReserva {
    const duracion = Number(metadata?.['duracionMin']);
    const esCita = Number.isFinite(duracion) && duracion > 0 && !esMedianocheUtc(inicio);
    if (!esCita) return { inicio, fin: fechaFin, esCita: false };

    // Una cita por mascota, una detrás de otra: dos perros son dos consultas.
    const mascotas = Math.max(1, Number(metadata?.['perros']) || cantidad || 1);
    const duracionMin = duracion * mascotas;
    return {
      inicio,
      fin: fechaFin ?? new Date(inicio.getTime() + duracionMin * MS_POR_MINUTO),
      esCita: true,
      duracionMin,
    };
  }

  /**
   * Una cita tiene que caer dentro del horario del servicio. Hasta ahora el
   * horario sólo se enseñaba: se podía reservar a las 03:00 o en domingo en una
   * clínica cerrada. No aplica a estancias ni a lo que no tiene duración.
   */
  private comprobarHorarioDeCita(servicio: ServicioResuelto, momento: MomentoReserva): { permitido: boolean; motivo?: string } {
    if (!momento.esCita || !momento.fin) return { permitido: true };
    return comprobarHorario(servicio.horario, servicio.excepcionesHorario, momento.inicio, momento.fin);
  }

  private async quedaPlazaParaLaCita(
    servicioId: string,
    servicio: ServicioResuelto,
    momento: MomentoReserva,
    metadata: Record<string, unknown> | undefined,
  ): Promise<boolean> {
    if (!momento.esCita || !momento.fin || !momento.duracionMin) return true;
    const conCitas = this.servicioConCitas(servicioId, servicio, momento.duracionMin, metadata);
    return this.huecosService.hayPlaza(conCitas, momento.inicio, momento.fin);
  }

  private servicioConCitas(
    servicioId: string,
    servicio: ServicioResuelto,
    duracionMin: number,
    metadata: Record<string, unknown> | undefined,
  ): ServicioConCitas {
    return {
      servicioId,
      comercioId: servicio.comercioId,
      horario: servicio.horario,
      excepcionesHorario: servicio.excepcionesHorario,
      duracionMin,
      capacidad: Math.max(1, Number(metadata?.['capacidadSimultanea']) || 1),
    };
  }

  /**
   * Lo que se guarda en `reserva.detalle`: lo que mandó el cliente, la duración
   * de la cita si la hay, lo que la estrategia quiera dejar anotado
   * (`metadata.detalleReserva`: el desglose del precio, la ruta…) y, en una
   * serie, cuántos viajes cubre y a cuánto sale cada uno.
   */
  private detalleDeReserva(
    detalle: Record<string, unknown> | undefined,
    momento: MomentoReserva,
    metadata: Record<string, unknown> | undefined,
    serie: { viajes: number; precioUnitario: number },
  ): Record<string, unknown> {
    const resultado: Record<string, unknown> = { ...(detalle ?? {}) };
    if (momento.duracionMin) resultado['duracionMin'] = momento.duracionMin;
    const anotado = metadata?.['detalleReserva'];
    if (anotado && typeof anotado === 'object') Object.assign(resultado, anotado);
    if (serie.viajes > 1) Object.assign(resultado, { viajes: serie.viajes, precioPorViaje: serie.precioUnitario });
    return resultado;
  }

  async confirmar(reservaId: string): Promise<ReservaDocument> {
    // Idempotencia: el webhook de Stripe puede reintentar, y en un viaje el
    // reintento vuelve a recorrer reservas que ya se confirmaron en el intento
    // anterior. Sin esta salida temprana se volvería a contar el uso del cupón.
    const yaProcesada = await this.reservaModel.findById(reservaId).exec();
    if (!yaProcesada) {
      throw new DomainException('Reserva no encontrada', 404);
    }
    if (yaProcesada.estado !== ReservaEstado.PENDIENTE) {
      return yaProcesada;
    }

    // Revalidación anti-doble-reserva (DK-A04): entre tomar el SlotHold y
    // cobrar pueden pasar más de sus 15 minutos de vida. Si el hold caducó y la
    // plaza ya no está, confirmar sin más sería vender dos veces lo mismo.
    const incidencia = await this.revalidarAntesDeConfirmar(reservaId);

    const reserva = await this.reservaModel.findByIdAndUpdate(
      reservaId,
      {
        estado: incidencia ? ReservaEstado.EN_DISPUTA : ReservaEstado.CONFIRMADA,
        holdId: undefined,
        $push: {
          historialEstados: {
            estado: incidencia ? ReservaEstado.EN_DISPUTA : ReservaEstado.CONFIRMADA,
            por: 'pago',
            at: new Date(),
            ...(incidencia ? { motivo: incidencia } : {}),
          },
        },
      },
      { new: true },
    ).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (incidencia) {
      // El cliente ya pagó: no se le deja sin nada en silencio. La reserva entra
      // en disputa para que el admin la resuelva (reubicar o reembolsar).
      this.logger.error(`Reserva ${reservaId} pagada sin plaza disponible: ${incidencia}`);
      return reserva;
    }

    // El uso del cupón se contabiliza al confirmar la reserva (pago aprobado).
    if (reserva.cuponCodigo) {
      await this.cuponesService.aplicar(reserva.cuponCodigo);
    }

    // La serie recurrente comparte un único pago con la reserva origen: al confirmarse
    // esta, se confirman también todas sus reservas hija (docs §4.3).
    await this.reservaModel.updateMany(
      { reservaOrigenId: reserva._id, estado: ReservaEstado.PENDIENTE },
      { estado: ReservaEstado.CONFIRMADA },
    ).exec();

    await this.trasConfirmar(reserva);
    return reserva;
  }

  /**
   * Comprueba que la plaza sigue siendo del cliente justo antes de confirmar.
   *
   * Si el `SlotHold` sigue vivo no hay nada que revisar: la plaza está retenida.
   * Si caducó, se vuelve a pedir; solo si tampoco eso funciona hay incidencia.
   * Devuelve el motivo si la reserva no puede honrarse, o `null` si todo bien.
   */
  private async revalidarAntesDeConfirmar(reservaId: string): Promise<string | null> {
    const reserva = await this.reservaModel.findById(reservaId).lean().exec();
    if (!reserva) return null;

    // Hold vigente: la plaza está retenida, no hace falta comprobar nada.
    if (reserva.holdId) return null;

    try {
      const estrategia = this.availabilityRegistry.obtener(reserva.vertical);
      const disponibilidad = await estrategia.checkAvailability(reserva.servicioId.toString(), {
        fechaInicio: reserva.fechaInicio,
        fechaFin: reserva.fechaFin,
        cantidad: reserva.cantidad ?? 1,
        parametrosExtra: reserva.detalle,
      });

      return disponibilidad.disponible
        ? null
        : 'La retención de plaza caducó durante el pago y el servicio ya no tiene disponibilidad.';
    } catch (error) {
      // Un fallo al comprobar no debe impedir confirmar una reserva ya pagada.
      this.logger.warn(`No se pudo revalidar la reserva ${reservaId}: ${error}`);
      return null;
    }
  }

  /**
   * Lo que pasa al cobrarse una reserva además de confirmarla: si venía de un
   * presupuesto, la solicitud queda convertida; si el comercio tiene que
   * aceptarla, arranca su plazo y se le avisa.
   */
  private async trasConfirmar(reserva: ReservaDocument): Promise<void> {
    if (reserva.presupuestoId) {
      await this.presupuestosService.marcarConvertida(
        reserva.presupuestoId.toString(), reserva.servicioId.toString(), reserva._id.toString(),
      );
    }
    const aceptacion = reserva.aceptacion;
    if (aceptacion?.requerida && aceptacion.estado === 'pendiente' && !aceptacion.venceEn) {
      reserva.aceptacion = { ...aceptacion, venceEn: new Date(Date.now() + aceptacion.plazoMin * MS_POR_MINUTO) };
      reserva.markModified('aceptacion');
      await reserva.save();
      void this.notificationsService.notificarPendienteAceptacion(reserva._id.toString());
    }
  }

  /** El comercio acepta un viaje pagado que necesitaba su visto bueno; puede fijar la hora real. */
  async aceptarViaje(reservaId: string, comercioId: string, horaConfirmada?: string): Promise<ReservaDocument> {
    const reserva = await this.pendienteDeAceptar(reservaId, comercioId);
    const ahora = new Date();
    if (horaConfirmada && esHoraValida(horaConfirmada)) {
      reserva.fechaInicio = fechaYHoraEnZona(claveDiaEnZona(reserva.fechaInicio), horaConfirmada);
    }
    reserva.aceptacion = {
      requerida: true, plazoMin: reserva.aceptacion?.plazoMin ?? 0, ...reserva.aceptacion,
      estado: 'aceptada', resueltaAt: ahora,
    };
    reserva.markModified('aceptacion');
    reserva.historialEstados.push({ estado: reserva.estado, motivo: 'Aceptada por el comercio', por: `comercio:${comercioId}`, at: ahora });
    const guardada = await reserva.save();
    void this.notificationsService.notificarAceptacion(reservaId, true);
    return guardada;
  }

  /** Comprueba que el comercio puede rechazar el viaje; el reembolso lo hace `PaymentsService`. */
  async pendienteDeAceptar(reservaId: string, comercioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();
    if (!reserva) throw new DomainException('Reserva no encontrada', 404);
    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }
    if (reserva.aceptacion?.estado !== 'pendiente' || reserva.estado !== ReservaEstado.CONFIRMADA) {
      throw new DomainException('Esta reserva no está pendiente de aceptar.', 400);
    }
    return reserva;
  }

  /** Viajes pagados cuyo plazo de aceptación venció sin respuesta del comercio. */
  async aceptacionesVencidas(limite = 100): Promise<ReservaDocument[]> {
    return this.reservaModel
      .find({
        estado: ReservaEstado.CONFIRMADA,
        'aceptacion.estado': 'pendiente',
        'aceptacion.venceEn': { $lt: new Date() },
      })
      .limit(limite)
      .exec();
  }

  /** Qué se devolvería al cancelar ahora, según la política del vertical. */
  async politicaCancelacion(reserva: ReservaDocument): Promise<PoliticaReembolso> {
    const estrategia = this.availabilityRegistry.obtener(reserva.vertical);
    if (!implementaCancelacion(estrategia)) {
      return { porcentaje: 0, motivo: 'Esta categoría no tiene reembolso automático: el comercio revisará tu caso.' };
    }
    return estrategia.politicaReembolso({
      servicioId: reserva.servicioId.toString(),
      estado: reserva.estado,
      fechaInicio: reserva.fechaInicio,
      detalle: reserva.detalle,
      seguimiento: reserva.seguimiento,
    });
  }

  /** La reserva del cliente, si todavía se puede cancelar. */
  async cancelablePorCliente(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.obtenerDeUsuario(reservaId, usuarioId);
    if (![ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA].includes(reserva.estado)) {
      throw new DomainException('Esta reserva ya no se puede cancelar desde aquí.', 400);
    }
    return reserva;
  }

  /**
   * Deja la reserva cancelada con lo que se devolvió, libera la plaza y cancela
   * los viajes que quedaban de su serie (van pagados dentro de ella).
   */
  async marcarCancelada(
    reserva: ReservaDocument,
    params: { por: string; motivo: string; reembolso?: { porcentaje: number; importe: number }; aceptacion?: 'rechazada' | 'caducada' },
  ): Promise<ReservaDocument> {
    const ahora = new Date();
    if (reserva.holdId) {
      await this.availabilityRegistry.obtener(reserva.vertical).releaseSlot(reserva.holdId);
      reserva.holdId = undefined;
    }
    reserva.estado = ReservaEstado.CANCELADA;
    reserva.historialEstados.push({ estado: ReservaEstado.CANCELADA, motivo: params.motivo, por: params.por, at: ahora });
    if (params.reembolso) {
      reserva.reembolso = { ...params.reembolso, motivo: params.motivo, at: ahora };
    }
    if (params.aceptacion && reserva.aceptacion) {
      reserva.aceptacion = { ...reserva.aceptacion, estado: params.aceptacion, resueltaAt: ahora, motivo: params.motivo };
      reserva.markModified('aceptacion');
    }
    const guardada = await reserva.save();
    await this.cancelarSerie(guardada._id);
    return guardada;
  }

  private async cancelarSerie(reservaOrigenId: Types.ObjectId): Promise<void> {
    await this.reservaModel.updateMany(
      { reservaOrigenId, estado: { $in: [ReservaEstado.PENDIENTE, ReservaEstado.CONFIRMADA] } },
      { estado: ReservaEstado.CANCELADA },
    ).exec();
  }

  async cancelar(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para cancelar esta reserva', 403);
    }

    if (reserva.estado === ReservaEstado.CANCELADA) {
      throw new DomainException('La reserva ya está cancelada', 400);
    }

    if (reserva.holdId) {
      const estrategia = this.availabilityRegistry.obtener(reserva.vertical);
      await estrategia.releaseSlot(reserva.holdId);
    }

    reserva.estado = ReservaEstado.CANCELADA;
    const guardada = await reserva.save();
    await this.cancelarSerie(guardada._id);
    return guardada;
  }

  /** El comercio marca como prestado un servicio ya confirmado. */
  async completar(reservaId: string, comercioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }

    if (reserva.estado !== ReservaEstado.CONFIRMADA) {
      throw new DomainException('Solo se pueden completar reservas confirmadas', 400);
    }

    reserva.estado = ReservaEstado.COMPLETADA;
    reserva.historialEstados.push({ estado: ReservaEstado.COMPLETADA, por: `comercio:${comercioId}`, at: new Date() });
    const guardada = await reserva.save();

    // Dispara la solicitud automática de reseña en la siguiente tanda (HU-053).
    void this.eventosService.registrar({
      tipo: TipoEvento.SERVICIO_COMPLETADO,
      usuarioId: reserva.usuarioId.toString(),
      reservaId: reserva._id.toString(),
      servicioId: reserva.servicioId.toString(),
      vertical: reserva.vertical,
    });

    return guardada;
  }

  /**
   * El comercio marca un hito de seguimiento en tiempo real (transportista
   * asignado, recogida, entrega…). El cliente lo recibe por correo y push y lo
   * ve en su reserva. El primer hito pone la reserva EN_CURSO; `finalizada` la
   * marca COMPLETADA. Qué hitos existen y cuáles exigen foto lo dice el vertical.
   */
  async agregarSeguimiento(
    reservaId: string,
    comercioId: string,
    hito: string,
    nota?: string,
    fotoUrl?: string,
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();
    if (!reserva) throw new DomainException('Reserva no encontrada', 404);
    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }
    if (!ESTADOS_EN_SERVICIO.includes(reserva.estado)) {
      throw new DomainException('Sólo se puede seguir una reserva confirmada o en curso.', 400);
    }
    if (reserva.aceptacion?.estado === 'pendiente') {
      throw new DomainException('Acepta el viaje antes de marcar su seguimiento.', 409);
    }

    const estrategia = this.availabilityRegistry.obtener(reserva.vertical);
    if (implementaSeguimiento(estrategia)) {
      estrategia.validarHito({
        servicioId: reserva.servicioId.toString(), estado: reserva.estado, fechaInicio: reserva.fechaInicio,
        detalle: reserva.detalle, seguimiento: reserva.seguimiento,
      }, hito, fotoUrl);
    }

    const ahora = new Date();
    reserva.seguimiento.push({ hito, nota, fotoUrl, at: ahora });
    if (fotoUrl) reserva.evidencias.push({ tipo: `hito_${hito}`, url: fotoUrl, createdAt: ahora });

    if (hito === 'finalizada') {
      reserva.estado = ReservaEstado.COMPLETADA;
      reserva.historialEstados.push({ estado: ReservaEstado.COMPLETADA, por: `comercio:${comercioId}`, at: ahora });
    } else if (reserva.estado === ReservaEstado.CONFIRMADA) {
      reserva.estado = ReservaEstado.EN_CURSO;
      reserva.historialEstados.push({ estado: ReservaEstado.EN_CURSO, por: `comercio:${comercioId}`, at: ahora });
    }

    const guardada = await reserva.save();
    void this.notificationsService.notificarHitoViaje(reservaId, hito, nota, fotoUrl);
    return guardada;
  }

  /** El comercio propone suplementos en recepción; la reserva queda pendiente de aprobación del cliente. */
  async solicitarAjuste(
    reservaId: string,
    comercioId: string,
    suplementos: SuplementoSolicitado[],
    evidenciaUrl?: string,
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }

    if (reserva.estado !== ReservaEstado.CONFIRMADA) {
      throw new DomainException('Solo se puede solicitar un ajuste sobre una reserva confirmada', 400);
    }

    // Veterinaria factura pruebas/tratamientos extra directamente con el cliente, fuera de la
    // plataforma (docs/mejora_servicios.md §5); Doogking nunca comisiona esa parte.
    if (reserva.vertical === VerticalKey.VETERINARIA) {
      throw new DomainException(
        'En veterinaria, las pruebas y tratamientos adicionales se presupuestan y facturan directamente con la clínica, fuera de Doogking.',
        400,
      );
    }

    if (!suplementos.length) {
      throw new DomainException('Indica al menos un suplemento', 400);
    }

    const ahora = new Date();
    const nuevos: SuplementoAplicado[] = suplementos.map((s) => ({
      ...s,
      aplicadoPor: comercioId,
      evidenciaUrl,
      createdAt: ahora,
    }));

    // Los suplementos los declara el comercio con el IVA incluido, igual que el
    // resto de precios: se suman al total, no a la base. Grosarlos otra vez
    // habría cobrado el impuesto dos veces sobre esa parte.
    const sumaSuplementos = suplementos.reduce((acc, s) => acc + s.monto, 0);
    const montoAjustado = redondearEuros(reserva.montoTotal + sumaSuplementos);

    reserva.suplementos.push(...nuevos);
    if (evidenciaUrl) {
      reserva.evidencias.push({ tipo: 'estado_llegada', url: evidenciaUrl, createdAt: ahora });
    }
    reserva.montoAjustado = montoAjustado;
    reserva.estado = ReservaEstado.AJUSTE_SOLICITADO;
    reserva.ajusteSolicitadoAt = ahora;

    const guardada = await reserva.save();

    // Sin `await`: el ajuste ya está registrado y el comercio no debe esperar al
    // correo. `notificarAjusteSolicitado` no lanza nunca.
    void this.notificationsService.notificarAjusteSolicitado(guardada._id.toString());

    return guardada;
  }

  /** Valida que el ajuste pertenezca al cliente y esté pendiente (lo usa PaymentsService antes de cobrar). */
  async validarAjustePendiente(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.obtenerDeUsuario(reservaId, usuarioId);

    if (reserva.estado !== ReservaEstado.AJUSTE_SOLICITADO) {
      throw new DomainException('No hay ningún ajuste pendiente de aprobar en esta reserva', 400);
    }

    return reserva;
  }

  /** Se llama al confirmarse el pago de la diferencia (webhook), nunca directamente desde el cliente. */
  async confirmarAjuste(reservaId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    // Idempotencia: si el webhook llega duplicado ya no hay ajuste pendiente.
    if (reserva.estado !== ReservaEstado.AJUSTE_SOLICITADO || reserva.montoAjustado === undefined) {
      return reserva;
    }

    const comisionPctEfectivo = reserva.montoSubtotal > 0 ? reserva.comisionMonto / reserva.montoSubtotal : COMISION_PCT_DEFAULT;
    const nuevoMontoSubtotal = redondearEuros(reserva.montoAjustado / (1 + IVA_RATE));

    reserva.montoSubtotal = nuevoMontoSubtotal;
    reserva.comisionMonto = redondearEuros(nuevoMontoSubtotal * comisionPctEfectivo);
    reserva.montoTotal = reserva.montoAjustado;
    reserva.montoAjustado = undefined;
    reserva.estado = ReservaEstado.CONFIRMADA;
    reserva.ajusteResueltoAt = new Date();

    return reserva.save();
  }

  /** El cliente rechaza el ajuste: se cancela la reserva (el reembolso lo dispara PaymentsService). */
  async rechazarAjuste(reservaId: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.validarAjustePendiente(reservaId, usuarioId);

    reserva.estado = ReservaEstado.CANCELADA;
    reserva.montoAjustado = undefined;
    reserva.ajusteResueltoAt = new Date();

    return reserva.save();
  }

  async obtenerPorId(id: string): Promise<ReservaDocument | null> {
    return this.reservaModel.findById(id).exec();
  }

  async obtenerPorCodigo(codigo: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findOne({ codigo }).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para ver esta reserva', 403);
    }

    return reserva;
  }

  async obtenerDeUsuario(id: string, usuarioId: string): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(id).exec();

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para ver esta reserva', 403);
    }

    return reserva;
  }

  /**
   * Todas las reservas de un mismo viaje (HU-037): la madre y las vinculadas a
   * ella, en orden cronológico. Cada una conserva su estado propio, así que la
   * vista puede mostrar un viaje con el hotel confirmado y la peluquería
   * cancelada sin que eso sea una inconsistencia.
   */
  async listarViaje(reservaMadreId: string, usuarioId: string): Promise<ReservaDocument[]> {
    const madre = await this.obtenerDeUsuario(reservaMadreId, usuarioId);

    const vinculadas = await this.reservaModel
      .find({ reservaMadreId: madre._id, usuarioId: new Types.ObjectId(usuarioId) })
      .sort({ fechaInicio: 1 })
      .exec();

    return [madre, ...vinculadas].sort(
      (a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime(),
    );
  }

  async listarPorUsuario(usuarioId: string): Promise<ReservaDocument[]> {
    return this.reservaModel
      .find({ usuarioId })
      .sort({ createdAt: -1 })
      .exec()
      .then((reservas) => reservas.map(conHoraReal)) as Promise<ReservaDocument[]>;
  }

  /** Próxima reserva confirmada del usuario (HU-7.3), o null si no tiene ninguna por delante. */
  async proxima(usuarioId: string): Promise<{
    codigo: string;
    titulo: string;
    imagen: string;
    ciudad: string;
    fechaInicio: Date;
    vertical: string;
  } | null> {
    const reserva = await this.reservaModel
      .findOne({ usuarioId, estado: ReservaEstado.CONFIRMADA, fechaInicio: { $gt: new Date() } })
      .sort({ fechaInicio: 1 })
      .populate('servicioId', 'titulo imagenes')
      .populate('comercioId', 'nombreComercial direccion')
      .lean()
      .exec() as unknown as {
        codigo: string;
        fechaInicio: Date;
        vertical: string;
        servicioId?: { titulo?: string; imagenes?: string[] };
        comercioId?: { nombreComercial?: string; direccion?: { ciudad?: string } };
      } | null;

    if (!reserva) return null;
    return {
      codigo: reserva.codigo,
      titulo: reserva.servicioId?.titulo ?? reserva.comercioId?.nombreComercial ?? 'Tu reserva',
      imagen: reserva.servicioId?.imagenes?.[0] ?? '',
      ciudad: reserva.comercioId?.direccion?.ciudad ?? '',
      fechaInicio: reserva.fechaInicio,
      vertical: reserva.vertical,
    };
  }

  /**
   * Recordatorios de cuidado basados en el historial real del usuario: si hace
   * demasiado tiempo desde el último servicio de un tipo (peluquería, veterinario,
   * adiestramiento), se sugiere volver a reservar. Genera recurrencia/fidelización.
   */
  async recordatorios(usuarioId: string): Promise<Array<{
    vertical: string;
    icono: string;
    mensaje: string;
    mesesDesde: number;
    ruta: string;
  }>> {
    const reservas = await this.reservaModel
      .find({ usuarioId, estado: { $in: [ReservaEstado.COMPLETADA, ReservaEstado.CONFIRMADA] } })
      .select('vertical fechaInicio')
      .sort({ fechaInicio: -1 })
      .lean()
      .exec() as unknown as Array<{ vertical: string; fechaInicio: Date }>;

    const ultimaPorVertical = new Map<string, Date>();
    for (const r of reservas) {
      if (!ultimaPorVertical.has(r.vertical)) ultimaPorVertical.set(r.vertical, new Date(r.fechaInicio));
    }

    const ahora = new Date();
    const reglas: Array<{ vertical: VerticalKey; umbralMeses: number; icono: string; plantilla: (m: number) => string }> = [
      { vertical: VerticalKey.PELUQUERIA, umbralMeses: 2, icono: '✂️', plantilla: (m) => `Han pasado ${m} meses desde la última peluquería de tu perro` },
      { vertical: VerticalKey.VETERINARIA, umbralMeses: 12, icono: '🩺', plantilla: (m) => `Hace ${m} meses de la última visita al veterinario` },
      { vertical: VerticalKey.ADIESTRAMIENTO, umbralMeses: 6, icono: '🎓', plantilla: (m) => `Hace ${m} meses de la última sesión de adiestramiento` },
    ];

    const recordatorios = [];
    for (const regla of reglas) {
      const ultima = ultimaPorVertical.get(regla.vertical);
      if (!ultima) continue;
      const meses = (ahora.getFullYear() - ultima.getFullYear()) * 12 + (ahora.getMonth() - ultima.getMonth());
      if (meses >= regla.umbralMeses) {
        recordatorios.push({
          vertical: regla.vertical,
          icono: regla.icono,
          mensaje: regla.plantilla(meses),
          mesesDesde: meses,
          ruta: `/${regla.vertical}`,
        });
      }
    }
    return recordatorios;
  }

  /**
   * Programa de fidelización "Puntos Doogking": 1 punto por cada € gastado en
   * reservas completadas o confirmadas. Cada 400 puntos se desbloquea un
   * descuento de 5 €. Devuelve el progreso hacia la próxima recompensa.
   */
  async obtenerPuntos(usuarioId: string): Promise<{
    puntos: number;
    proximoUmbral: number;
    puntosFaltantes: number;
    valorProximoDescuento: number;
  }> {
    const UMBRAL = 400;
    const VALOR_DESCUENTO = 5;

    const agg = await this.reservaModel.aggregate<{ total: number }>([
      { $match: { usuarioId: new Types.ObjectId(usuarioId), estado: { $in: [ReservaEstado.COMPLETADA, ReservaEstado.CONFIRMADA] } } },
      { $group: { _id: null, total: { $sum: '$montoTotal' } } },
    ]).exec();

    const puntos = Math.floor(agg[0]?.total ?? 0);
    const proximoUmbral = (Math.floor(puntos / UMBRAL) + 1) * UMBRAL;
    return {
      puntos,
      proximoUmbral,
      puntosFaltantes: proximoUmbral - puntos,
      valorProximoDescuento: VALOR_DESCUENTO,
    };
  }

  private generarCodigo(): string {
    return `RES-${nanoid(8).toUpperCase()}`;
  }

  /**
   * Enriquece los parámetros de disponibilidad con datos ya conocidos de la
   * Ficha del Perro (perroSnapshot), sin que el cliente tenga que volver a
   * indicarlos manualmente. Se añaden como claves nuevas (`perroTamano`,
   * `perroTipoPelo`, `perroPeso`, `perroEspecie`, `perroEsPPP`, `perroRaza`)
   * para no pisar campos que algún vertical ya reciba explícitamente en
   * `detalle` (ej. `tamanoPerro` de alojamiento).
   */
  /**
   * Resuelve a qué comercio y a qué vertical pertenece de verdad el servicio.
   *
   * Antes ambos llegaban en el cuerpo de la petición y no se contrastaban nunca
   * con el servicio. De ellos dependen dos cosas que son dinero: la comisión que
   * cobra la plataforma (`ComisionResolverService` la resuelve por vertical y
   * por comercio) y a quién se le liquida la reserva. Un cliente podía, por
   * tanto, apuntar a un vertical o a un comercio con comisión más baja, o
   * atribuir la reserva a un negocio que no era el que presta el servicio.
   */
  /** Sólo necesita identificar el servicio; lo demás de la petición no le hace falta. */
  private async resolverServicio(
    params: Pick<CrearReservaParams, 'servicioId' | 'comercioId' | 'vertical'>,
  ): Promise<ServicioResuelto> {
    const servicio = await this.catalogRepository.obtenerPorId(params.servicioId);

    if (!servicio) {
      throw new DomainException('El servicio que intentas reservar no existe', 404);
    }

    const comercioId = servicio.comercioId?.toString();
    if (!comercioId) {
      throw new DomainException('El servicio no tiene comercio asociado y no puede reservarse', 409);
    }

    // El buscador ya filtra por estas dos condiciones, pero una ficha guardada
    // en favoritos o un enlace compartido llegan aquí directamente: sin esta
    // comprobación se podía reservar en un comercio pausado o dado de baja.
    if (servicio.estado !== 'publicado' || servicio.comercioActivo === false) {
      throw new DomainException('Este servicio ya no acepta reservas', 409);
    }

    const vertical = servicio.vertical as VerticalKey;

    // Discrepancia = la petición viene de un cliente desactualizado o manipulado.
    // Se rechaza en vez de corregir en silencio, para que el fallo se vea.
    if (params.comercioId && params.comercioId !== comercioId) {
      this.logger.warn(
        `Reserva rechazada: el cliente declaró comercio ${params.comercioId} y el servicio ${params.servicioId} es de ${comercioId}.`,
      );
      throw new DomainException('Los datos del servicio no coinciden. Vuelve a cargar la ficha.', 409);
    }

    if (params.vertical && params.vertical !== vertical) {
      this.logger.warn(
        `Reserva rechazada: el cliente declaró vertical ${params.vertical} y el servicio ${params.servicioId} es de ${vertical}.`,
      );
      throw new DomainException('Los datos del servicio no coinciden. Vuelve a cargar la ficha.', 409);
    }

    const conHorario = servicio as unknown as { horario?: HorarioDiaDto[]; excepcionesHorario?: ExcepcionHorarioDto[] };
    return { comercioId, vertical, horario: conHorario.horario, excepcionesHorario: conHorario.excepcionesHorario };
  }

  private construirParametrosExtra(
    detalle: Record<string, unknown> | undefined,
    perroSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!perroSnapshot) return detalle;
    return {
      ...detalle,
      perroTamano: perroSnapshot['tamano'],
      perroTipoPelo: perroSnapshot['tipoPelo'],
      perroPeso: perroSnapshot['peso'],
      perroEspecie: perroSnapshot['especie'],
      perroEsPPP: perroSnapshot['esPPP'],
      perroRaza: perroSnapshot['raza'],
      // Conductas de riesgo (Ref. RES5): permiten a AlojamientoAvailabilityStrategy
      // bloquear la reserva si la residencia no las admite.
      perroAnsiedadSeparacion: perroSnapshot['ansiedadSeparacion'],
      perroProtectorRecursos: perroSnapshot['protectorRecursos'],
      perroReactividadCorrea: perroSnapshot['reactividadCorrea'],
      perroDestructivoEnSoledad: perroSnapshot['destructivoEnSoledad'],
      perroTendenciaEscapar: perroSnapshot['tendenciaEscapar'],
    };
  }
}
