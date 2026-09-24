import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { ReservaEstado, VerticalKey } from 'shared';
import { ReservaDetalleComponent } from './reserva-detalle.component';
import { ReservaApi, ReservasService } from '../services/reservas.service';
import { PaymentsService } from '../services/payments.service';
import { TransporteViajeApi } from '../../transporte/viaje/transporte-viaje.api';

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
  let viajeApi: jest.Mocked<Pick<TransporteViajeApi, 'vistaPreviaCancelacion' | 'cancelar' | 'contacto' | 'ubicacion'>>;
  let router: Router;

  const crear = async (datos: ReservaApi | Error = reserva()): Promise<void> => {
    reservasService = {
      obtenerPorCodigo: datos instanceof Error
        ? jest.fn().mockRejectedValue(datos)
        : jest.fn().mockResolvedValue(datos),
      cancelar: jest.fn().mockResolvedValue(reserva({ estado: ReservaEstado.CANCELADA })),
    };
    viajeApi = {
      vistaPreviaCancelacion: jest.fn().mockResolvedValue({ porcentaje: 100, importe: 121, motivo: 'Con más de 24 h' }),
      cancelar: jest.fn().mockResolvedValue(reserva({ estado: ReservaEstado.CANCELADA })),
      contacto: jest.fn().mockResolvedValue({ nombre: 'Ana', telefono: '+34 600 000 000' }),
      ubicacion: jest.fn().mockResolvedValue({ compartiendo: false, rastro: [] }),
    };
    paymentsService = {
      crearIntent: jest.fn().mockResolvedValue({
        clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 121, moneda: 'EUR',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ReservaDetalleComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReservasService, useValue: reservasService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: TransporteViajeApi, useValue: viajeApi },
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

    it('debería desglosar el IVA contenido en el total, no sumarlo', async () => {
      // Los precios se anuncian con el impuesto incluido: `montoSubtotal` es la
      // base imponible que ya viaja dentro de lo cobrado.
      await crear(reserva({ montoSubtotal: 100, descuentoMonto: 20, montoTotal: 121 }));

      expect(componente.iva()).toBeCloseTo(21, 2);
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

    it('debería consultar primero cuánto se devolvería, sin cancelar', async () => {
      await crear();

      await componente.cancelar();

      expect(viajeApi.vistaPreviaCancelacion).toHaveBeenCalledWith('r1');
      expect(viajeApi.cancelar).not.toHaveBeenCalled();
      expect(componente.previaCancelacion()).toEqual({ porcentaje: 100, importe: 121, motivo: 'Con más de 24 h' });
      expect(componente.cancelando()).toBe(false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cancelacion-previa')).not.toBeNull();
    });

    it('debería avisar de que no hay reembolso si la política no devuelve nada', async () => {
      await crear();
      viajeApi.vistaPreviaCancelacion.mockResolvedValue({ porcentaje: 0, importe: 0, motivo: 'Fuera de plazo' });

      await componente.cancelar();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cancelacion-previa').textContent).toContain('no hay reembolso');
    });

    it('debería avisar si no se puede consultar la cancelación', async () => {
      await crear();
      viajeApi.vistaPreviaCancelacion.mockRejectedValue(new Error('red'));

      await componente.cancelar();

      expect(componente.errorAccion()).toBeTruthy();
      expect(componente.previaCancelacion()).toBeNull();
      expect(componente.cancelando()).toBe(false);
    });

    it('debería reflejar el nuevo estado tras confirmar la cancelación', async () => {
      await crear();
      await componente.cancelar();

      await componente.confirmarCancelacion();

      expect(viajeApi.cancelar).toHaveBeenCalledWith('r1');
      expect(componente.reserva()?.estado).toBe(ReservaEstado.CANCELADA);
      expect(componente.previaCancelacion()).toBeNull();
      expect(componente.cancelando()).toBe(false);
    });

    it('debería avisar si la cancelación falla y mantener la reserva', async () => {
      await crear();
      await componente.cancelar();
      viajeApi.cancelar.mockRejectedValue(new Error('política'));

      await componente.confirmarCancelacion();

      expect(componente.errorAccion()).toBeTruthy();
      expect(componente.reserva()?.estado).toBe(ReservaEstado.CONFIRMADA);
      expect(componente.previaCancelacion()).not.toBeNull();
    });

    it('no debería llamar al API sin reserva cargada', async () => {
      await crear(new Error('404'));

      await componente.cancelar();
      await componente.confirmarCancelacion();

      expect(viajeApi.vistaPreviaCancelacion).not.toHaveBeenCalled();
      expect(viajeApi.cancelar).not.toHaveBeenCalled();
    });

    it('debería mostrar el reembolso hecho de una reserva cancelada', async () => {
      await crear(reserva({
        estado: ReservaEstado.CANCELADA, reembolso: { porcentaje: 50, importe: 60.5, motivo: 'Tarde' },
      } as never));

      expect(fixture.nativeElement.textContent).toContain('Tarde');
    });
  });

  describe('transporte', () => {
    it('debería pintar el seguimiento del viaje en lugar del genérico', async () => {
      await crear(reserva({
        vertical: VerticalKey.TRANSPORTE,
        seguimiento: [{ hito: 'recogida', at: '2026-09-01T10:00:00.000Z' }],
      } as never));

      expect(componente.esTransporte()).toBe(true);
      expect(fixture.nativeElement.querySelector('app-seguimiento-viaje')).not.toBeNull();
      expect(viajeApi.contacto).toHaveBeenCalledWith('r1');
    });

    it('no debería pintar el seguimiento de viaje en otros verticales', async () => {
      await crear();

      expect(componente.esTransporte()).toBe(false);
      expect(fixture.nativeElement.querySelector('app-seguimiento-viaje')).toBeNull();
    });

    it('debería desglosar el precio y contar los viajes de la serie', async () => {
      await crear(reserva({
        vertical: VerticalKey.TRANSPORTE,
        detalle: { desglose: [{ concepto: 'Trayecto', importe: 40 }, { concepto: 'Nocturno', importe: 10 }], viajes: 3 },
      }));

      expect(componente.desglose()).toHaveLength(2);
      expect(componente.viajesSerie()).toBe(3);
      expect(fixture.nativeElement.querySelector('.price-row--nota')).not.toBeNull();
    });

    it('debería tolerar un detalle sin desglose ni viajes', async () => {
      await crear(reserva({ detalle: { desglose: 'raro' } }));

      expect(componente.desglose()).toEqual([]);
      expect(componente.viajesSerie()).toBe(1);
    });

    it('debería usar el resumen legible del vertical si lo hay', async () => {
      await crear(reserva({
        detalle: { resumen: [['Origen', 'Madrid'], ['Destino', 'Toledo']], origen: 'otro' },
      }));

      expect(componente.detalleExtra()).toEqual([
        { key: 'resumen-0', label: 'Origen', valor: 'Madrid' },
        { key: 'resumen-1', label: 'Destino', valor: 'Toledo' },
      ]);
    });

    it('debería ignorar los valores que son objetos', async () => {
      await crear(reserva({ detalle: { solicitud: { a: 1 }, origen: 'Madrid', viajes: 2 } }));

      expect(componente.detalleExtra().map((d) => d.key)).toEqual(['origen']);
    });
  });

  describe('pago pendiente', () => {
    /*
     * Antes se creaba el intent, se tiraba la respuesta y se mandaba al
     * asistente de reserva con `reservaId` y `paso` en la query —dos parámetros
     * que el asistente no lee—: el cliente aterrizaba en el paso 1 y, al llegar
     * al pago, se creaba una segunda reserva. La original nunca se cobraba.
     */
    it('debería llevar a cobrar esta misma reserva, con el secreto del intent', async () => {
      await crear(reserva({ estado: ReservaEstado.PENDIENTE }));

      await componente.irAPagar();

      expect(paymentsService['crearIntent']).toHaveBeenCalledWith('r1');
      expect(router.navigate).toHaveBeenCalledWith(
        ['/reservas', 'pagar'],
        expect.objectContaining({
          state: expect.objectContaining({
            clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 121,
          }),
        }),
      );
    });

    it('no debería volver a pasar por el asistente de reserva', async () => {
      // Repetirlo crearía una segunda reserva por la misma estancia.
      await crear(reserva({ estado: ReservaEstado.PENDIENTE }));

      await componente.irAPagar();

      const destino = (router.navigate as jest.Mock).mock.calls[0][0] as string[];
      expect(destino).not.toContain(VerticalKey.ALOJAMIENTO);
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
