import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PagoEstado, ReservaEstado } from 'shared';
import { BookingsService } from '../bookings/bookings.service';
import { ReservaDocument } from '../bookings/reserva.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CancelacionesService } from './cancelaciones.service';
import { Pago } from './pago.schema';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.interface';

interface PagoMock {
  montoTotal: number;
  importeReembolsado?: number;
  stripePaymentIntentId?: string;
  esPrueba?: boolean;
  estado: PagoEstado;
  save: jest.Mock;
}

describe('CancelacionesService', () => {
  let service: CancelacionesService;
  let pagoModel: { findOne: jest.Mock };
  let gateway: jest.Mocked<Pick<PaymentGateway, 'reembolsar'>>;
  let bookings: jest.Mocked<Pick<BookingsService,
    'cancelablePorCliente' | 'politicaCancelacion' | 'marcarCancelada' | 'pendienteDeAceptar' | 'aceptacionesVencidas'>>;
  let notifications: jest.Mocked<Pick<NotificationsService, 'notificarCancelacion' | 'notificarAceptacion'>>;

  const reservaId = new Types.ObjectId();
  const reserva = (extra: Record<string, unknown> = {}) =>
    ({ _id: reservaId, estado: ReservaEstado.CONFIRMADA, montoTotal: 100, ...extra }) as unknown as ReservaDocument;

  const pago = (extra: Partial<PagoMock> = {}): PagoMock => ({
    montoTotal: 100, importeReembolsado: 0, stripePaymentIntentId: 'pi_1', estado: PagoEstado.APROBADO,
    save: jest.fn().mockResolvedValue(undefined), ...extra,
  });

  const conPago = (doc: PagoMock | null) => {
    pagoModel.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) }) });
  };

  beforeEach(async () => {
    pagoModel = { findOne: jest.fn() };
    conPago(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CancelacionesService,
        { provide: getModelToken(Pago.name), useValue: pagoModel },
        { provide: PAYMENT_GATEWAY, useValue: { reembolsar: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: BookingsService,
          useValue: {
            cancelablePorCliente: jest.fn(),
            politicaCancelacion: jest.fn().mockResolvedValue({ porcentaje: 100, motivo: 'Gratis' }),
            marcarCancelada: jest.fn().mockImplementation(async (r: ReservaDocument) => r),
            pendienteDeAceptar: jest.fn(),
            aceptacionesVencidas: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notificarCancelacion: jest.fn().mockResolvedValue(undefined),
            notificarAceptacion: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CancelacionesService);
    gateway = moduleRef.get(PAYMENT_GATEWAY);
    bookings = moduleRef.get(BookingsService);
    notifications = moduleRef.get(NotificationsService);
  });

  describe('vistaPrevia', () => {
    it('debería calcular el importe según el porcentaje de la política', async () => {
      bookings.cancelablePorCliente.mockResolvedValue(reserva({ montoTotal: 55.55 }));
      bookings.politicaCancelacion.mockResolvedValue({ porcentaje: 50, motivo: 'Tardía' });

      await expect(service.vistaPrevia('r1', 'u1')).resolves.toEqual({ porcentaje: 50, motivo: 'Tardía', importe: 27.78 });
      expect(bookings.cancelablePorCliente).toHaveBeenCalledWith('r1', 'u1');
    });

    it('debería acotar el porcentaje entre 0 y 100', async () => {
      bookings.cancelablePorCliente.mockResolvedValue(reserva());
      bookings.politicaCancelacion.mockResolvedValue({ porcentaje: 150, motivo: 'x' });
      await expect(service.vistaPrevia('r1', 'u1')).resolves.toMatchObject({ importe: 100 });

      bookings.politicaCancelacion.mockResolvedValue({ porcentaje: -10, motivo: 'x' });
      await expect(service.vistaPrevia('r1', 'u1')).resolves.toMatchObject({ importe: 0 });
    });

    it('no debería devolver nada de una reserva sin pagar', async () => {
      bookings.cancelablePorCliente.mockResolvedValue(reserva({ estado: ReservaEstado.PENDIENTE }));

      await expect(service.vistaPrevia('r1', 'u1')).resolves.toEqual({
        porcentaje: 0, importe: 0, motivo: 'La reserva no llegó a pagarse.',
      });
      expect(bookings.politicaCancelacion).not.toHaveBeenCalled();
    });
  });

  describe('cancelarPorCliente', () => {
    it('debería devolver una parte del cobro con importe y avisar al cliente', async () => {
      const doc = pago();
      conPago(doc);
      bookings.cancelablePorCliente.mockResolvedValue(reserva());
      bookings.politicaCancelacion.mockResolvedValue({ porcentaje: 50, motivo: 'Tardía' });

      await service.cancelarPorCliente('r1', 'u1');

      expect(pagoModel.findOne).toHaveBeenCalledWith({
        $or: [{ reservaId }, { reservaIds: reservaId }], estado: PagoEstado.APROBADO, esSuplemento: false,
      });
      expect(gateway.reembolsar).toHaveBeenCalledWith('pi_1', 50);
      expect(doc.importeReembolsado).toBe(50);
      expect(doc.estado).toBe(PagoEstado.APROBADO);
      expect(doc.save).toHaveBeenCalled();
      expect(bookings.marcarCancelada).toHaveBeenCalledWith(expect.anything(), {
        por: 'cliente:u1', motivo: 'Tardía', reembolso: { porcentaje: 50, importe: 50 },
      });
      expect(notifications.notificarCancelacion).toHaveBeenCalledWith('r1');
    });

    it('debería marcar el pago como reembolsado si se devuelve entero', async () => {
      const doc = pago();
      conPago(doc);
      bookings.cancelablePorCliente.mockResolvedValue(reserva());

      await service.cancelarPorCliente('r1', 'u1');

      expect(gateway.reembolsar).toHaveBeenCalledWith('pi_1', 100);
      expect(doc.estado).toBe(PagoEstado.REEMBOLSADO);
    });

    it('no debería devolver más de lo que queda del cobro', async () => {
      const doc = pago({ importeReembolsado: 80 });
      conPago(doc);
      bookings.cancelablePorCliente.mockResolvedValue(reserva());

      await service.cancelarPorCliente('r1', 'u1');

      expect(gateway.reembolsar).toHaveBeenCalledWith('pi_1', 20);
      expect(doc.importeReembolsado).toBe(100);
    });

    it('no debería llamar a la pasarela si ya se devolvió todo', async () => {
      conPago(pago({ importeReembolsado: 100 }));
      bookings.cancelablePorCliente.mockResolvedValue(reserva());

      await service.cancelarPorCliente('r1', 'u1');

      expect(gateway.reembolsar).not.toHaveBeenCalled();
      expect(bookings.marcarCancelada).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        reembolso: { porcentaje: 100, importe: 0 },
      }));
    });

    it('no debería buscar pago ni devolver nada si la reserva no se pagó', async () => {
      bookings.cancelablePorCliente.mockResolvedValue(reserva({ estado: ReservaEstado.PENDIENTE }));

      await service.cancelarPorCliente('r1', 'u1');

      expect(pagoModel.findOne).not.toHaveBeenCalled();
      expect(gateway.reembolsar).not.toHaveBeenCalled();
      expect(bookings.marcarCancelada).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        reembolso: { porcentaje: 0, importe: 0 },
      }));
    });

    it('debería anotar el reembolso de un pago de prueba sin llamar a la pasarela', async () => {
      const doc = pago({ esPrueba: true });
      conPago(doc);
      bookings.cancelablePorCliente.mockResolvedValue(reserva());

      await service.cancelarPorCliente('r1', 'u1');

      expect(gateway.reembolsar).not.toHaveBeenCalled();
      expect(doc.importeReembolsado).toBe(100);
      expect(doc.save).toHaveBeenCalled();
    });

    it('debería anotar el reembolso de un pago sin intent de Stripe (bypass) sin llamar a la pasarela', async () => {
      const doc = pago({ stripePaymentIntentId: undefined, importeReembolsado: undefined });
      conPago(doc);
      bookings.cancelablePorCliente.mockResolvedValue(reserva());

      await service.cancelarPorCliente('r1', 'u1');

      expect(gateway.reembolsar).not.toHaveBeenCalled();
      expect(doc.importeReembolsado).toBe(100);
    });

    it('debería registrar 0 devuelto si no encuentra el cobro', async () => {
      bookings.cancelablePorCliente.mockResolvedValue(reserva());

      await service.cancelarPorCliente('r1', 'u1');

      expect(bookings.marcarCancelada).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        reembolso: { porcentaje: 100, importe: 0 },
      }));
    });
  });

  describe('rechazarViaje', () => {
    it('debería devolver el 100 % y avisar al cliente del rechazo', async () => {
      conPago(pago());
      bookings.pendienteDeAceptar.mockResolvedValue(reserva());

      await service.rechazarViaje('r1', 'c1', 'Sin conductor');

      expect(bookings.pendienteDeAceptar).toHaveBeenCalledWith('r1', 'c1');
      expect(gateway.reembolsar).toHaveBeenCalledWith('pi_1', 100);
      expect(bookings.marcarCancelada).toHaveBeenCalledWith(expect.anything(), {
        por: 'comercio:c1', motivo: 'Sin conductor', aceptacion: 'rechazada', reembolso: { porcentaje: 100, importe: 100 },
      });
      expect(notifications.notificarAceptacion).toHaveBeenCalledWith(reservaId.toString(), false, 100);
    });

    it('debería usar un motivo por defecto', async () => {
      bookings.pendienteDeAceptar.mockResolvedValue(reserva());

      await service.rechazarViaje('r1', 'c1');

      expect(bookings.marcarCancelada).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        motivo: 'El transportista no puede hacer este viaje.',
      }));
    });
  });

  describe('caducarAceptaciones', () => {
    it('debería cancelar y devolver cada viaje vencido, siguiendo aunque uno falle', async () => {
      const primera = reserva({ _id: new Types.ObjectId() });
      const segunda = reserva({ _id: new Types.ObjectId() });
      bookings.aceptacionesVencidas.mockResolvedValue([primera, segunda]);
      bookings.marcarCancelada
        .mockRejectedValueOnce(new Error('mongo caído'))
        .mockImplementationOnce(async (r: ReservaDocument) => r);

      await expect(service.caducarAceptaciones()).resolves.toBe(2);

      expect(bookings.marcarCancelada).toHaveBeenCalledTimes(2);
      expect(bookings.marcarCancelada).toHaveBeenLastCalledWith(segunda, expect.objectContaining({
        por: 'sistema', aceptacion: 'caducada', motivo: 'El transportista no aceptó el viaje a tiempo.',
      }));
      expect(notifications.notificarAceptacion).toHaveBeenCalledTimes(1);
    });

    it('debería devolver 0 si no hay nada vencido', async () => {
      await expect(service.caducarAceptaciones()).resolves.toBe(0);
    });
  });
});
