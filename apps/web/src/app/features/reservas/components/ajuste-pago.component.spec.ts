import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReservaEstado, VerticalKey } from 'shared';
import { AjustePagoComponent } from './ajuste-pago.component';
import { ReservaApi, ReservasService } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { StripeService } from '../../../core/stripe/stripe.service';
import { PagoEnCursoService } from '../services/pago-en-curso.service';

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  servicioId: 's1', comercioId: 'c1',
  montoSubtotal: 100, comisionMonto: 15, descuentoMonto: 0, montoTotal: 121, moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z', cantidad: 1,
  estado: 'ajuste_solicitado' as ReservaEstado, montoAjustado: 151,
  createdAt: '2026-07-01T00:00:00.000Z',
  ...extra,
});

describe('AjustePagoComponent', () => {
  let fixture: ComponentFixture<AjustePagoComponent>;
  let componente: AjustePagoComponent;
  let reservasService: Record<string, jest.Mock>;
  let paymentsService: Record<string, jest.Mock>;
  let stripeService: Record<string, jest.Mock>;
  let pagoEnCurso: Record<string, jest.Mock>;

  const elementoStripe = { mount: jest.fn() };
  const stripeFake = {
    elements: jest.fn(() => ({ create: jest.fn(() => elementoStripe) })),
    confirmPayment: jest.fn().mockResolvedValue({}),
  };

  const crear = async (
    datos: ReservaApi | Error = reserva(),
    ajustes: { payments?: Record<string, jest.Mock>; stripe?: Record<string, jest.Mock> } = {},
    codigo: string | null = 'RES-AAAA1111',
  ): Promise<void> => {
    reservasService = {
      // Fallo síncrono: una promesa rechazada en `ngOnInit` la reporta zone.js
      // como error global del documento aunque el componente la capture.
      obtenerPorCodigo: datos instanceof Error
        ? jest.fn(() => { throw datos; })
        : jest.fn().mockResolvedValue(datos),
    };
    paymentsService = ajustes.payments ?? {
      aceptarAjuste: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 30 }),
      rechazarAjuste: jest.fn().mockResolvedValue(undefined),
    };
    stripeService = ajustes.stripe ?? { getStripe: jest.fn().mockResolvedValue(stripeFake) };
    pagoEnCurso = {
      anotar: jest.fn(),
      olvidar: jest.fn(),
      pendiente: jest.fn().mockReturnValue(null),
      sincronizar: jest.fn().mockResolvedValue(true),
      cerrarPendiente: jest.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [AjustePagoComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservasService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: StripeService, useValue: stripeService },
        { provide: PagoEnCursoService, useValue: pagoEnCurso },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(codigo ? { codigo } : {}) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AjustePagoComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // `ngOnInit` encadena reserva → intent → SDK de Stripe: hace falta drenar
    // varias rondas de microtareas antes de mirar el estado final.
    for (let i = 0; i < 4; i++) await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
    stripeFake.confirmPayment.mockResolvedValue({});
  });

  describe('carga', () => {
    it('debería preparar el cobro de la diferencia', async () => {
      await crear();

      expect(paymentsService['aceptarAjuste']).toHaveBeenCalledWith('r1');
      expect(componente.stripeListo()).toBe(true);
      expect(componente.errorCarga()).toBeNull();
    });

    it('debería calcular lo que falta por pagar', async () => {
      await crear(reserva({ montoTotal: 121, montoAjustado: 151 }));

      expect(componente.diferencia()).toBe(30);
    });

    it('debería reflejar un ajuste a la baja como diferencia negativa', async () => {
      await crear(reserva({ montoTotal: 121, montoAjustado: 100 }));

      expect(componente.diferencia()).toBe(-21);
    });

    it('no debería mostrar diferencia si no hay importe ajustado', async () => {
      await crear(reserva({ montoAjustado: undefined, estado: ReservaEstado.CONFIRMADA }));

      expect(componente.diferencia()).toBe(0);
    });

    it('debería rechazar reservas sin ajuste pendiente', async () => {
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      // Sin esta comprobación se cobraría un ajuste que el comercio no pidió.
      expect(componente.errorCarga()).toContain('ningún ajuste de precio pendiente');
      expect(paymentsService['aceptarAjuste']).not.toHaveBeenCalled();
    });

    it('debería avisar si la reserva no se puede cargar', async () => {
      await crear(new Error('404'));

      expect(componente.errorCarga()).toContain('No se pudo cargar');
      expect(componente.cargando()).toBe(false);
    });

    it('no debería consultar nada sin código en la ruta', async () => {
      await crear(reserva(), {}, null);

      expect(reservasService['obtenerPorCodigo']).not.toHaveBeenCalled();
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si no se puede preparar el cobro', async () => {
      await crear(reserva(), {
        payments: {
          aceptarAjuste: jest.fn().mockRejectedValue(new Error('stripe')),
          rechazarAjuste: jest.fn(),
        },
      });

      expect(componente.stripeListo()).toBe(false);
      expect(componente.errorPago()).toContain('No se pudo preparar el cobro');
    });

    it('no debería darse por listo si Stripe no carga', async () => {
      await crear(reserva(), { stripe: { getStripe: jest.fn().mockResolvedValue(null) } });

      expect(componente.stripeListo()).toBe(false);
    });
  });

  describe('pago de la diferencia', () => {
    it('debería marcar el ajuste como pagado', async () => {
      await crear();

      await componente.confirmarPago();

      expect(stripeFake.confirmPayment).toHaveBeenCalled();
      expect(componente.pagado()).toBe(true);
      expect(componente.procesando()).toBe(false);
    });

    it('debería mostrar el motivo del rechazo de la tarjeta', async () => {
      await crear();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Fondos insuficientes' } });

      await componente.confirmarPago();

      expect(componente.errorPago()).toBe('Fondos insuficientes');
      expect(componente.pagado()).toBe(false);
    });

    it('debería negarse a cobrar si Stripe no está listo', async () => {
      await crear(reserva(), { stripe: { getStripe: jest.fn().mockResolvedValue(null) } });

      await componente.confirmarPago();

      expect(componente.pagado()).toBe(false);
      expect(componente.errorPago()).toContain('no está disponible');
    });
  });

  describe('rechazo del ajuste', () => {
    it('debería cancelar la reserva tras confirmar el rechazo', async () => {
      await crear();
      jest.spyOn(window, 'confirm').mockReturnValue(true);

      await componente.rechazar();

      expect(paymentsService['rechazarAjuste']).toHaveBeenCalledWith('r1');
      expect(componente.reserva()?.estado).toBe('cancelada');
      expect(componente.errorCarga()).toContain('reembolsado');
      expect(componente.rechazando()).toBe(false);
    });

    it('no debería rechazar nada si el usuario se echa atrás', async () => {
      await crear();
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      await componente.rechazar();

      // Rechazar cancela la reserva y dispara un reembolso: no puede ser accidental.
      expect(paymentsService['rechazarAjuste']).not.toHaveBeenCalled();
      expect(componente.reserva()?.estado).toBe('ajuste_solicitado');
    });

    it('debería avisar si el rechazo falla', async () => {
      await crear();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      paymentsService['rechazarAjuste'].mockRejectedValue(new Error('500'));

      await componente.rechazar();

      expect(componente.errorPago()).toContain('No se pudo rechazar');
      expect(componente.rechazando()).toBe(false);
    });

    it('no debería llamar al API sin reserva cargada', async () => {
      await crear(new Error('404'));
      jest.spyOn(window, 'confirm').mockReturnValue(true);

      await componente.rechazar();

      expect(paymentsService['rechazarAjuste']).not.toHaveBeenCalled();
    });
  });
  /**
   * El suplemento arrastraba los dos mismos fallos que el resto de cobros: sin
   * `return_url` el 3-D Secure no podía completarse, y sin consultar al
   * servidor el ajuste quedaba aprobado sólo en el navegador.
   */
  describe('cierre del cobro del suplemento', () => {
    it('debería dar a Stripe una url de retorno para el 3-D Secure', async () => {
      await crear();

      await componente.confirmarPago();

      const opciones = stripeFake.confirmPayment.mock.calls[0][0];
      expect(opciones.confirmParams.return_url).toBe(window.location.href);
      expect(opciones.redirect).toBe('if_required');
    });

    it('debería anotar el pago antes de confirmar', async () => {
      await crear();

      await componente.confirmarPago();

      expect(pagoEnCurso['anotar']).toHaveBeenCalledWith('pago-1');
    });

    it('debería cerrar el cobro contra el servidor', async () => {
      await crear();

      await componente.confirmarPago();

      expect(pagoEnCurso['sincronizar']).toHaveBeenCalledWith('pago-1');
      expect(componente.pagado()).toBe(true);
      expect(componente.confirmacionPendiente()).toBe(false);
    });

    it('debería avisar de que el ajuste va con retraso si el servidor no lo cierra', async () => {
      await crear();
      pagoEnCurso['sincronizar'].mockResolvedValue(false);

      await componente.confirmarPago();
      fixture.detectChanges();

      expect(componente.confirmacionPendiente()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('Estamos terminando de aplicar el ajuste');
    });

    it('debería borrar el apunte cuando la tarjeta se rechaza', async () => {
      await crear();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Tarjeta rechazada' } });

      await componente.confirmarPago();

      expect(pagoEnCurso['olvidar']).toHaveBeenCalled();
      expect(componente.pagado()).toBe(false);
    });
  });
});
