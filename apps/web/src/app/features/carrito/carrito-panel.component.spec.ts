import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { VerticalKey } from 'shared';
import { CarritoPanelComponent } from './carrito-panel.component';
import { CarritoService, ItemCarritoApi } from './carrito.service';

const item = (extra: Partial<ItemCarritoApi> = {}): ItemCarritoApi => ({
  itemId: 'i1', servicioId: 's1', comercioId: 'c1', vertical: VerticalKey.ALOJAMIENTO,
  titulo: 'Residencia Royal', precioEstimado: 45, fechaInicio: '2026-09-01',
  ...extra,
} as ItemCarritoApi);

describe('CarritoPanelComponent', () => {
  let fixture: ComponentFixture<CarritoPanelComponent>;
  let componente: CarritoPanelComponent;
  let carrito: Record<string, unknown> & { cargar: jest.Mock; quitar: jest.Mock; checkout: jest.Mock };
  let router: Router;

  const crear = async (items: ItemCarritoApi[] = [item()]): Promise<void> => {
    carrito = {
      items: signal(items),
      total: signal(items.reduce((s, i) => s + i.precioEstimado, 0)),
      cargar: jest.fn().mockResolvedValue(undefined),
      quitar: jest.fn().mockResolvedValue(undefined),
      checkout: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', montoTotal: 90 }),
    };

    await TestBed.configureTestingModule({
      imports: [CarritoPanelComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CarritoService, useValue: carrito },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(CarritoPanelComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('agrupación por comercio', () => {
    it('debería juntar en un grupo los servicios del mismo comercio', async () => {
      await crear([item(), item({ itemId: 'i2', precioEstimado: 30 })]);

      expect(componente.grupos()).toHaveLength(1);
      expect(componente.grupos()[0].items).toHaveLength(2);
      expect(componente.grupos()[0].subtotal).toBe(75);
    });

    it('debería separar los comercios distintos', async () => {
      await crear([item(), item({ itemId: 'i2', comercioId: 'c2', precioEstimado: 20 })]);

      // Cada comercio cobra por separado: mezclarlos falsearía sus liquidaciones.
      expect(componente.grupos()).toHaveLength(2);
      expect(componente.grupos()[1].subtotal).toBe(20);
    });

    it('debería redondear el subtotal a céntimos', async () => {
      await crear([item({ precioEstimado: 10.005 }), item({ itemId: 'i2', precioEstimado: 0.004 })]);

      expect(componente.grupos()[0].subtotal).toBe(10.01);
    });

    it('no debería mostrar grupos con el carrito vacío', async () => {
      await crear([]);

      expect(componente.grupos()).toEqual([]);
    });
  });

  describe('apertura del panel', () => {
    it('debería recargar el carrito al abrirlo', async () => {
      await crear();
      componente.error.set('algo');

      await componente.abrir();

      expect(componente.abierto()).toBe(true);
      expect(componente.error()).toBe('');
      expect(carrito.cargar).toHaveBeenCalled();
    });

    it('debería cerrarse sin tocar el contenido', async () => {
      await crear();
      await componente.abrir();

      componente.cerrar();

      expect(componente.abierto()).toBe(false);
    });
  });

  describe('quitar servicios', () => {
    it('debería quitar el servicio indicado', async () => {
      await crear();

      await componente.quitar(item());

      expect(carrito.quitar).toHaveBeenCalledWith('i1');
      expect(componente.error()).toBe('');
    });

    it('debería nombrar el servicio que no se pudo quitar', async () => {
      await crear();
      carrito.quitar.mockRejectedValue(new Error('500'));

      await componente.quitar(item());

      expect(componente.error()).toContain('Residencia Royal');
    });
  });

  describe('reserva del viaje completo', () => {
    it('debería llevar al pago con el importe del carrito', async () => {
      await crear();
      await componente.abrir();

      await componente.reservar();

      expect(router.navigate).toHaveBeenCalledWith(['/reservas/viaje-pago'], {
        state: { clientSecret: 'cs_1', montoTotal: 90 },
      });
      expect(componente.abierto()).toBe(false);
      expect(componente.procesando()).toBe(false);
    });

    it('debería decir qué servicio se quedó sin plaza', async () => {
      await crear();
      carrito.checkout.mockRejectedValue({ error: { message: 'Residencia Royal ya no tiene plazas' } });

      await componente.reservar();

      expect(componente.error()).toBe('Residencia Royal ya no tiene plazas');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('debería dar un mensaje genérico si el fallo no trae motivo', async () => {
      await crear();
      carrito.checkout.mockRejectedValue({});

      await componente.reservar();

      expect(componente.error()).toContain('No se pudo reservar el viaje');
      expect(componente.procesando()).toBe(false);
    });
  });

  describe('etiquetas', () => {
    it('debería traducir el vertical de cada línea', async () => {
      await crear();

      expect(componente.etiquetaVertical(VerticalKey.ALOJAMIENTO)).not.toBe(VerticalKey.ALOJAMIENTO);
      expect(componente.etiquetaVertical('inventado')).toBe('inventado');
    });
  });
});
