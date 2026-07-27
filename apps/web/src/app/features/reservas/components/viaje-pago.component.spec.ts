import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ViajePagoComponent } from './viaje-pago.component';
import { StripeService } from '../../../core/stripe/stripe.service';
import { CarritoService } from '../../carrito/carrito.service';

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

  const crear = async (
    estado: Record<string, unknown> | null = { clientSecret: 'cs_1', montoTotal: 242 },
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    stripeService = { getStripe: jest.fn().mockResolvedValue(stripeFake), ...ajustes };
    carrito = { cargar: jest.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [ViajePagoComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StripeService, useValue: stripeService },
        { provide: CarritoService, useValue: carrito },
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
      expect(router.navigate).toHaveBeenCalledWith(['/reservas']);
    });

    it('debería incluir la url de retorno para el 3-D Secure', async () => {
      await crear();

      await componente.pagar();

      const opciones = stripeFake.confirmPayment.mock.calls[0][0];
      expect(opciones.confirmParams.return_url).toContain('/reservas');
    });

    it('debería mostrar el motivo del rechazo sin navegar', async () => {
      await crear();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Tarjeta rechazada' } });

      await componente.pagar();

      expect(componente.error()).toBe('Tarjeta rechazada');
      expect(componente.procesando()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('no debería cobrar nada si el formulario no llegó a montarse', async () => {
      await crear({});

      await componente.pagar();

      expect(stripeFake.confirmPayment).not.toHaveBeenCalled();
    });
  });
});
