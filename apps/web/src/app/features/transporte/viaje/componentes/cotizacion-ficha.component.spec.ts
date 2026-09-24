import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import {
  BusquedaTransportesRespuesta, ModalidadTransporte, PreferenciaTransporte, ResultadoTransporte,
} from 'shared';
import { AuthService } from '../../../../core/auth/auth.service';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { CotizacionFichaComponent } from './cotizacion-ficha.component';

const resultado = (modalidad: ModalidadTransporte, extra: Partial<ResultadoTransporte> = {}): ResultadoTransporte => ({
  servicioId: 's1', comercioId: 'c1', titulo: 'DogVan', rating: 4.6, totalResenas: 10, verificado: true, destacado: false,
  modalidad, estado: 'precio', total: modalidad === ModalidadTransporte.EXCLUSIVO ? 90 : 60,
  desglose: [{ concepto: 'Trayecto', importe: 60 }], incluidos: [PreferenciaTransporte.CLIMATIZACION, 'rara' as PreferenciaTransporte],
  duracionMin: 55, requiereAceptacion: false, cancelacion: { gratisHastaHoras: 24, reembolsoTardioPct: 50 },
  ...extra,
});

const respuesta = (resultados: ResultadoTransporte[], extra: Partial<BusquedaTransportesRespuesta> = {}): BusquedaTransportesRespuesta => ({
  ruta: { km: 70, duracionMin: 55, esEstimacion: false }, viajes: 1, resultados, ...extra,
});

