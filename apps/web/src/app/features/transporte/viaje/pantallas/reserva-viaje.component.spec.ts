import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type { Stripe } from '@stripe/stripe-js';
import {
  BusquedaTransportesRespuesta, EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, ModalidadTransporte,
  ModoHorarioTransporte, PatronRecurrenciaTransporte, PersonaContactoViaje, ResultadoTransporte,
  SolicitudPresupuestoVista, TamanoPerro, TipoServicioTransporte, VerticalKey,
} from 'shared';
import { AuthService } from '../../../../core/auth/auth.service';
import { StripeService } from '../../../../core/stripe/stripe.service';
import { ReservasService } from '../../../reservas/services/reservas.service';
import { PaymentsService } from '../../../reservas/services/payments.service';
import { PagoEnCursoService } from '../../../reservas/services/pago-en-curso.service';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { ReservaViajeComponent } from './reserva-viaje.component';

const resultado = (modalidad: ModalidadTransporte, extra: Partial<ResultadoTransporte> = {}): ResultadoTransporte => ({
  servicioId: 's1', comercioId: 'c1', titulo: 'DogVan', rating: 4.5, totalResenas: 8, verificado: true, destacado: false,
  modalidad, estado: 'precio', total: 60, desglose: [{ concepto: 'Trayecto', importe: 50 }, { concepto: 'Nocturno', importe: 10 }],
  incluidos: [], duracionMin: 65, requiereAceptacion: false, cancelacion: { gratisHastaHoras: 24, reembolsoTardioPct: 50 },
  ...extra,
});

const cotizacion = (resultados: ResultadoTransporte[], viajes = 1): BusquedaTransportesRespuesta => ({
  ruta: { km: 70, duracionMin: 65, esEstimacion: false }, viajes, resultados,
});

