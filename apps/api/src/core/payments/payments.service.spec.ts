import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { Pago } from './pago.schema';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.interface';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { BookingsService } from '../bookings/bookings.service';
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
    montoTotal: 590,
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
          },
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
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(pagoMock) });
      const resultado = await service.crearIntent('reserva-1', 'user-1');

      expect(paymentGateway.crearIntent).not.toHaveBeenCalled();
      expect(resultado.clientSecret).toBe('pi_test_secret');
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

    it('debería ignorar si el pago ya fue procesado (idempotencia)', async () => {
      const pagoAprobado = { ...pagoMock, estado: PagoEstado.APROBADO, save: jest.fn() };
      pagoModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(pagoAprobado) });
      paymentGateway.construirEvento.mockReturnValue({});
      paymentGateway.extraerIntentDeEvento.mockReturnValue({ intentId: 'pi_test', estado: 'succeeded' });

      await service.procesarWebhook(Buffer.from('{}'), 'sig_test');

      expect(bookingsService.confirmar).not.toHaveBeenCalled();
    });
  });
});