describe('CotizacionFichaComponent', () => {
  let fixture: ComponentFixture<CotizacionFichaComponent>;
  let componente: CotizacionFichaComponent;
  let api: jest.Mocked<Pick<TransporteViajeApi, 'cotizarEmpresa' | 'pedirPresupuesto'>>;
  let autenticado: boolean;
  let store: TransporteViajeStore;
  let router: Router;

  const crear = async (opciones: { conViaje?: boolean; modalidad?: string } = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [CotizacionFichaComponent],
      providers: [
        provideRouter([]),
        { provide: TransporteViajeApi, useValue: api },
        { provide: AuthService, useValue: { estaAutenticado: () => autenticado } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(opciones.modalidad ? { modalidad: opciones.modalidad } : {}) } },
        },
      ],
    }).compileComponents();
    store = TestBed.inject(TransporteViajeStore);
    store.reiniciar();
    if (opciones.conViaje !== false) {
      store.actualizar({
        origen: { texto: 'Calle Mayor 1, Madrid', placeId: 'a' },
        destino: { texto: 'Zocodover, Toledo', placeId: 'b' },
        fecha: '2026-10-01',
      });
    }
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CotizacionFichaComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('servicioId', 's1');
    fixture.componentRef.setInput('titulo', 'DogVan Madrid');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    sessionStorage.clear();
    autenticado = true;
    api = {
      cotizarEmpresa: jest.fn().mockResolvedValue(respuesta([
        resultado(ModalidadTransporte.COMPARTIDO), resultado(ModalidadTransporte.EXCLUSIVO),
      ])),
      pedirPresupuesto: jest.fn().mockResolvedValue({ id: 'pr1' }),
    };
  });

  afterEach(() => fixture?.destroy());

  describe('sin viaje descrito', () => {
    it('debería invitar a calcular el precio y llevar al buscador', async () => {
      await crear({ conViaje: false });

      expect(componente.hayViaje()).toBe(false);
      expect(api.cotizarEmpresa).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Calcular precio');

      (fixture.nativeElement.querySelector('.cf .rs-btn') as HTMLButtonElement).click();
      expect(router.navigate).toHaveBeenCalledWith(['/transporte']);
    });

    it('no debería continuar ni pedir presupuesto sin viaje', async () => {
      await crear({ conViaje: false });

      componente.continuar();
      await componente.pedirPresupuesto();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(api.pedirPresupuesto).not.toHaveBeenCalled();
    });
  });

  describe('con viaje descrito', () => {
    it('debería cotizar el viaje con esta empresa y mostrar el precio de la modalidad del borrador', async () => {
      await crear();

      expect(api.cotizarEmpresa).toHaveBeenCalledWith('s1', store.solicitud());
      expect(componente.cargando()).toBe(false);
      expect(componente.elegido()?.modalidad).toBe(ModalidadTransporte.COMPARTIDO);
      expect(componente.opcionesModalidad()).toHaveLength(2);
      expect(componente.origen()).toBe('Calle Mayor 1');
      expect(fixture.nativeElement.querySelector('rs-desglose-precio')).not.toBeNull();
      expect(componente.politica()).toContain('50');
      expect(componente.icono('rara')).toBe('check');
      expect(componente.etiquetaIncluido('rara' as PreferenciaTransporte)).toBe('rara');
    });

    it('debería respetar la modalidad pedida en la URL y cambiarla al elegir otra', async () => {
      await crear({ modalidad: ModalidadTransporte.EXCLUSIVO });
      expect(componente.elegido()?.total).toBe(90);

      componente.modalidad.setValue(ModalidadTransporte.COMPARTIDO);
      expect(componente.elegido()?.total).toBe(60);
    });

    it('debería caer en la primera modalidad si la pedida no existe', async () => {
      await crear({ modalidad: 'inventada' });
      expect(componente.elegido()?.modalidad).toBe(ModalidadTransporte.COMPARTIDO);
    });

    it('debería describir la política sin reembolso tardío', async () => {
      api.cotizarEmpresa.mockResolvedValue(respuesta([
        resultado(ModalidadTransporte.COMPARTIDO, { cancelacion: { gratisHastaHoras: 48, reembolsoTardioPct: 0 } }),
      ]));
      await crear();
      expect(componente.politica()).toContain('no hay reembolso');
    });

    it('debería guardar la elección y seguir a la reserva al continuar', async () => {
      await crear();

      componente.continuar();

      expect(store.borrador().eleccion).toEqual({
        servicioId: 's1', comercioId: 'c1', titulo: 'DogVan Madrid', modalidad: ModalidadTransporte.COMPARTIDO, total: 60,
      });
      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/reserva']);
    });

    it('debería multiplicar el total por los viajes de una serie', async () => {
      api.cotizarEmpresa.mockResolvedValue(respuesta([resultado(ModalidadTransporte.COMPARTIDO)], { viajes: 4 }));
      await crear();

      expect(componente.viajes()).toBe(4);
      expect(fixture.nativeElement.querySelector('.cf__cta').textContent).toContain('240');
    });

    it('debería explicar por qué la empresa no cubre el viaje', async () => {
      api.cotizarEmpresa.mockResolvedValue(respuesta([], { motivo: 'Fuera de su zona' }));
      await crear();

      expect(componente.error()).toBe('Fuera de su zona');
    });

    it('debería dar un motivo genérico si la empresa no cubre el viaje sin decir por qué', async () => {
      api.cotizarEmpresa.mockResolvedValue(respuesta([]));
      await crear();

      expect(componente.error()).toContain('no cubre');
    });

    it('debería avisar si no se puede calcular el precio', async () => {
      api.cotizarEmpresa.mockRejectedValue(new Error('500'));
      await crear();

      expect(componente.error()).toBeTruthy();
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('presupuesto', () => {
    const aPresupuesto = (): void => {
      api.cotizarEmpresa.mockResolvedValue(respuesta([
        resultado(ModalidadTransporte.EXCLUSIVO, { estado: 'presupuesto', motivoPresupuesto: 'Viaje internacional' }),
      ]));
    };

    it('debería pedir iniciar sesión antes de pedir presupuesto', async () => {
      aPresupuesto();
      autenticado = false;
      await crear();

      await componente.pedirPresupuesto();

      expect(api.pedirPresupuesto).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { volverA: '/transporte/s1' } });
    });

    it('debería pedir presupuesto con la modalidad elegida y avisar al enviarlo', async () => {
      aPresupuesto();
      await crear();
      expect(fixture.nativeElement.textContent).toContain('Viaje internacional');

      await componente.pedirPresupuesto();

      const params = api.pedirPresupuesto.mock.calls[0][0];
      expect(params.servicioIds).toEqual(['s1']);
      expect(params.solicitud.modalidad).toBe(ModalidadTransporte.EXCLUSIVO);
      expect(params.resumen.length).toBeGreaterThan(0);
      expect(componente.avisoPresupuesto()).toBeTruthy();
      expect(componente.pidiendo()).toBe(false);
    });

    it('debería avisar si la solicitud de presupuesto falla', async () => {
      aPresupuesto();
      api.pedirPresupuesto.mockRejectedValue(new Error('500'));
      await crear();

      await componente.pedirPresupuesto();

      expect(componente.error()).toBeTruthy();
      expect(componente.avisoPresupuesto()).toBeNull();
    });
  });
});
