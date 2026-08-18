import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { Pago } from './pago.schema';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.interface';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PagoEstado, VerticalKey, IVA_RATE } from 'shared';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let pagoModel: any;
  let paymentGateway: jest.Mocked<PaymentGateway>;
  let comisionConfigRepo: jest.Mocked<ComisionConfigRepository>;
  let bookingsService: jest.Mocked<BookingsService>;

  const reservaMock: any = {
    id: 'reserva-1',
    usuarioId: { toString: () => 'user-1' },
    comercioId: { toString: () => 'comercio-1' },
    vertical: VerticalKey.ALOJAMIENTO,
    montoSubtotal: 500,
    // Comisión fijada al crear la reserva; el cobro usa esta, no la vigente hoy.
    comisionMonto: 75,
    moneda: 'EUR',
    reservaId: 'reserva-1',
  };

  const comisionConfigMock: any = {
    vertical: VerticalKey.ALOJAMIENTO,
    comisionPct: 0.15,
    stripePct: 0.029,
    stripeFijoEur: 1.1,
  };

  const pagoMock = {
    id: 'pago-1',
    reservaId: 'reserva-1',
    usuarioId: 'user-1',
    // 500 de subtotal + 21 % de IVA: el mismo total que devuelve calcularDesglose.
    montoTotal: 605,
    moneda: 'EUR',
    estado: PagoEstado.INICIADO,
    stripePaymentIntentId: 'pi_test',
    stripeMetadata: { clientSecret: 'pi_test_secret' },
    stripeChargeId: undefined as string | undefined,
    save: jest.fn(),
  };

  beforeEach(async () => {
    const mockSave = jest.fn().mockResolvedValue(pagoMock);
    pagoModel = jest.fn().mockImplementation(() => ({ ...pagoMock, save: mockSave }));
    pagoModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        {
          provide: PAYMENT_GATEWAY,
          useValue: {
            crearIntent: jest.fn().mockResolvedValue({ intentId: 'pi_test', clientSecret: 'pi_test_secret' }),
            construirEvento: jest.fn(),
            extraerIntentDeEvento: jest.fn(),
            reembolsar: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ComisionConfigRepository,
          useValue: { obtenerComisionEfectiva: jest.fn().mockResolvedValue(comisionConfigMock) },
        },
        {
          provide: BookingsService,
          useValue: {
            obtenerPorId: jest.fn().mockResolvedValue(reservaMock),
            confirmar: jest.fn().mockResolvedValue(undefined),
            confirmarAjuste: jest.fn().mockResolvedValue(undefined),
            rechazarAjuste: jest.fn().mockResolvedValue(undefined),
            validarAjustePendiente: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: { notificarReservaConfirmada: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentGateway = module.get(PAYMENT_GATEWAY);
    comisionConfigRepo = module.get(ComisionConfigRepository);
    bookingsService = module.get(BookingsService);
  });

  describe('crearIntent', () => {
    it('debería crear un PaymentIntent y retornar clientSecret', async () => {
      const resultado = await service.crearIntent('reserva-1', 'user-1');

      expect(paymentGateway.crearIntent).toHaveBeenCalledWith(
        expect.objectContaining({ reservaId: 'reserva-1', usuarioId: 'user-1' }),
      );
      expect(resultado.clientSecret).toBe('pi_test_secret');
      expect(resultado.pagoId).toBe('pago-1');
    });

    it('debería lanzar DomainException 404 si la reserva no existe', async () => {
      bookingsService.obtenerPorId.mockResolvedValue(null);
      await expect(service.crearIntent('no-existe', 'user-1')).rejects.toThrow(DomainException);
    });

    it('debería lanzar DomainException 403 si el usuario no es el dueño', async () => {
      await expect(service.crearIntent('reserva-1', 'otro-user')).rejects.toThrow(DomainException);
    });

    it('debería retornar el pago existente si ya hay uno en estado INICIADO', async () => {
      pagoModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...pagoMock, save: jest.fn() }),
      });
      const resultado = await service.crearIntent('reserva-1', 'user-1');

      expect(paymentGateway.crearIntent).not.toHaveBeenCalled();
      expect(resultado.clientSecret).toBe('pi_test_secret');
    });

    it('debería descartar el intent pendiente si ya no cobra el importe correcto', async () => {
      // Si entre medias cambió el importe (suplemento, cupón), reutilizar el
      // clientSecret viejo cobraría de menos o de más.
      const save = jest.fn();
      const obsoleto = { ...pagoMock, montoTotal: 400, save };
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(obsoleto) });

      await service.crearIntent('reserva-1', 'user-1');

      expect(obsoleto.estado).toBe(PagoEstado.RECHAZADO);
      expect(save).toHaveBeenCalled();
      expect(paymentGateway.crearIntent).toHaveBeenCalled();
    });
  });

  describe('calcularDesglose', () => {
    it('debería calcular IGV, comisión plataforma y Stripe fee correctamente', async () => {
      const desglose = await service.calcularDesglose(reservaMock);

      const subtotal = 500;
      const igv = Math.round(subtotal * IVA_RATE * 100) / 100; // 90
      const total = subtotal + igv; // 590
      const comision = Math.round(subtotal * 0.15 * 100) / 100; // 75
      const stripeFee = Math.round((total * 0.029 + 1.1) * 100) / 100;
      const liquidacion = Math.round((total - comision - stripeFee) * 100) / 100;

      expect(desglose.montoSubtotal).toBe(subtotal);
      expect(desglose.ivaMonto).toBe(igv);
      expect(desglose.montoTotal).toBe(total);
      expect(desglose.comisionPlataforma).toBe(comision);
      expect(desglose.stripeFee).toBe(stripeFee);
      expect(desglose.montoLiquidacion).toBe(liquidacion);
    });

    it('debería cobrar la comisión pactada en la reserva, no la vigente hoy', async () => {
      // El vertical está al 15 %, pero esta reserva se creó con un 8 % (tramo
      // bajo o socio fundador). Al comercio se le cobra lo que se le dijo.
      const conComisionPactada = { ...reservaMock, comisionMonto: 40 };

      const desglose = await service.calcularDesglose(conComisionPactada);

      expect(desglose.comisionPlataforma).toBe(40);
      // Y la liquidación se recalcula sobre esa comisión, no sobre la actual.
      expect(desglose.montoLiquidacion).toBe(
        Math.round((desglose.montoTotal - 40 - desglose.stripeFee) * 100) / 100,
      );
    });
  });

  describe('aceptarAjuste', () => {
    const reservaConAjuste: any = {
      ...reservaMock,
      montoTotal: 121,
      montoAjustado: 139.15,
    };

    it('debería cobrar la diferencia y crear un Pago marcado como suplemento', async () => {
      bookingsService.validarAjustePendiente.mockResolvedValue(reservaConAjuste);

      const resultado = await service.aceptarAjuste('reserva-1', 'user-1');

      expect(paymentGateway.crearIntent).toHaveBeenCalledWith(
        expect.objectContaining({ montoEnCentavos: 1815, reservaId: 'reserva-1', usuarioId: 'user-1' }),
      );
      expect(pagoModel).toHaveBeenCalledWith(expect.objectContaining({ esSuplemento: true, montoTotal: 18.15 }));
      expect(resultado.clientSecret).toBe('pi_test_secret');
    });
  });

  describe('aceptarAjuste — idempotencia', () => {
    it('no debería crear un segundo cargo si ya hay un suplemento pendiente', async () => {
      // Dos clics del cliente creaban dos PaymentIntents por la misma diferencia.
      const pendiente = { ...pagoMock, esSuplemento: true, montoTotal: 30, save: jest.fn() };
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(pendiente) });

      const resultado = await service.aceptarAjuste('reserva-1', 'user-1');

      expect(paymentGateway.crearIntent).not.toHaveBeenCalled();
      expect(resultado.montoTotal).toBe(30);
    });
  });

  describe('rechazarAjuste', () => {
    it('debería reembolsar el pago original aprobado y cancelar la reserva', async () => {
      bookingsService.validarAjustePendiente.mockResolvedValue(reservaMock);
      const pagoAprobado = { ...pagoMock, estado: PagoEstado.APROBADO, save: jest.fn() };
      pagoModel.findOne.mockReturnValue({
        sort: () => ({ exec: jest.fn().mockResolvedValue(pagoAprobado) }),
      });

      await service.rechazarAjuste('reserva-1', 'user-1');

      expect(paymentGateway.reembolsar).toHaveBeenCalledWith('pi_test');
      expect(pagoAprobado.estado).toBe(PagoEstado.REEMBOLSADO);
      expect(bookingsService.rechazarAjuste).toHaveBeenCalledWith('reserva-1', 'user-1');
    });

    it('no debería reembolsar si no hay pago original aprobado', async () => {
      bookingsService.validarAjustePendiente.mockResolvedValue(reservaMock);
      pagoModel.findOne.mockReturnValue({ sort: () => ({ exec: jest.fn().mockResolvedValue(null) }) });

      await service.rechazarAjuste('reserva-1', 'user-1');

      expect(paymentGateway.reembolsar).not.toHaveBeenCalled();
      expect(bookingsService.rechazarAjuste).toHaveBeenCalledWith('reserva-1', 'user-1');
    });
  });

  describe('procesarWebhook', () => {
    it('debería confirmar la reserva al recibir payment_intent.succeeded', async () => {
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...pagoMock, save: jest.fn() }) });
      paymentGateway.construirEvento.mockReturnValue({ type: 'payment_intent.succeeded' });
      paymentGateway.extraerIntentDeEvento.mockReturnValue({
        intentId: 'pi_test',
        estado: 'succeeded',
        chargeId: 'ch_test',
      });

      await service.procesarWebhook(Buffer.from('{}'), 'sig_test');

      expect(bookingsService.confirmar).toHaveBeenCalledWith('reserva-1');
    });

    it('debería lanzar DomainException si la firma del webhook es inválida', async () => {
      paymentGateway.construirEvento.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.procesarWebhook(Buffer.from('{}'), 'sig_invalida'),
      ).rejects.toThrow(DomainException);
    });

    it('debería confirmar el ajuste (no la reserva) cuando el pago es de un suplemento', async () => {
      const pagoSuplemento = { ...pagoMock, esSuplemento: true, save: jest.fn() };
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(pagoSuplemento) });
      paymentGateway.construirEvento.mockReturnValue({ type: 'payment_intent.succeeded' });
      paymentGateway.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_test', estado: 'succeeded' });

      await service.procesarWebhook(Buffer.from('{}'), 'sig_test');

      expect(bookingsService.confirmarAjuste).toHaveBeenCalledWith('reserva-1');
      expect(bookingsService.confirmar).not.toHaveBeenCalled();
    });

    it('debería ignorar si el pago ya fue procesado (idempotencia)', async () => {
      const pagoAprobado = { ...pagoMock, estado: PagoEstado.APROBADO, save: jest.fn() };
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(pagoAprobado) });
      paymentGateway.construirEvento.mockReturnValue({});
      paymentGateway.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_test', estado: 'succeeded' });

      await service.procesarWebhook(Buffer.from('{}'), 'sig_test');

      expect(bookingsService.confirmar).not.toHaveBeenCalled();
    });

    /**
     * El orden entre "marcar el pago" y "confirmar la reserva" decide si un
     * fallo se puede reparar. Guardar el pago primero lo hacía irreparable: el
     * reintento de Stripe chocaba contra el propio guard de idempotencia.
     */
    describe('orden de confirmación y reintentos', () => {
      it('debería confirmar la reserva ANTES de marcar el pago como aprobado', async () => {
        const orden: string[] = [];
        const save = jest.fn().mockImplementation(() => { orden.push('pago-guardado'); });
        bookingsService.confirmar.mockImplementation(async () => {
          orden.push('reserva-confirmada');
          return {} as never;
        });
        pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...pagoMock, save }) });
        paymentGateway.construirEvento.mockReturnValue({});
        paymentGateway.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_test', estado: 'succeeded' });

        await service.procesarWebhook(Buffer.from('{}'), 'sig_test');

        expect(orden).toEqual(['reserva-confirmada', 'pago-guardado']);
      });

      it('no debería dejar el pago como aprobado si la reserva no se pudo confirmar', async () => {
        // Así el pago sigue en INICIADO y el reintento de Stripe puede rematarlo,
        // en vez de quedarse cobrado y sin reserva para siempre.
        const save = jest.fn();
        bookingsService.confirmar.mockRejectedValue(new DomainException('sin plaza', 409));
        pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...pagoMock, save }) });
        paymentGateway.construirEvento.mockReturnValue({});
        paymentGateway.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_test', estado: 'succeeded' });

        await expect(service.procesarWebhook(Buffer.from('{}'), 'sig_test')).rejects.toThrow();
        expect(save).not.toHaveBeenCalled();
      });

      it('debería confirmar todas las líneas del viaje antes de marcar el pago', async () => {
        const orden: string[] = [];
        const save = jest.fn().mockImplementation(() => { orden.push('pago-guardado'); });
        bookingsService.confirmar.mockImplementation(async (id: string) => {
          orden.push(id);
          return {} as never;
        });
        pagoModel.findOne.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ ...pagoMock, reservaIds: ['r1', 'r2'], save }),
        });
        paymentGateway.construirEvento.mockReturnValue({});
        paymentGateway.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_test', estado: 'succeeded' });

        await service.procesarWebhook(Buffer.from('{}'), 'sig_test');

        expect(orden).toEqual(['r1', 'r2', 'pago-guardado']);
      });
    });
  });

  describe('crearIntentDeViaje', () => {
    /** Reserva de un viaje, con su propio importe y comisión ya fijados. */
    const linea = (id: string, subtotal: number, comision: number) => ({
      ...reservaMock, id, reservaId: id, montoSubtotal: subtotal, comisionMonto: comision,
    });

    it('debería rechazar un viaje sin reservas', async () => {
      await expect(service.crearIntentDeViaje([], 'user-1'))
        .rejects.toThrow('no tiene reservas que cobrar');
    });

    it('debería lanzar 404 si alguna reserva del viaje no existe', async () => {
      bookingsService.obtenerPorId.mockResolvedValue(null as never);

      await expect(service.crearIntentDeViaje(['r1'], 'user-1'))
        .rejects.toThrow('Reserva r1 no encontrada');
    });

    it('no debería dejar pagar el viaje de otro usuario', async () => {
      bookingsService.obtenerPorId.mockResolvedValue(
        { ...reservaMock, usuarioId: { toString: () => 'otro' } } as never,
      );

      await expect(service.crearIntentDeViaje(['r1'], 'user-1'))
        .rejects.toThrow('No autorizado para pagar este viaje');
    });

    it('debería cobrar el fijo de Stripe una sola vez, no una por reserva', async () => {
      // El viaje es una única transacción: cobrar el fijo por cada línea
      // inflaría el coste de pasarela y falsearía la liquidación.
      bookingsService.obtenerPorId
        .mockResolvedValueOnce(linea('r1', 100, 15) as never)
        .mockResolvedValueOnce(linea('r2', 100, 15) as never);

      await service.crearIntentDeViaje(['r1', 'r2'], 'user-1');

      const guardado = pagoModel.mock.calls[0][0];
      // 2 líneas × (121 × 0,029) = 7,02 más UN fijo de 1,10 → 8,12
      expect(guardado.stripeFee).toBeCloseTo(8.12, 2);
    });

    it('debería sumar los importes de todas las líneas del viaje', async () => {
      bookingsService.obtenerPorId
        .mockResolvedValueOnce(linea('r1', 100, 15) as never)
        .mockResolvedValueOnce(linea('r2', 200, 30) as never);

      await service.crearIntentDeViaje(['r1', 'r2'], 'user-1');

      const guardado = pagoModel.mock.calls[0][0];
      expect(guardado.montoSubtotal).toBeCloseTo(300, 2);
      expect(guardado.comisionPlataforma).toBeCloseTo(45, 2);
      // Con IVA del 21 %: 300 → 363
      expect(guardado.montoTotal).toBeCloseTo(363, 2);
    });

    it('debería dejar la liquidación como total menos comisión y pasarela', async () => {
      bookingsService.obtenerPorId.mockResolvedValue(linea('r1', 100, 15) as never);

      await service.crearIntentDeViaje(['r1'], 'user-1');

      const g = pagoModel.mock.calls[0][0];
      expect(g.montoLiquidacion).toBeCloseTo(g.montoTotal - g.comisionPlataforma - g.stripeFee, 2);
    });

    it('debería guardar todas las reservas del viaje para confirmarlas luego', async () => {
      bookingsService.obtenerPorId
        .mockResolvedValueOnce(linea('r1', 100, 15) as never)
        .mockResolvedValueOnce(linea('r2', 100, 15) as never);

      await service.crearIntentDeViaje(['r1', 'r2'], 'user-1');

      const guardado = pagoModel.mock.calls[0][0];
      expect(guardado.reservaIds).toEqual(['r1', 'r2']);
      // La primera hace de referencia principal del pago.
      expect(guardado.reservaId).toBe('r1');
    });

    it('debería marcar el intent como viaje en los metadatos de la pasarela', async () => {
      bookingsService.obtenerPorId.mockResolvedValue(linea('r1', 100, 15) as never);

      await service.crearIntentDeViaje(['r1', 'r2'], 'user-1');

      const intent = paymentGateway.crearIntent.mock.calls[0][0];
      expect(intent.metadata).toEqual({ esViaje: 'true', reservaIds: 'r1,r2' });
      expect(intent.montoEnCentavos).toBe(Math.round(intent.montoEnCentavos));
    });
  });

  describe('webhook de un viaje', () => {
    function mockPagoGuardado(pago: Record<string, unknown>) {
      pagoModel.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(pago) });
    }

    beforeEach(() => {
      paymentGateway.construirEvento.mockReturnValue({ type: 'payment_intent.succeeded' } as never);
      paymentGateway.extraerIntentDeEvento.mockReturnValue(
        { intentId: 'pi_test', estado: 'succeeded', chargeId: 'ch_1' } as never,
      );
    });

    it('debería confirmar cada reserva del viaje por separado', async () => {
      // Se paga de una vez pero se confirma línea a línea: cada comercio recibe
      // su aviso y cada reserva conserva su propio estado.
      mockPagoGuardado({
        id: 'pago-1', estado: PagoEstado.INICIADO, reservaId: { toString: () => 'r1' },
        reservaIds: [{ toString: () => 'r1' }, { toString: () => 'r2' }],
        save: jest.fn().mockResolvedValue(undefined),
      });

      await service.procesarWebhook(Buffer.from('x'), 'firma');

      expect(bookingsService.confirmar).toHaveBeenCalledTimes(2);
      expect(bookingsService.confirmar).toHaveBeenCalledWith('r1');
      expect(bookingsService.confirmar).toHaveBeenCalledWith('r2');
    });

    it('debería confirmar la única reserva cuando el pago no es de viaje', async () => {
      mockPagoGuardado({
        id: 'pago-1', estado: PagoEstado.INICIADO, reservaId: { toString: () => 'r1' },
        reservaIds: [], save: jest.fn().mockResolvedValue(undefined),
      });

      await service.procesarWebhook(Buffer.from('x'), 'firma');

      expect(bookingsService.confirmar).toHaveBeenCalledTimes(1);
      expect(bookingsService.confirmar).toHaveBeenCalledWith('r1');
    });
  });
});
