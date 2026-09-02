import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ViajePagoComponent } from './viaje-pago.component';
import { StripeService } from '../../../core/stripe/stripe.service';
import { CarritoService } from '../../carrito/carrito.service';
import { PagoEnCursoService } from '../services/pago-en-curso.service';

describe('ViajePagoComponent', () => {
  let fixture: ComponentFixture<ViajePagoComponent>;
  let componente: ViajePagoComponent;
  let stripeService: Record<string, jest.Mock>;
  let carrito: Record<string, jest.Mock>;
  let router: Router;

  const elemento = { mount: jest.fn() };
  const stripeFake = {
    elements: jest.fn(() => ({ create: jest.fn(() => elemento) })),
    confirmPayment: jest.fn().mockResolvedValue({}),
  };

  let pagoEnCurso: Record<string, jest.Mock>;

  const crear = async (
    estado: Record<string, unknown> | null = { clientSecret: 'cs_1', montoTotal: 242, pagoId: 'pago-1' },
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    stripeService = { getStripe: jest.fn().mockResolvedValue(stripeFake), ...ajustes };
    carrito = { cargar: jest.fn().mockResolvedValue(undefined) };
    pagoEnCurso = {
      anotar: jest.fn(),
      olvidar: jest.fn(),
      pendiente: jest.fn().mockReturnValue(null),
      sincronizar: jest.fn().mockResolvedValue(true),
      cerrarPendiente: jest.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [ViajePagoComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StripeService, useValue: stripeService },
        { provide: CarritoService, useValue: carrito },
        { provide: PagoEnCursoService, useValue: pagoEnCurso },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    // El importe viaja en el estado de navegación, no por la URL.
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue(
      estado ? ({ extras: { state: estado } } as never) : null,
    );

    fixture = TestBed.createComponent(ViajePagoComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    for (let i = 0; i < 3; i++) await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    stripeFake.confirmPayment.mockResolvedValue({});
  });

  describe('montaje', () => {
    it('debería preparar el formulario con el secreto recibido', async () => {
      await crear();

      expect(componente.clientSecret()).toBe('cs_1');
      expect(componente.montoTotal()).toBe(242);
      expect(stripeFake.elements).toHaveBeenCalledWith({ clientSecret: 'cs_1' });
      expect(componente.listo()).toBe(true);
    });

    it('no debería montar nada sin secreto de pago', async () => {
      await crear({});

      expect(componente.listo()).toBe(false);
      expect(stripeService['getStripe']).not.toHaveBeenCalled();
    });

    it('debería avisar si el SDK de pago no carga', async () => {
      await crear({ clientSecret: 'cs_1' }, { getStripe: jest.fn().mockResolvedValue(null) });

      expect(componente.error()).toContain('No se pudo cargar el formulario de pago');
      expect(componente.listo()).toBe(false);
    });

    it('debería asumir importe cero si no viaja en el estado', async () => {
      await crear({ clientSecret: 'cs_1' });

      expect(componente.montoTotal()).toBe(0);
    });
  });

  describe('pago', () => {
    it('debería confirmar el pago y volver a las reservas', async () => {
      await crear();

      await componente.pagar();

      expect(stripeFake.confirmPayment).toHaveBeenCalled();
      // El carrito se recarga: sus líneas ya son reservas.
      expect(carrito['cargar']).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/reservas'], { queryParams: {} });
    });

    /*
     * El paso que faltaba: se navegaba al listado nada más confirmar en el
     * navegador, y las reservas del viaje se quedaban «pendientes» hasta que
     * llegara el webhook —en local, nunca— con el dinero ya cobrado.
     */
    it('debería cerrar el cobro contra el servidor antes de volver al listado', async () => {
      await crear();

      await componente.pagar();

      expect(pagoEnCurso['cerrarPendiente']).toHaveBeenCalled();
    });

    it('debería anotar el pago antes de confirmar, para sobrevivir al 3-D Secure', async () => {
      // Si la tarjeta pide autenticación, esta instancia deja de existir con el
      // `pagoId` dentro: el apunte es lo único que queda al volver.
      await crear();

      await componente.pagar();

      expect(pagoEnCurso['anotar']).toHaveBeenCalledWith('pago-1');
    });

    it('debería avisar de que la confirmación va con retraso si el servidor no la cierra', async () => {
      await crear();
      pagoEnCurso['cerrarPendiente'].mockResolvedValue(false);

      await componente.pagar();

      expect(router.navigate).toHaveBeenCalledWith(
        ['/reservas'], { queryParams: { confirmacionPendiente: 1 } },
      );
    });

    it('debería incluir la url de retorno para el 3-D Secure', async () => {
      await crear();

      await componente.pagar();

      const opciones = stripeFake.confirmPayment.mock.calls[0][0];
      // Vuelve a esta misma pantalla, que es la que sabe cerrar el pago.
      expect(opciones.confirmParams.return_url).toBe(window.location.href);
      // Sin esto todo pago se iba por recarga completa, incluso los que no la
      // necesitan, y se perdía el resultado que Stripe ya había devuelto.
      expect(opciones.redirect).toBe('if_required');
    });

    it('debería mostrar el motivo del rechazo sin navegar', async () => {
      await crear();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Tarjeta rechazada' } });

      await componente.pagar();

      expect(componente.error()).toBe('Tarjeta rechazada');
      expect(componente.procesando()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('debería borrar el apunte cuando el pago se rechaza', async () => {
      // El viaje sigue reservado en pendiente y sus retenciones caducan solas:
      // dejar el apunte haría que la siguiente pantalla creyera que hay cobro.
      await crear();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Tarjeta rechazada' } });

      await componente.pagar();

      expect(pagoEnCurso['olvidar']).toHaveBeenCalled();
    });

    it('no debería cobrar nada si el formulario no llegó a montarse', async () => {
      await crear({});

      await componente.pagar();

      expect(stripeFake.confirmPayment).not.toHaveBeenCalled();
    });
  });

  /**
   * Stripe devuelve al usuario aquí con la página recargada: no queda ni la
   * instancia ni el `pagoId`, sólo el apunte de sesión y los parámetros que
   * trae la URL.
   */
  describe('vuelta de la autenticación de la tarjeta', () => {
    const conRetorno = async (): Promise<void> => {
      const original = window.location.search;
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?payment_intent=pi_1&redirect_status=succeeded' },
        writable: true,
      });
      try {
        await crear(null);
      } finally {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, search: original },
          writable: true,
        });
      }
    };

    it('debería cerrar el pago contra el servidor y llevar al listado', async () => {
      await conRetorno();

      expect(pagoEnCurso['cerrarPendiente']).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/reservas'], { queryParams: {} });
    });

    it('no debería volver a montar el formulario de una tarjeta ya cobrada', async () => {
      await conRetorno();

      expect(stripeService['getStripe']).not.toHaveBeenCalled();
    });
  });
  /**
   * La misma pantalla cobra una reserva suelta que se quedó sin pagar: cambia
   * el texto, no el mecanismo.
   */
  describe('reserva suelta pendiente de pago', () => {
    it('debería usar el texto que trae quien navega', async () => {
      await crear({
        clientSecret: 'cs_1', montoTotal: 121, pagoId: 'pago-1',
        titulo: 'Completa el pago de tu reserva',
        descripcion: 'Tu reserva está guardada y se confirmará en cuanto entre el pago.',
      });

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('Completa el pago de tu reserva');
      expect(texto).not.toContain('Confirma tu viaje');
    });

    it('debería hablar del viaje cuando no se le dice otra cosa', async () => {
      await crear();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Confirma tu viaje');
    });

    it('debería cobrar y cerrar igual que el viaje', async () => {
      await crear({
        clientSecret: 'cs_1', montoTotal: 121, pagoId: 'pago-1',
        titulo: 'Completa el pago de tu reserva',
      });

      await componente.pagar();

      expect(pagoEnCurso['anotar']).toHaveBeenCalledWith('pago-1');
      expect(pagoEnCurso['cerrarPendiente']).toHaveBeenCalled();
    });
  });
});