describe('ReservaViajeComponent', () => {
  let fixture: ComponentFixture<ReservaViajeComponent>;
  let componente: ReservaViajeComponent;
  let store: TransporteViajeStore;
  let router: Router;
  let api: jest.Mocked<Pick<TransporteViajeApi, 'cotizarEmpresa' | 'presupuesto'>>;
  let reservas: jest.Mocked<Pick<ReservasService, 'crear'>>;
  let pagos: jest.Mocked<Pick<PaymentsService, 'configuracion' | 'crearIntent' | 'confirmarSinCobro'>>;
  let pagoEnCurso: jest.Mocked<Pick<PagoEnCursoService, 'anotar' | 'olvidar' | 'sincronizar'>>;
  let stripeService: jest.Mocked<Pick<StripeService, 'getStripe'>>;
  let elementoStripe: { mount: jest.Mock; destroy: jest.Mock };
  let stripeFake: { elements: jest.Mock; confirmPayment: jest.Mock };

  const guardarBorrador = (extra: Record<string, unknown> = {}): void => {
    sessionStorage.setItem('doogking_viaje_transporte', JSON.stringify({
      version: 1,
      borrador: {
        origen: { texto: 'Calle Mayor 1, Madrid', placeId: 'a' }, destino: { texto: 'Zocodover, Toledo', placeId: 'b' },
        fecha: '2999-01-01', modalidad: ModalidadTransporte.COMPARTIDO,
        mascotas: [
          { perroId: 'p1', nombre: 'Hachi', especie: 'perro', tamano: TamanoPerro.GRANDE },
          { perroId: 'p2', nombre: 'Luna', especie: 'perro', tamano: TamanoPerro.MINI },
        ],
        eleccion: { servicioId: 's1', comercioId: 'c1', titulo: 'DogVan', modalidad: ModalidadTransporte.COMPARTIDO, total: 60 },
        ...extra,
      },
    }));
  };

  const crear = async (query: Record<string, string> = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [ReservaViajeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: TransporteViajeApi, useValue: api },
        { provide: ReservasService, useValue: reservas },
        { provide: PaymentsService, useValue: pagos },
        { provide: PagoEnCursoService, useValue: pagoEnCurso },
        { provide: StripeService, useValue: stripeService },
        {
          provide: AuthService,
          useValue: {
            usuario: signal({ id: 'u1', nombre: 'Ana Ruiz', rol: 'cliente', verificado: true }),
            estaAutenticado: signal(true), esComercio: signal(false), esAdmin: signal(false), esCliente: signal(true),
            clienteVerificado: signal(true),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    }).compileComponents();
    store = TestBed.inject(TransporteViajeStore);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ReservaViajeComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Rellena los teléfonos: lo único obligatorio cuando entrega y recibe el propio cliente. */
  const rellenarDatos = (): void => {
    componente.form.patchValue({ recogida: { telefono: '+34 600 000 000' }, entrega: { telefono: '600111222' } });
  };

  beforeEach(() => {
    sessionStorage.clear();
    window.scrollTo = jest.fn();
    api = {
      cotizarEmpresa: jest.fn().mockResolvedValue(cotizacion([
        resultado(ModalidadTransporte.COMPARTIDO), resultado(ModalidadTransporte.EXCLUSIVO, { total: 90 }),
      ])),
      presupuesto: jest.fn(),
    };
    reservas = { crear: jest.fn().mockResolvedValue({ _id: 'r1', codigo: 'RES-T1', montoTotal: 60 }) };
    pagos = {
      configuracion: jest.fn().mockResolvedValue({ bypassPagoHabilitado: true }),
      crearIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs_1', pagoId: 'pago-1', montoTotal: 60, moneda: 'EUR' }),
      confirmarSinCobro: jest.fn().mockResolvedValue(undefined),
    };
    pagoEnCurso = { anotar: jest.fn(), olvidar: jest.fn(), sincronizar: jest.fn().mockResolvedValue(true) };
    elementoStripe = { mount: jest.fn(), destroy: jest.fn() };
    stripeFake = {
      elements: jest.fn(() => ({ create: jest.fn(() => elementoStripe), getElement: jest.fn(() => elementoStripe) })),
      confirmPayment: jest.fn().mockResolvedValue({}),
    };
    stripeService = { getStripe: jest.fn().mockResolvedValue(stripeFake as unknown as Stripe) };
  });

  afterEach(() => {
    fixture?.destroy();
    store?.reiniciar();
    jest.useRealTimers();
  });

  describe('carga', () => {
    it('debería volver a la búsqueda si no hay viaje o empresa elegida', async () => {
      await crear();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte']);
      expect(componente.cargando()).toBe(false);
    });

    it('debería cotizar la empresa elegida con su modalidad y rellenar «Yo» con la cuenta', async () => {
      guardarBorrador();
      await crear();

      expect(api.cotizarEmpresa).toHaveBeenCalledWith('s1', store.solicitud());
      expect(componente.resultado()?.modalidad).toBe(ModalidadTransporte.COMPARTIDO);
      expect(componente.total()).toBe(60);
      expect(componente.titulo()).toBe('DogVan');
      expect(componente.precioCambiado()).toBe(false);
      expect(componente.politicaTexto()).toContain('50');
      expect(componente.resumen().length).toBeGreaterThan(0);
      expect(componente.form.get(['recogida', 'nombre'])?.value).toBe('Ana Ruiz');
      expect(componente.bypassDisponible()).toBe(true);
    });

    it('debería avisar si el precio cambió desde que lo vio', async () => {
      guardarBorrador();
      api.cotizarEmpresa.mockResolvedValue(cotizacion([resultado(ModalidadTransporte.COMPARTIDO, { total: 75 })]));
      await crear();

      expect(componente.precioCambiado()).toBe(true);
    });

    it('debería describir la política sin reembolso tardío', async () => {
      guardarBorrador();
      api.cotizarEmpresa.mockResolvedValue(cotizacion([
        resultado(ModalidadTransporte.COMPARTIDO, { cancelacion: { gratisHastaHoras: 12, reembolsoTardioPct: 0 } }),
      ]));
      await crear();

      expect(componente.politicaTexto()).toContain('no hay reembolso');
    });

    it('debería multiplicar el total por los viajes de la serie', async () => {
      guardarBorrador();
      api.cotizarEmpresa.mockResolvedValue(cotizacion([resultado(ModalidadTransporte.COMPARTIDO)], 3));
      await crear();

      expect(componente.viajes()).toBe(3);
      expect(componente.total()).toBe(180);
    });

    it('debería avisar si la empresa ya no hace esa modalidad', async () => {
      guardarBorrador();
      api.cotizarEmpresa.mockResolvedValue(cotizacion([resultado(ModalidadTransporte.EXCLUSIVO)]));
      await crear();

      expect(componente.errorCarga()).toBeTruthy();
      expect(componente.resultado()).toBeNull();
    });

    it('no debería romper si la configuración de pagos falla', async () => {
      guardarBorrador();
      pagos.configuracion.mockRejectedValue(new Error('500'));
      await crear();

      expect(componente.bypassDisponible()).toBe(false);
    });
  });

  describe('presupuesto aceptado', () => {
    const presupuesto = (extra: Partial<SolicitudPresupuestoVista> = {}): SolicitudPresupuestoVista => ({
      id: 'pr1', codigo: 'PRE-1', vertical: VerticalKey.TRANSPORTE, estado: EstadoSolicitudPresupuesto.ABIERTA,
      fechaServicio: '2999-01-01', createdAt: '2026-09-20T00:00:00.000Z',
      detalle: {
        solicitud: {
          tipoServicio: TipoServicioTransporte.SOLO_IDA,
          origen: { texto: 'Madrid', placeId: 'a' }, destino: { texto: 'París', placeId: 'b' }, fecha: '2999-01-01',
          modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '09:00',
          mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }], necesidades: [],
          modalidad: ModalidadTransporte.EXCLUSIVO, preferencias: [],
        },
      },
      respuestas: [{
        servicioId: 's1', comercioId: 'c1', titulo: 'DogVan', rating: 4, estado: EstadoRespuestaPresupuesto.RESPONDIDA, importe: 320,
      }],
      ...extra,
    });

    it('debería cargar el viaje del presupuesto y cobrar su importe', async () => {
      api.presupuesto.mockResolvedValue(presupuesto());
      api.cotizarEmpresa.mockResolvedValue(cotizacion([resultado(ModalidadTransporte.EXCLUSIVO, { estado: 'presupuesto' })]));
      await crear({ presupuesto: 'pr1', servicio: 's1' });

      expect(api.presupuesto).toHaveBeenCalledWith('pr1');
      expect(store.borrador().presupuestoId).toBe('pr1');
      expect(store.borrador().destino?.texto).toBe('París');
      expect(componente.importePresupuesto()).toBe(320);
      expect(componente.lineas()).toEqual([{ concepto: 'Presupuesto aceptado', importe: 320 }]);
      expect(componente.total()).toBe(320);
      expect(componente.precioCambiado()).toBe(false);
    });

    it('debería avisar si la empresa no respondió con precio', async () => {
      api.presupuesto.mockResolvedValue(presupuesto({ respuestas: [] }));
      await crear({ presupuesto: 'pr1', servicio: 's1' });

      expect(componente.errorCarga()).toBeTruthy();
      expect(api.cotizarEmpresa).not.toHaveBeenCalled();
    });
  });

  describe('datos de recogida y entrega', () => {
    it('no debería pasar al pago sin teléfonos válidos', async () => {
      guardarBorrador();
      await crear();

      await componente.irAPago();
      fixture.detectChanges();

      expect(componente.fase()).toBe('datos');
      expect(componente.invalido('recogida', 'telefono')).toBe(true);
      expect(reservas.crear).not.toHaveBeenCalled();
    });

    it('debería pedir el nombre sólo si entrega otra persona', async () => {
      guardarBorrador();
      await crear();
      rellenarDatos();

      componente.form.patchValue({ entrega: { quien: PersonaContactoViaje.OTRA, nombre: '' } });
      expect(componente.form.valid).toBe(false);
      expect(componente.invalido('entrega', 'nombre')).toBe(false);

      componente.form.patchValue({ entrega: { nombre: 'Luis' } });
      expect(componente.form.valid).toBe(true);

      componente.form.patchValue({ entrega: { quien: PersonaContactoViaje.YO, nombre: '' } });
      expect(componente.form.valid).toBe(true);
      expect(componente.invalido('entrega', 'inexistente')).toBe(false);
    });

    it('debería guardar los datos de entrega en el borrador', async () => {
      guardarBorrador();
      await crear();

      rellenarDatos();

      expect(store.borrador().recogida.telefono).toBe('+34 600 000 000');
    });
  });

  describe('pago', () => {
    it('debería crear la reserva, el intent y montar el formulario de Stripe', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      guardarBorrador();
      await crear();
      rellenarDatos();

      await componente.irAPago();
      jest.runOnlyPendingTimers();

      const payload = reservas.crear.mock.calls[0][0];
      expect(payload).toEqual(expect.objectContaining({
        servicioId: 's1', comercioId: 'c1', vertical: VerticalKey.TRANSPORTE,
        perroId: 'p1', perroIdsAdicionales: ['p2'], cantidad: 1, recurrencia: undefined, presupuestoId: undefined,
      }));
      expect(payload.detalle).toEqual(expect.objectContaining({ origen: 'Calle Mayor 1, Madrid', destino: 'Zocodover, Toledo', perros: 2 }));
      expect(componente.fase()).toBe('pago');
      expect(pagos.crearIntent).toHaveBeenCalledWith('r1');
      expect(stripeFake.elements).toHaveBeenCalledWith({ clientSecret: 'cs_1' });
      expect(elementoStripe.mount).toHaveBeenCalledWith('#stripe-payment-element-transporte');
      expect(componente.stripeListo()).toBe(true);
      expect(componente.codigo()).toBe('RES-T1');
      expect(componente.preparandoPago()).toBe(false);
    });

    it('debería mandar la recurrencia de una serie', async () => {
      guardarBorrador({
        tipoServicio: TipoServicioTransporte.RECURRENTE, patron: PatronRecurrenciaTransporte.MENSUAL, hasta: '2999-06-01',
      });
      await crear();
      rellenarDatos();

      await componente.irAPago();

      expect(reservas.crear.mock.calls[0][0].recurrencia).toEqual({
        diasSemana: [], hora: '10:00', fechaFin: '2999-06-01', mensual: true,
      });
    });

    it('no debería volver a crear la reserva si ya existe', async () => {
      guardarBorrador();
      await crear();
      rellenarDatos();

      await componente.irAPago();
      componente.volverADatos();
      await componente.irAPago();

      expect(componente.fase()).toBe('pago');
      expect(reservas.crear).toHaveBeenCalledTimes(1);
    });

    it('debería avisar si no se puede preparar el pago', async () => {
      guardarBorrador();
      pagos.crearIntent.mockRejectedValue(new Error('500'));
      await crear();
      rellenarDatos();

      await componente.irAPago();

      expect(componente.errorPago()).toBeTruthy();
      expect(componente.stripeListo()).toBe(false);
      expect(componente.preparandoPago()).toBe(false);
    });

    it('debería avisar si Stripe no está disponible', async () => {
      guardarBorrador();
      stripeService.getStripe.mockResolvedValue(null);
      await crear();
      rellenarDatos();

      await componente.irAPago();

      expect(componente.errorPago()).toBeTruthy();
    });

    it('no debería pedir intent si la reserva vuelve sin id', async () => {
      guardarBorrador();
      reservas.crear.mockResolvedValue({ codigo: 'RES-T1', montoTotal: 60 } as Awaited<ReturnType<ReservasService['crear']>>);
      await crear();
      rellenarDatos();

      await componente.irAPago();

      expect(pagos.crearIntent).not.toHaveBeenCalled();
    });

    it('debería cobrar, sincronizar el pago y llevar a la confirmación', async () => {
      guardarBorrador();
      await crear();
      rellenarDatos();
      await componente.irAPago();
      componente.acepto.setValue(true);
      expect(componente.puedePagar()).toBe(true);

      await componente.pagar();

      expect(pagoEnCurso.anotar).toHaveBeenCalledWith('pago-1');
      expect(stripeFake.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}/transporte/viaje/confirmada/RES-T1` },
      }));
      expect(pagoEnCurso.sincronizar).toHaveBeenCalledWith('pago-1');
      expect(pagoEnCurso.olvidar).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/confirmada', 'RES-T1']);
      expect(store.borrador().eleccion).toBeNull();
    });

    it('debería enseñar el error de la tarjeta sin salir del pago', async () => {
      guardarBorrador();
      stripeFake.confirmPayment.mockResolvedValue({ error: { message: 'Tarjeta rechazada' } });
      await crear();
      rellenarDatos();
      await componente.irAPago();

      await componente.pagar();

      expect(componente.errorPago()).toBe('Tarjeta rechazada');
      expect(componente.procesando()).toBe(false);
      expect(pagoEnCurso.olvidar).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalledWith(['/transporte/viaje/confirmada', 'RES-T1']);
    });

    it('debería dar un mensaje genérico si Stripe no explica el error', async () => {
      guardarBorrador();
      stripeFake.confirmPayment.mockResolvedValue({ error: {} });
      await crear();
      rellenarDatos();
      await componente.irAPago();

      await componente.pagar();

      expect(componente.errorPago()).toContain('No se pudo procesar el pago');
    });

    it('no debería cobrar sin Stripe preparado', async () => {
      guardarBorrador();
      await crear();

      await componente.pagar();

      expect(stripeFake.confirmPayment).not.toHaveBeenCalled();
    });

    it('debería confirmar sin cobro en los entornos que lo permiten', async () => {
      guardarBorrador();
      await crear();
      rellenarDatos();
      await componente.irAPago();

      await componente.confirmarSinPagar();

      expect(pagos.confirmarSinCobro).toHaveBeenCalledWith('r1');
      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/confirmada', 'RES-T1']);
    });

    it('debería avisar si la confirmación sin cobro falla y no hacer nada sin reserva', async () => {
      guardarBorrador();
      await crear();

      await componente.confirmarSinPagar();
      expect(pagos.confirmarSinCobro).not.toHaveBeenCalled();

      rellenarDatos();
      await componente.irAPago();
      pagos.confirmarSinCobro.mockRejectedValue(new Error('403'));
      await componente.confirmarSinPagar();

      expect(componente.errorPago()).toContain('sin pago');
      expect(componente.procesando()).toBe(false);
    });

    it('debería desmontar el formulario de Stripe al salir', async () => {
      guardarBorrador();
      await crear();
      rellenarDatos();
      await componente.irAPago();

      fixture.destroy();

      expect(elementoStripe.destroy).toHaveBeenCalled();
    });
  });
});
