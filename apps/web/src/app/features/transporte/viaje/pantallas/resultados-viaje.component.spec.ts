import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import {
  BusquedaTransportesRespuesta, ModalidadTransporte, OrdenTransporte, PreferenciaTransporte, ResultadoTransporte,
} from 'shared';
import { AuthService } from '../../../../core/auth/auth.service';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { ResultadosViajeComponent } from './resultados-viaje.component';

const resultado = (id: string, modalidad: ModalidadTransporte, extra: Partial<ResultadoTransporte> = {}): ResultadoTransporte => ({
  servicioId: id, comercioId: `c-${id}`, titulo: `Empresa ${id}`, rating: 4.5, totalResenas: 8, verificado: true,
  destacado: false, modalidad, estado: 'precio', total: 60, desglose: [{ concepto: 'Trayecto', importe: 60 }],
  incluidos: [PreferenciaTransporte.CLIMATIZACION], duracionMin: 65, requiereAceptacion: false,
  cancelacion: { gratisHastaHoras: 24, reembolsoTardioPct: 0 },
  ...extra,
});

const RESPUESTA: BusquedaTransportesRespuesta = {
  ruta: { km: 70, duracionMin: 65, esEstimacion: false },
  viajes: 1,
  resultados: [
    resultado('s1', ModalidadTransporte.COMPARTIDO),
    resultado('s2', ModalidadTransporte.EXCLUSIVO, { incluidos: [PreferenciaTransporte.SEGUIMIENTO], total: 95 }),
    resultado('s3', ModalidadTransporte.COMPARTIDO, { estado: 'presupuesto', motivoPresupuesto: 'Internacional' }),
  ],
};

