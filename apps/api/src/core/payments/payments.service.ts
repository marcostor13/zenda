import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Pago, PagoDocument } from './pago.schema';
import { PaymentGateway, PAYMENT_GATEWAY } from './payment-gateway.interface';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PagoEstado, PaymentIntentResponseDto, IVA_RATE, MONEDA_DEFAULT, VerticalKey } from 'shared';
import { ReservaDocument } from '../bookings/reserva.schema';

export interface DesglosePago {
  montoSubtotal: number;
  ivaMonto: number;
  montoTotal: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
    private readonly comisionConfigRepo: ComisionConfigRepository,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ¿Se puede dar una reserva por pagada sin pasar por la pasarela?
   *
   * Apagado salvo que `PAGOS_BYPASS` valga exactamente `true`. Es una llave
   * para poder recorrer el flujo de reserva de punta a punta en pruebas, y en
   * producción significaría que cualquiera reserva sin pagar: por eso hay que
   * encenderla a mano y por eso cada uso queda anotado.
   */
  bypassHabilitado(): boolean {
    return this.config.get<string>('PAGOS_BYPASS') === 'true';
  }

  /**
   * Da la reserva por pagada sin cobrar nada.
   *
   * Pasa por `aplicarPagoAprobado`, el mismo sitio por el que pasa un cobro de
   * verdad: si el bypass siguiera otro camino, las pruebas no dirían nada sobre
   * el flujo real. El pago queda marcado con `esPrueba` para que una reserva de
   * prueba no se confunda luego con dinero que hay que liquidar al comercio.
   */
  async confirmarSinCobro(reservaId: string, usuarioId: string): Promise<void> {
    if (!this.bypassHabilitado()) {
      throw new DomainException('El pago no se puede omitir en este entorno', 403);
    }

    const reserva = await this.bookingsService.obtenerPorId(reservaId);
    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    // La misma comprobación que al pagar: nadie confirma la reserva de otro,
    // ni siquiera con el bypass encendido.
    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No autorizado para pagar esta reserva', 403);
    }

    const desglose = await this.calcularDesglose(reserva);

    const pendiente = await this.pagoModel
      .findOne({ reservaId, estado: PagoEstado.INICIADO })
      .exec();

    /*
     * Si ya había un intent abierto se reaprovecha en vez de crear otro: así no
     * quedan dos pagos vivos para la misma reserva, uno aprobado y otro
     * esperando un webhook que ya no va a llegar.
     */
    const pago = pendiente ?? new this.pagoModel({
      reservaId,
      usuarioId,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
      montoSubtotal: desglose.montoSubtotal,
      ivaMonto: desglose.ivaMonto,
      comisionPlataforma: desglose.comisionPlataforma,
      stripeFee: desglose.stripeFee,
      montoLiquidacion: desglose.montoLiquidacion,
      estado: PagoEstado.INICIADO,
    });

    pago.esPrueba = true;
    await pago.save();

    this.logger.warn(
      `PAGO OMITIDO (bypass de pruebas): reserva ${reservaId}, usuario ${usuarioId}, `
      + `importe ${desglose.montoTotal} ${reserva.moneda}. No se ha cobrado nada.`,
    );

