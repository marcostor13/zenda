import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReservaEstado, VerticalKey } from 'shared';
import { ReservaDetalleComponent } from './reserva-detalle.component';
import { ReservaApi, ReservasService } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';

const reserva = (extra: Partial<ReservaApi> = {}): ReservaApi => ({
  _id: 'r1', codigo: 'RES-AAAA1111', vertical: VerticalKey.ALOJAMIENTO,
  servicioId: 'abcdef123456', comercioId: 'c1',
  montoSubtotal: 100, comisionMonto: 15, descuentoMonto: 0, montoTotal: 121, moneda: 'EUR',
  fechaInicio: '2026-09-01T00:00:00.000Z', cantidad: 1,
  estado: ReservaEstado.CONFIRMADA,
  createdAt: '2026-07-01T09:00:00.000Z',
  ...extra,
});

describe('ReservaDetalleComponent', () => {
  let fixture: ComponentFixture<ReservaDetalleComponent>;
  let componente: ReservaDetalleComponent;
  let reservasService: Record<string, jest.Mock>;
  let paymentsService: Record<string, jest.Mock>;
  let router: Router;

  const crear = async (datos: ReservaApi | Error = reserva()): Promise<void> => {
    reservasService = {
      obtenerPorCodigo: datos instanceof Error
        ? jest.fn().mockRejectedValue(datos)
        : jest.fn().mockResolvedValue(datos),
      cancelar: jest.fn().mockResolvedValue(reserva({ estado: ReservaEstado.CANCELADA })),
    };
    paymentsService = { crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1' }) };

    await TestBed.configureTestingModule({
      imports: [ReservaDetalleComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservasService },
        { provide: PaymentsService, useValue: paymentsService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ codigo: 'RES-AAAA1111' }) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ReservaDetalleComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('carga', () => {
    it('debería buscar la reserva por su código', async () => {
      await crear();

      expect(reservasService['obtenerPorCodigo']).toHaveBeenCalledWith('RES-AAAA1111');
      expect(componente.reserva()?.codigo).toBe('RES-AAAA1111');
      expect(componente.cargando()).toBe(false);
    });

    it('debería tratar por igual "no existe" y "no es tuya"', async () => {
      await crear(new Error('403'));

      // Distinguirlos filtraría códigos de reserva ajenos.
      expect(componente.error()).toContain('no tienes permiso');
      expect(componente.reserva()).toBeNull();
    });
  });

  describe('importes', () => {
    it('debería derivar el IVA de la diferencia con el subtotal', async () => {
      await crear(reserva({ montoSubtotal: 100, montoTotal: 121, descuentoMonto: 0 }));

      expect(componente.iva()).toBe(21);
    });

    it('debería contar el descuento al calcular el IVA', async () => {
      await crear(reserva({ montoSubtotal: 100, descuentoMonto: 20, montoTotal: 96.8 }));

      // El IVA se aplica sobre el importe ya descontado, no sobre el bruto.
      expect(componente.iva()).toBeCloseTo(16.8, 2);
    });
  });

  describe('presentación', () => {
    it('debería usar el título del servicio cuando viene en el detalle', async () => {
      await crear(reserva({ detalle: { titulo: 'Residencia Royal' } }));

      expect(componente.servicioTitulo()).toBe('Residencia Royal');
    });

    it('debería construir un nombre reconocible si no hay título', async () => {
      await crear(reserva({ servicioId: 'abcdef123456' }));

      expect(componente.servicioTitulo()).toContain('123456');
    });

    it('debería etiquetar los verticales conocidos y tolerar los que no', async () => {
      await crear(reserva({ vertical: 'inventado' as VerticalKey }));

      expect(componente.verticalMeta().label).toBe('inventado');
      expect(componente.verticalMeta().icon).toBe('paw');
    });

    it('debería expresar la estancia en noches', async () => {
      await crear(reserva({ fechaInicio: '2026-09-01T00:00:00.000Z', fechaFin: '2026-09-04T00:00:00.000Z' }));

      expect(componente.duracion()).toBe('3 noches');
    });

    it('debería usar el singular con una sola noche', async () => {
      await crear(reserva({ fechaInicio: '2026-09-01T00:00:00.000Z', fechaFin: '2026-09-02T00:00:00.000Z' }));

      expect(componente.duracion()).toBe('1 noche');
    });

    it('debería expresar las citas del mismo día en horas', async () => {
      await crear(reserva({
        vertical: VerticalKey.PELUQUERIA,
        fechaInicio: '2026-09-01T10:00:00.000Z', fechaFin: '2026-09-01T12:00:00.000Z',
      }));

      expect(componente.duracion()).toBe('2 horas');
    });

    it('no debería mostrar duración sin fecha de fin', async () => {
      await crear(reserva({ fechaFin: undefined }));

      expect(componente.duracion()).toBe('');
    });

    it('debería traducir el detalle del vertical a etiquetas legibles', async () => {
      await crear(reserva({
        detalle: { origen: 'Madrid', destino: 'Toledo', distanciaKm: 70, titulo: 'x', hora: '' },
      }));

      const claves = componente.detalleExtra().map((d) => d.key);
      expect(claves).toEqual(['origen', 'destino', 'distanciaKm']);
      expect(componente.detalleExtra()[2].label).toBe('Distancia (km)');
    });

    it('debería mostrar tal cual las claves sin etiqueta conocida', async () => {
      await crear(reserva({ detalle: { campoNuevo: 'valor' } }));

      expect(componente.detalleExtra()[0]).toMatchObject({ label: 'campoNuevo', valor: 'valor' });
    });

    it('debería dar el pago por recibido en una reserva confirmada', async () => {
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      expect(componente.pagoLabel()).toBe('Pago recibido');
      expect(componente.pagoIcon()).toBe('check-circle');
    });

    it('debería marcar el pago como cancelado si lo está la reserva', async () => {
      await crear(reserva({ estado: ReservaEstado.CANCELADA }));

      expect(componente.pagoLabel()).toBe('Pago cancelado');
      expect(componente.pagoIcon()).toBe('x-circle');
    });

    it('debería dejar el pago como pendiente mientras no se confirme', async () => {
      await crear(reserva({ estado: ReservaEstado.PENDIENTE }));

      expect(componente.pagoLabel()).toBe('Pendiente de pago');
      expect(componente.pagoIcon()).toBe('clock');
    });

    it('debería traducir los hitos del seguimiento', async () => {
      await crear();

      expect(componente.hitoLabel('hito_inexistente')).toBe('hito_inexistente');
    });

    it('debería exponer el seguimiento recibido', async () => {
      await crear(reserva({ seguimiento: [{ hito: 'entrada', at: '2026-09-01T10:00:00.000Z' }] } as never));

      expect(componente.seguimiento()).toHaveLength(1);
    });
  });

  describe('cancelación', () => {
    it('debería permitir cancelar una reserva confirmada', async () => {
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      expect(componente.puedeCancelar()).toBe(true);
    });

    it('no debería permitir cancelar un servicio ya prestado', async () => {
      await crear(reserva({ estado: ReservaEstado.COMPLETADA }));

      expect(componente.puedeCancelar()).toBe(false);
    });

    it('debería reflejar el nuevo estado tras cancelar', async () => {
      await crear();

      await componente.cancelar();

      expect(reservasService['cancelar']).toHaveBeenCalledWith('r1');
      expect(componente.reserva()?.estado).toBe(ReservaEstado.CANCELADA);
      expect(componente.cancelando()).toBe(false);
    });

    it('debería avisar si la cancelación falla', async () => {
      await crear();
      reservasService['cancelar'].mockRejectedValue(new Error('política'));

      await componente.cancelar();

      expect(componente.errorAccion()).toContain('No se pudo cancelar');
      expect(componente.reserva()?.estado).toBe(ReservaEstado.CONFIRMADA);
    });

    it('no debería llamar al API sin reserva cargada', async () => {
      await crear(new Error('404'));

      await componente.cancelar();

      expect(reservasService['cancelar']).not.toHaveBeenCalled();
    });
  });

  describe('pago pendiente', () => {
    it('debería llevar al paso de pago del wizard', async () => {
      await crear(reserva({ estado: ReservaEstado.PENDIENTE }));

      await componente.irAPagar();

      expect(paymentsService['crearIntent']).toHaveBeenCalledWith('r1');
      expect(router.navigate).toHaveBeenCalledWith(
        ['/reservas', VerticalKey.ALOJAMIENTO, 'abcdef123456'],
        { queryParams: { reservaId: 'r1', paso: 3 } },
      );
    });

    it('debería avisar sin navegar si el intent falla', async () => {
      await crear(reserva({ estado: ReservaEstado.PENDIENTE }));
      paymentsService['crearIntent'].mockRejectedValue(new Error('stripe'));

      await componente.irAPagar();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(componente.errorAccion()).toContain('No se pudo iniciar el pago');
      expect(componente.procesando()).toBe(false);
    });
  });

  describe('seguimiento en vivo', () => {
    /** Captura el ciclo de sondeo sin depender del reloj real. */
    const espiarSondeo = () => {
      const espia = { ciclo: undefined as (() => void) | undefined, id: 'poll-1', ms: 0 };
      jest.spyOn(global, 'setInterval').mockImplementation(((cb: () => void, ms: number) => {
        espia.ciclo = cb;
        espia.ms = ms;
        return espia.id;
      }) as never);
      jest.spyOn(global, 'clearInterval').mockImplementation((() => undefined) as never);
      return espia;
    };

    afterEach(() => jest.restoreAllMocks());

    it('debería refrescar la reserva mientras el servicio está activo', async () => {
      const sondeo = espiarSondeo();
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      reservasService['obtenerPorCodigo'].mockResolvedValue(
        reserva({ seguimiento: [{ hito: 'salida_paseo', at: '2026-09-01T11:00:00.000Z' }] } as never),
      );
      await sondeo.ciclo!();

      expect(sondeo.ms).toBe(15000);
      expect(reservasService['obtenerPorCodigo']).toHaveBeenCalledTimes(2);
      expect(componente.seguimiento()).toHaveLength(1);
    });

    it('debería aguantar un fallo puntual de red sin borrar lo que ya mostraba', async () => {
      const sondeo = espiarSondeo();
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      reservasService['obtenerPorCodigo'].mockRejectedValue(new Error('timeout'));
      await sondeo.ciclo!();

      expect(componente.reserva()?.codigo).toBe('RES-AAAA1111');
    });

    it('debería dejar de sondear cuando la reserva termina', async () => {
      const sondeo = espiarSondeo();
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      reservasService['obtenerPorCodigo'].mockResolvedValue(reserva({ estado: ReservaEstado.COMPLETADA }));
      await sondeo.ciclo!();

      expect(global.clearInterval).toHaveBeenCalledWith(sondeo.id);
    });

    it('no debería sondear una reserva ya terminada', async () => {
      espiarSondeo();
      await crear(reserva({ estado: ReservaEstado.COMPLETADA }));

      // Sondear lo que ya no puede cambiar es tráfico y batería tirados.
      expect(global.setInterval).not.toHaveBeenCalled();
    });

    it('debería detener el sondeo al destruir la pantalla', async () => {
      const sondeo = espiarSondeo();
      await crear(reserva({ estado: ReservaEstado.CONFIRMADA }));

      fixture.destroy();

      expect(global.clearInterval).toHaveBeenCalledWith(sondeo.id);
    });
  });
});