describe('ResultadosViajeComponent', () => {
  let fixture: ComponentFixture<ResultadosViajeComponent>;
  let componente: ResultadosViajeComponent;
  let store: TransporteViajeStore;
  let router: Router;
  let api: jest.Mocked<Pick<TransporteViajeApi, 'buscar' | 'pedirPresupuesto'>>;
  let autenticado: ReturnType<typeof signal<boolean>>;

  const guardarBorrador = (extra: Record<string, unknown> = {}): void => {
    sessionStorage.setItem('doogking_viaje_transporte', JSON.stringify({
      version: 1,
      borrador: {
        origen: { texto: 'Calle Mayor 1, Madrid', placeId: 'a' }, destino: { texto: 'Zocodover, Toledo', placeId: 'b' },
        fecha: '2999-01-01', ...extra,
      },
    }));
  };

  const crear = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [ResultadosViajeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: TransporteViajeApi, useValue: api },
        { provide: AuthService, useValue: { estaAutenticado: autenticado, usuario: signal(null), esComercio: signal(false), esAdmin: signal(false), esCliente: signal(true) } },
      ],
    }).compileComponents();
    store = TestBed.inject(TransporteViajeStore);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResultadosViajeComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    sessionStorage.clear();
    autenticado = signal(true);
    api = {
      buscar: jest.fn().mockResolvedValue(RESPUESTA),
      pedirPresupuesto: jest.fn().mockResolvedValue({ id: 'pr1' }),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    store?.reiniciar();
  });

  it('debería volver a la pantalla 1 sin solicitud', async () => {
    await crear();

    expect(router.navigate).toHaveBeenCalledWith(['/transporte']);
    expect(api.buscar).not.toHaveBeenCalled();
  });

  describe('búsqueda', () => {
    it('debería buscar al entrar y filtrar por la modalidad pedida en la pantalla 2', async () => {
      guardarBorrador({ modalidad: ModalidadTransporte.COMPARTIDO });
      await crear();

      expect(api.buscar).toHaveBeenCalledWith(store.solicitud(), OrdenTransporte.RECOMENDADOS);
      expect(componente.cargando()).toBe(false);
      expect(componente.filtrados().map((r) => r.servicioId)).toEqual(['s1', 's3']);
      expect(componente.ocultosPorFiltros()).toBe(1);
      expect(componente.conPresupuesto().map((r) => r.servicioId)).toEqual(['s3']);
      expect(componente.origen()).toBe('Calle Mayor 1');
      expect(componente.horaRecogida()).toBe('10:00');
    });

    it('debería recuperar los filtros guardados y las preferencias como incluidos', async () => {
      guardarBorrador({ filtroModalidad: ModalidadTransporte.EXCLUSIVO, preferencias: [PreferenciaTransporte.SEGUIMIENTO] });
      await crear();

      expect(componente.filtrados().map((r) => r.servicioId)).toEqual(['s2']);
      expect(componente.filtroIncluidos.value).toEqual([PreferenciaTransporte.SEGUIMIENTO]);
    });

    it('debería volver a buscar al cambiar el orden y guardarlo', async () => {
      guardarBorrador();
      await crear();

      componente.orden.setValue(OrdenTransporte.PRECIO);
      await fixture.whenStable();

      expect(api.buscar).toHaveBeenCalledTimes(2);
      expect(api.buscar).toHaveBeenLastCalledWith(store.solicitud(), OrdenTransporte.PRECIO);
      expect(store.borrador().orden).toBe(OrdenTransporte.PRECIO);
    });

    it('debería filtrar por incluidos y quitar todos los filtros', async () => {
      guardarBorrador();
      await crear();

      componente.filtroModalidad.setValue('todas');
      componente.filtroIncluidos.setValue([PreferenciaTransporte.CLIMATIZACION]);
      expect(componente.filtrados().map((r) => r.servicioId)).toEqual(['s1', 's3']);
      expect(store.borrador().filtroIncluidos).toEqual([PreferenciaTransporte.CLIMATIZACION]);

      componente.quitarFiltros();
      expect(componente.filtrados()).toHaveLength(3);
      expect(store.borrador().filtroModalidad).toBe('todas');
    });

    it('debería avisar si la búsqueda falla', async () => {
      guardarBorrador();
      api.buscar.mockRejectedValue(new Error('500'));
      await crear();

      expect(componente.respuesta()).toBeNull();
      expect(componente.error()).toBeTruthy();
      expect(componente.cargando()).toBe(false);
    });

    it('debería dar texto a modalidades, incluidos y duraciones', async () => {
      guardarBorrador();
      await crear();

      expect(componente.etiquetaModalidad(ModalidadTransporte.EXCLUSIVO)).toBe('Transporte exclusivo');
      expect(componente.etiquetaIncluido('rara' as PreferenciaTransporte)).toBe('rara');
      expect(componente.iconoIncluido('rara')).toBe('check');
      expect(componente.iconoIncluido('climatizacion')).toBe('snowflake');
      expect(componente.duracion(65)).toBe('1 h 05 min');
    });
  });

  describe('acciones', () => {
    it('debería volver a la búsqueda al modificar', async () => {
      guardarBorrador();
      await crear();

      componente.modificar();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte']);
    });

    it('debería guardar la empresa elegida y pasar a la reserva', async () => {
      guardarBorrador();
      await crear();

      componente.reservar(RESPUESTA.resultados[1]);

      expect(store.borrador().eleccion).toEqual({
        servicioId: 's2', comercioId: 'c-s2', titulo: 'Empresa s2', modalidad: ModalidadTransporte.EXCLUSIVO, total: 95,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/reserva']);
    });

    it('debería pedir iniciar sesión antes de pedir presupuesto', async () => {
      guardarBorrador();
      autenticado.set(false);
      await crear();

      await componente.pedirPresupuesto([RESPUESTA.resultados[2]]);

      expect(api.pedirPresupuesto).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { volverA: '/transporte/viaje/resultados' } });
    });

    it('debería pedir presupuesto una vez por empresa con la solicitud ya descrita', async () => {
      guardarBorrador();
      await crear();

      await componente.pedirPresupuesto([RESPUESTA.resultados[2], RESPUESTA.resultados[2], RESPUESTA.resultados[0]]);

      const params = api.pedirPresupuesto.mock.calls[0][0];
      expect(params.servicioIds).toEqual(['s3', 's1']);
      expect(params.solicitud).toEqual(store.solicitud());
      expect(params.resumen.length).toBeGreaterThan(0);
      expect(componente.avisoPresupuesto()).toBeTruthy();
      expect(componente.pidiendo()).toBe(false);
    });

    it('debería avisar si la solicitud de presupuesto falla', async () => {
      guardarBorrador();
      api.pedirPresupuesto.mockRejectedValue(new Error('500'));
      await crear();

      await componente.pedirPresupuesto([RESPUESTA.resultados[2]]);

      expect(componente.error()).toBeTruthy();
      expect(componente.avisoPresupuesto()).toBeNull();
    });

    it('no debería pedir presupuesto si se perdió la solicitud', async () => {
      guardarBorrador();
      await crear();
      store.reiniciar();

      await componente.pedirPresupuesto([RESPUESTA.resultados[2]]);

      expect(api.pedirPresupuesto).not.toHaveBeenCalled();
    });
  });
});