    await this.aplicarPagoAprobado(pago);
  }

  async crearIntent(reservaId: string, usuarioId: string): Promise<PaymentIntentResponseDto> {
    const reserva = await this.bookingsService.obtenerPorId(reservaId);

    if (!reserva) {
      throw new DomainException('Reserva no encontrada', 404);
    }

    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No autorizado para pagar esta reserva', 403);
    }

    const desglose = await this.calcularDesglose(reserva);

    const pagoExistente = await this.pagoModel
      .findOne({ reservaId, estado: PagoEstado.INICIADO })
      .exec();

    // Sólo se reutiliza el intent pendiente si sigue cobrando lo mismo. Si el
    // importe cambió entre medias (suplemento, cupón), reutilizarlo cobraría el
    // viejo; en ese caso se descarta y se crea uno nuevo.
    if (pagoExistente && pagoExistente.montoTotal === desglose.montoTotal) {
      return {
        clientSecret: pagoExistente.stripeMetadata?.clientSecret as string,
        pagoId: pagoExistente.id,
        montoTotal: pagoExistente.montoTotal,
        moneda: pagoExistente.moneda,
      };
    }

    if (pagoExistente) {
      pagoExistente.estado = PagoEstado.RECHAZADO;
      await pagoExistente.save();
      this.logger.log(
        `Intent obsoleto descartado para la reserva ${reservaId}: cobraba ${pagoExistente.montoTotal} € y ahora son ${desglose.montoTotal} €.`,
      );
    }

    const montoEnCentavos = Math.round(desglose.montoTotal * 100);

    const intent = await this.paymentGateway.crearIntent({
      montoEnCentavos,
      moneda: reserva.moneda,
      reservaId,
      usuarioId,
    });

    const pago = await new this.pagoModel({
      reservaId,
      usuarioId,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
      montoSubtotal: desglose.montoSubtotal,
      ivaMonto: desglose.ivaMonto,
      comisionPlataforma: desglose.comisionPlataforma,
      stripeFee: desglose.stripeFee,
      montoLiquidacion: desglose.montoLiquidacion,
      estado: PagoEstado.INICIADO,
      stripePaymentIntentId: intent.intentId,
      stripeMetadata: { clientSecret: intent.clientSecret },
    }).save();

    return {
      clientSecret: intent.clientSecret,
      pagoId: pago.id,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
    };
  }

  /**
   * Un solo cobro para todo el viaje (HU-033), pero con el desglose calculado
   * **reserva a reserva**: cada comercio tiene su comisión de vertical y su
   * propia liquidación. Sumar primero y comisionar después daría un importe
   * distinto al que le corresponde a cada uno.
   */
  async crearIntentDeViaje(
    reservaIds: string[],
    usuarioId: string,
  ): Promise<PaymentIntentResponseDto> {
    if (!reservaIds.length) {
      throw new DomainException('El viaje no tiene reservas que cobrar', 400);
    }

    const desgloses: DesglosePago[] = [];
    let stripeFijo = 0;

    for (const [indice, id] of reservaIds.entries()) {
      const reserva = await this.bookingsService.obtenerPorId(id);
      if (!reserva) {
        throw new DomainException(`Reserva ${id} no encontrada`, 404);
      }
      if (reserva.usuarioId.toString() !== usuarioId) {
        throw new DomainException('No autorizado para pagar este viaje', 403);
      }

      const config = await this.comisionConfigRepo.obtenerComisionEfectiva(reserva.vertical);
      // El fijo de Stripe es por transacción, y el viaje es **una sola**: se
      // añade una vez, no una por reserva.
      if (indice === 0) stripeFijo = config.stripeFijoEur;

      // Cada línea conserva la comisión que se fijó al crear su reserva.
      const linea = await this.calcularDesglose(reserva);
      desgloses.push({
        ...linea,
        stripeFee: Math.round((linea.montoTotal * config.stripePct) * 100) / 100,
      });
    }

    const total = this.sumarDesgloses(desgloses, stripeFijo);
    const moneda = MONEDA_DEFAULT;

    const intent = await this.paymentGateway.crearIntent({
      montoEnCentavos: Math.round(total.montoTotal * 100),
      moneda,
      reservaId: reservaIds[0],
      usuarioId,
      metadata: { esViaje: 'true', reservaIds: reservaIds.join(',') },
    });

    const pago = await new this.pagoModel({
      reservaId: reservaIds[0],
      reservaIds,
      usuarioId,
      montoTotal: total.montoTotal,
      moneda,
      montoSubtotal: total.montoSubtotal,
      ivaMonto: total.ivaMonto,
      comisionPlataforma: total.comisionPlataforma,
      stripeFee: total.stripeFee,
      montoLiquidacion: total.montoLiquidacion,
      estado: PagoEstado.INICIADO,
      stripePaymentIntentId: intent.intentId,
      stripeMetadata: { clientSecret: intent.clientSecret },
    }).save();

    return {
      clientSecret: intent.clientSecret,
      pagoId: pago.id,
      montoTotal: total.montoTotal,
      moneda,
    };
  }

  /** Agrega los desgloses del viaje y añade el fijo de Stripe una sola vez. */
  private sumarDesgloses(desgloses: DesglosePago[], stripeFijo: number): DesglosePago {
    const redondear = (n: number): number => Math.round(n * 100) / 100;
    const sumar = (clave: keyof DesglosePago): number =>
      redondear(desgloses.reduce((total, d) => total + d[clave], 0));

    const stripeFee = redondear(sumar('stripeFee') + stripeFijo);

    return {
      montoSubtotal: sumar('montoSubtotal'),
      ivaMonto: sumar('ivaMonto'),
      montoTotal: sumar('montoTotal'),
      comisionPlataforma: sumar('comisionPlataforma'),
      stripeFee,
      montoLiquidacion: redondear(sumar('montoTotal') - sumar('comisionPlataforma') - stripeFee),
    };
  }

  /** El cliente acepta el suplemento propuesto: se crea el cargo por la diferencia. */
  async aceptarAjuste(reservaId: string, usuarioId: string): Promise<PaymentIntentResponseDto> {
    const reserva = await this.bookingsService.validarAjustePendiente(reservaId, usuarioId);

    // Mismo guard que `crearIntent`: sin él, dos clics del cliente creaban dos
    // PaymentIntents por la misma diferencia, y se le cobraba dos veces.
    const suplementoPendiente = await this.pagoModel
      .findOne({ reservaId, estado: PagoEstado.INICIADO, esSuplemento: true })
      .exec();

    if (suplementoPendiente) {
      return {
        clientSecret: suplementoPendiente.stripeMetadata?.clientSecret as string,
        pagoId: suplementoPendiente.id,
        montoTotal: suplementoPendiente.montoTotal,
        moneda: suplementoPendiente.moneda,
      };
    }

    const diferenciaTotal = Math.round((reserva.montoAjustado! - reserva.montoTotal) * 100) / 100;
    const diferenciaSubtotal = Math.round((diferenciaTotal / (1 + IVA_RATE)) * 100) / 100;
    const desglose = await this.calcularDesgloseDesdeSubtotal(diferenciaSubtotal, reserva.vertical);

    const intent = await this.paymentGateway.crearIntent({
      montoEnCentavos: Math.round(desglose.montoTotal * 100),
      moneda: reserva.moneda,
      reservaId,
      usuarioId,
      metadata: { esSuplemento: 'true' },
    });

    const pago = await new this.pagoModel({
      reservaId,
      usuarioId,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
      montoSubtotal: desglose.montoSubtotal,
      ivaMonto: desglose.ivaMonto,
      comisionPlataforma: desglose.comisionPlataforma,
      stripeFee: desglose.stripeFee,
      montoLiquidacion: desglose.montoLiquidacion,
      estado: PagoEstado.INICIADO,
      stripePaymentIntentId: intent.intentId,
      stripeMetadata: { clientSecret: intent.clientSecret },
      esSuplemento: true,
    }).save();

    return {
      clientSecret: intent.clientSecret,
      pagoId: pago.id,
      montoTotal: desglose.montoTotal,
      moneda: reserva.moneda,
    };
  }

  /** El cliente rechaza el suplemento: se reembolsa el pago original y se cancela la reserva. */
  async rechazarAjuste(reservaId: string, usuarioId: string): Promise<void> {
    await this.bookingsService.validarAjustePendiente(reservaId, usuarioId);

    const pagoOriginal = await this.pagoModel
      .findOne({ reservaId, estado: PagoEstado.APROBADO, esSuplemento: false })
      .sort({ createdAt: -1 })
      .exec();

    if (pagoOriginal?.stripePaymentIntentId) {
      await this.paymentGateway.reembolsar(pagoOriginal.stripePaymentIntentId);
      pagoOriginal.estado = PagoEstado.REEMBOLSADO;
      await pagoOriginal.save();
    }

    await this.bookingsService.rechazarAjuste(reservaId, usuarioId);
    this.logger.log(`Ajuste rechazado: reserva ${reservaId} cancelada y pago original reembolsado.`);
  }

  async procesarWebhook(payload: Buffer, signature: string): Promise<void> {
    let evento: unknown;

    try {
      evento = this.paymentGateway.construirEvento(payload, signature);
    } catch {
      throw new DomainException('Firma de webhook inválida', 400);
    }

    const resultado = this.paymentGateway.extraerIntentDeEvento(evento);
    if (!resultado) return;

    const pago = await this.pagoModel
      .findOne({ stripePaymentIntentId: resultado.intentId })
      .exec();

    if (!pago) {
      this.logger.warn(`Pago no encontrado para intentId: ${resultado.intentId}`);
      return;
    }

    // Idempotencia: ignorar si ya fue procesado
    if (pago.estado !== PagoEstado.INICIADO) {
      this.logger.log(`Pago ${pago.id} ya procesado (estado: ${pago.estado}). Ignorando.`);
      return;
    }

    if (resultado.estado === 'succeeded') {
      await this.aplicarPagoAprobado(pago, resultado.chargeId);
    }

    if (resultado.estado === 'failed') {
      pago.estado = PagoEstado.RECHAZADO;
      await pago.save();
      this.logger.log(`Pago ${pago.id} fallido. SlotHold se liberará por TTL.`);
    }
  }

  /**
   * Confirma **primero** lo reservado y sólo después marca el pago como
   * aprobado.
   *
   * El orden importa y antes estaba al revés: se guardaba `APROBADO` y luego se
   * confirmaba. Si la confirmación fallaba —`confirmar()` revalida la
   * disponibilidad y puede lanzar—, el webhook devolvía error, Stripe
   * reintentaba, y en el reintento el guard de idempotencia (`estado !==
   * INICIADO`) cortaba antes de tocar la reserva: cobro consumado, reserva sin
   * confirmar y ningún reintento capaz de repararlo.
   *
   * Con el orden invertido, un fallo deja el pago en `INICIADO`, así que el
   * reintento de Stripe vuelve a entrar y termina el trabajo. `confirmar` y
   * `confirmarAjuste` ya son idempotentes, de modo que repetirlas no duplica
   * nada.
   */
  private async aplicarPagoAprobado(pago: PagoDocument, chargeId?: string): Promise<void> {
    const reservasConfirmadas: string[] = [];

    if (pago.esSuplemento) {
      await this.bookingsService.confirmarAjuste(pago.reservaId.toString());
      this.logger.log(`Ajuste de precio confirmado para la reserva ${pago.reservaId}.`);
    } else {
      // Un viaje se paga de una vez pero se confirma reserva a reserva: cada
      // comercio recibe su aviso y cada línea conserva su propio estado.
      const aConfirmar = pago.reservaIds?.length
        ? pago.reservaIds.map((id) => id.toString())
        : [pago.reservaId.toString()];

      for (const reservaId of aConfirmar) {
        await this.bookingsService.confirmar(reservaId);
        reservasConfirmadas.push(reservaId);
      }
      this.logger.log(`${aConfirmar.length} reserva(s) confirmada(s) tras pago exitoso.`);
    }

    pago.estado = PagoEstado.APROBADO;
    pago.stripeChargeId = chargeId;
    await pago.save();

    // Los avisos van al final y sin `await`: ya no hay nada que deshacer si
    // fallan, y un correo lento no debe demorar la respuesta a Stripe.
    for (const reservaId of reservasConfirmadas) {
      void this.notificationsService.notificarReservaConfirmada(reservaId);
    }
  }

  /**
   * Desglose de una reserva concreta. Usa la **comisión ya fijada al crearla**,
   * no la vigente hoy: si la plataforma cambia tarifas entre la reserva y el
   * cobro, el comercio debe pagar lo que se le dijo, no lo nuevo.
   */
  async calcularDesglose(reserva: ReservaDocument): Promise<DesglosePago> {
    const config = await this.comisionConfigRepo.obtenerComisionEfectiva(reserva.vertical);

    const montoSubtotal = reserva.montoSubtotal;
    const ivaMonto = Math.round(montoSubtotal * IVA_RATE * 100) / 100;
    const montoTotal = Math.round((montoSubtotal + ivaMonto) * 100) / 100;
    const comisionPlataforma = Math.round(reserva.comisionMonto * 100) / 100;
    const stripeFee = Math.round((montoTotal * config.stripePct + config.stripeFijoEur) * 100) / 100;
    const montoLiquidacion = Math.round((montoTotal - comisionPlataforma - stripeFee) * 100) / 100;

    return { montoSubtotal, ivaMonto, montoTotal, comisionPlataforma, stripeFee, montoLiquidacion };
  }

  /**
   * @param incluirFijoStripe false al desglosar una línea de un viaje: el fijo
   * por transacción se añade una única vez al agregar todas las líneas.
   */
  private async calcularDesgloseDesdeSubtotal(
    montoSubtotal: number,
    vertical: VerticalKey,
    incluirFijoStripe = true,
  ): Promise<DesglosePago> {
    const config = await this.comisionConfigRepo.obtenerComisionEfectiva(vertical);

    const ivaMonto = Math.round(montoSubtotal * IVA_RATE * 100) / 100;
    const montoTotal = Math.round((montoSubtotal + ivaMonto) * 100) / 100;
    const comisionPlataforma = Math.round(montoSubtotal * config.comisionPct * 100) / 100;
    const fijo = incluirFijoStripe ? config.stripeFijoEur : 0;
    const stripeFee = Math.round((montoTotal * config.stripePct + fijo) * 100) / 100;
    const montoLiquidacion = Math.round((montoTotal - comisionPlataforma - stripeFee) * 100) / 100;

    return { montoSubtotal, ivaMonto, montoTotal, comisionPlataforma, stripeFee, montoLiquidacion };
  }
}
