import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reserva, ReservaDocument, SuplementoAplicado } from './reserva.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { CuponesService } from '../cupones/cupones.service';
import { PerrosService } from '../perros/perros.service';
import { construirSnapshotPerro } from '../perros/perro-snapshot.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ComisionResolverService } from '../comision-configs/comision-resolver.service';
import { EventosService } from '../eventos/eventos.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { VerticalKey, ReservaEstado, IVA_RATE, COMISION_PCT_DEFAULT, TipoEvento } from 'shared';
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
}

export interface CrearReservaParams {
  usuarioId: string;
  comercioId: string;
  servicioId: string;
  vertical: VerticalKey;
  perroId?: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad?: number;
  detalle?: Record<string, unknown>;
  comisionPct?: number;
  cuponCodigo?: string;
  recurrencia?: RecurrenciaParams;
}

const MAX_OCURRENCIAS_RECURRENCIA = 52;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    private readonly availabilityRegistry: AvailabilityRegistry,
    private readonly cuponesService: CuponesService,
    private readonly perrosService: PerrosService,
    private readonly notificationsService: NotificationsService,
    private readonly comisionResolver: ComisionResolverService,
    private readonly eventosService: EventosService,
  ) {}

  async crear(params: CrearReservaParams): Promise<ReservaDocument> {
    // Validar la recurrencia antes de tocar disponibilidad: falla rápido, no deja holds huérfanos.
    const ocurrenciasRecurrentes = params.recurrencia
      ? this.calcularOcurrenciasRecurrentes(params.fechaInicio, params.recurrencia)
      : [];

    const perroSnapshot = params.perroId
      ? construirSnapshotPerro(await this.perrosService.obtenerPropio(params.perroId, params.usuarioId))
      : undefined;

    const estrategia = this.availabilityRegistry.obtener(params.vertical);

    const disponibilidad = await estrategia.checkAvailability(params.servicioId, {
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
      parametrosExtra: this.construirParametrosExtra(params.detalle, perroSnapshot),
    });

    if (!disponibilidad.disponible) {
      throw new DomainException('El servicio no está disponible para las fechas seleccionadas', 409);
    }

    const hold = await estrategia.reserveSlot(params.servicioId, {
      usuarioId: params.usuarioId,
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
    });

    const precioBase = disponibilidad.precioCalculado ?? 0;
    let montoSubtotal = precioBase;
    let descuentoMonto = 0;

    if (params.cuponCodigo) {
      const descuento = await this.cuponesService.validar(params.cuponCodigo, params.vertical, montoSubtotal);
      descuentoMonto = descuento.descuento;
      montoSubtotal = Math.round((montoSubtotal - descuentoMonto) * 100) / 100;
    }

    // La jerarquía de comisiones vive entera en el resolver: socio fundador →
    // override del comercio → tramo por importe → vertical → defecto.
    const comision = params.comisionPct != null
      ? { comisionPct: params.comisionPct, origen: 'override_comercio' as const }
      : await this.comisionResolver.resolver({
          vertical: params.vertical,
          montoSubtotal,
          comercioId: params.comercioId,
        });

    const comisionPct = comision.comisionPct;
    const comisionMonto = montoSubtotal * comisionPct;
    const iva = montoSubtotal * IVA_RATE;
    const montoTotal = montoSubtotal + iva;

    const reserva = new this.reservaModel({
      codigo: this.generarCodigo(),
      usuarioId: params.usuarioId,
      comercioId: params.comercioId,
      servicioId: params.servicioId,
      vertical: params.vertical,
      perroId: params.perroId,
      perroSnapshot,
      detalle: params.detalle ?? {},
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad ?? 1,
      montoSubtotal,
      comisionMonto,
      comisionOrigen: comision.origen,
      montoTotal,
      descuentoMonto,
      cuponCodigo: params.cuponCodigo,
      estado: ReservaEstado.PENDIENTE,
      holdId: hold.holdId,
      historialEstados: [{ estado: ReservaEstado.PENDIENTE, por: 'sistema', at: new Date() }],
    });

    const guardada = await reserva.save();

    if (ocurrenciasRecurrentes.length) {
      await this.reservaModel.insertMany(
        ocurrenciasRecurrentes.map((fecha) => ({
          codigo: this.generarCodigo(),
          usuarioId: params.usuarioId,
          comercioId: params.comercioId,
          servicioId: params.servicioId,
          vertical: params.vertical,
          perroId: params.perroId,
          perroSnapshot,
          detalle: params.detalle ?? {},
          fechaInicio: fecha,
          cantidad: params.cantidad ?? 1,
          montoSubtotal,
          comisionMonto,
          montoTotal,
          descuentoMonto,
          cuponCodigo: params.cuponCodigo,
          estado: ReservaEstado.PENDIENTE,
          reservaOrigenId: guardada._id,
        })),
      );
    }

    return guardada;
  }

  /**
   * Patrón simple de recurrencia (docs §4.3): NO revalida disponibilidad por ocurrencia
   * (no es un scheduler), solo genera reservas hija con los mismos datos/precio que la
   * reserva origen, en cada día de la semana solicitado hasta `fechaFin`.
   */
  private calcularOcurrenciasRecurrentes(fechaInicio: Date, recurrencia: RecurrenciaParams): Date[] {
    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    const [horas, minutos] = recurrencia.hora.split(':').map(Number);

    if (recurrencia.fechaFin.getTime() <= fechaInicio.getTime()) {
      throw new DomainException('La fecha de fin de la recurrencia debe ser posterior a la fecha de inicio', 400);
    }

    // UTC en todo el cálculo: `fechaFin`/`fechaInicio` llegan de strings ISO (parseadas en
    // UTC); mezclar con métodos locales (setHours/getDay) desplaza el resultado según el
    // huso horario del servidor.
    const ocurrencias: Date[] = [];
    let cursor = new Date(fechaInicio.getTime() + MS_POR_DIA);
    cursor.setUTCHours(0, 0, 0, 0);
    const fin = new Date(recurrencia.fechaFin);
    fin.setUTCHours(23, 59, 59, 999);

    while (cursor.getTime() <= fin.getTime()) {
      if (recurrencia.diasSemana.includes(cursor.getUTCDay())) {
        const ocurrencia = new Date(cursor);
        ocurrencia.setUTCHours(horas || 0, minutos || 0, 0, 0);
        ocurrencias.push(ocurrencia);

        if (ocurrencias.length > MAX_OCURRENCIAS_RECURRENCIA) {
          throw new DomainException(
            `La recurrencia generaría más de ${MAX_OCURRENCIAS_RECURRENCIA} reservas; acorta la fecha de fin`,
            400,
          );
        }
      }
      cursor = new Date(cursor.getTime() + MS_POR_DIA);
    }

    return ocurrencias;
  }

  async confirmar(reservaId: string): Promise<ReservaDocument> {
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
    return reserva.save();
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
   * El comercio marca un hito de seguimiento en tiempo real (mascota entregada,
   * recogida, servicio finalizado…). El cliente lo ve por polling. El primer
   * hito pone la reserva EN_CURSO; el hito 'finalizada' la marca COMPLETADA.
   */
  async agregarSeguimiento(
    reservaId: string,
    comercioId: string,
    hito: string,
    nota?: string,
  ): Promise<ReservaDocument> {
    const reserva = await this.reservaModel.findById(reservaId).exec();
    if (!reserva) throw new DomainException('Reserva no encontrada', 404);
    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }

    const ahora = new Date();
    reserva.seguimiento.push({ hito, nota, at: ahora });

    if (hito === 'finalizada') {
      reserva.estado = ReservaEstado.COMPLETADA;
      reserva.historialEstados.push({ estado: ReservaEstado.COMPLETADA, por: `comercio:${comercioId}`, at: ahora });
    } else if (reserva.estado === ReservaEstado.CONFIRMADA) {
      reserva.estado = ReservaEstado.EN_CURSO;
      reserva.historialEstados.push({ estado: ReservaEstado.EN_CURSO, por: `comercio:${comercioId}`, at: ahora });
    }

    return reserva.save();
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

    const sumaSuplementos = suplementos.reduce((acc, s) => acc + s.monto, 0);
    const nuevoMontoSubtotal = Math.round((reserva.montoSubtotal + sumaSuplementos) * 100) / 100;
    const montoAjustado = Math.round(nuevoMontoSubtotal * (1 + IVA_RATE) * 100) / 100;

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
    const nuevoMontoSubtotal = Math.round((reserva.montoAjustado / (1 + IVA_RATE)) * 100) / 100;

    reserva.montoSubtotal = nuevoMontoSubtotal;
    reserva.comisionMonto = Math.round(nuevoMontoSubtotal * comisionPctEfectivo * 100) / 100;
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
      .exec() as Promise<ReservaDocument[]>;
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
