import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PagoEstado } from 'shared';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  const intentResponseMock = {
    clientSecret: 'pi_test_secret',
    pagoId: 'pago-1',
    montoTotal: 590,
    moneda: 'PEN',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            crearIntent: jest.fn().mockResolvedValue(intentResponseMock),
            procesarWebhook: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    paymentsService = module.get(PaymentsService);
  });

  describe('crearIntent', () => {
    it('debería delegar a PaymentsService con reservaId y usuarioId', async () => {
      const req: any = { user: { sub: 'user-1' } };
      const resultado = await controller.crearIntent({ reservaId: 'reserva-1' }, req);

      expect(paymentsService.crearIntent).toHaveBeenCalledWith('reserva-1', 'user-1');
      expect(resultado).toEqual(intentResponseMock);
    });
  });

  describe('webhook', () => {
    it('debería procesar el webhook y retornar { received: true }', async () => {
      const req: any = { rawBody: Buffer.from('{}') };
      const resultado = await controller.webhook(req, 'sig_test');

      expect(paymentsService.procesarWebhook).toHaveBeenCalledWith(Buffer.from('{}'), 'sig_test');
      expect(resultado).toEqual({ received: true });
    });
  });
});
