import { Component, forwardRef, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { PatronRecurrenciaTransporte, TipoServicioTransporte, hoyEnZona } from 'shared';
import { GeoService } from '../../../../core/geo/geo.service';
import { PuntoMapa, RsMapaComponent } from '../../../../shared/components/mapa/rs-mapa.component';
import {
  LugarElegido, RsPlaceAutocompleteComponent,
} from '../../../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { BusquedaViajeComponent } from './busqueda-viaje.component';

/** Leaflet no sobrevive en jsdom: el mapa real se prueba en su propio spec. */
@Component({ selector: 'rs-mapa', standalone: true, template: '' })
class RsMapaStubComponent {
  readonly puntos = input<PuntoMapa[]>([]);
  readonly ruta = input<ReadonlyArray<{ lat: number; lng: number }>>([]);
  readonly ariaLabel = input('');
}

/** El autocompletado real habla con Google: aquí basta un campo que acepte `formControlName`. */
@Component({
  selector: 'rs-place-autocomplete',
  standalone: true,
  template: '',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RsPlaceStubComponent), multi: true }],
})
class RsPlaceStubComponent implements ControlValueAccessor {
  readonly inputId = input('');
  readonly tipo = input('');
  readonly apariencia = input('');
  readonly catalogoLocal = input<unknown[]>([]);
  readonly sugerenciasIniciales = input(0);
  readonly placeholder = input('');
  readonly lugarElegido = output<LugarElegido>();
  writeValue(): void { /* sin vista */ }
  registerOnChange(): void { /* sin vista */ }
  registerOnTouched(): void { /* sin vista */ }
}

const lugar = (extra: Partial<LugarElegido> = {}): LugarElegido => ({
  placeId: 'p1', ciudad: 'Madrid', lat: 40.4, lng: -3.7, ...extra,
});

describe('BusquedaViajeComponent', () => {
  let fixture: ComponentFixture<BusquedaViajeComponent>;
  let componente: BusquedaViajeComponent;
  let store: TransporteViajeStore;
  let router: Router;
  let geo: jest.Mocked<Pick<GeoService, 'trayecto' | 'direccionDePunto'>>;
  const geoOriginal = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

  const crear = async (params: Record<string, string> = {}): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [BusquedaViajeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: GeoService, useValue: geo },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    })
      .overrideComponent(BusquedaViajeComponent, {
        remove: { imports: [RsMapaComponent, RsPlaceAutocompleteComponent] },
        add: { imports: [RsMapaStubComponent, RsPlaceStubComponent] },
      })
      .compileComponents();
    store = TestBed.inject(TransporteViajeStore);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(BusquedaViajeComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    sessionStorage.clear();
    geo = {
      trayecto: jest.fn().mockResolvedValue({ km: 72, duracionMin: 65, esEstimacion: false }),
      direccionDePunto: jest.fn().mockResolvedValue({ formateada: 'Calle Mayor 1, Madrid' }),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    store?.reiniciar();
    if (geoOriginal) Object.defineProperty(navigator, 'geolocation', geoOriginal);
    else delete (navigator as unknown as Record<string, unknown>)['geolocation'];
  });

  describe('al entrar', () => {
    it('debería poner hoy como fecha si no hay otra', async () => {
      await crear();
      expect(store.borrador().fecha).toBe(hoyEnZona());
      expect(componente.form.controls.fecha.value).toBe(hoyEnZona());
    });

    it('debería traer la población y el día del buscador de la portada', async () => {
      await crear({ ciudad: 'Valencia', desde: '2999-01-01' });

      expect(store.borrador().origen).toEqual({ texto: 'Valencia' });
      expect(store.borrador().fecha).toBe('2999-01-01');
      expect(componente.form.controls.origenTexto.value).toBe('Valencia');
    });

    it('no debería aceptar un día pasado ni mal escrito', async () => {
      await crear({ desde: '2000-01-01' });
      expect(store.borrador().fecha).toBe(hoyEnZona());
    });

    it('no debería pisar un origen ya elegido', async () => {
      // El borrador guardado de una visita anterior.
      sessionStorage.setItem('doogking_viaje_transporte', JSON.stringify({
        version: 1, borrador: { origen: { texto: 'Sevilla', placeId: 's' } },
      }));
      await crear({ origen: 'Valencia' });
      expect(store.borrador().origen?.texto).toBe('Sevilla');
    });
  });

  describe('puntos', () => {
    it('debería guardar la dirección elegida y calcular el trayecto con los dos placeId', async () => {
      await crear();

      componente.elegirPunto('origen', lugar({ direccion: { formateada: 'Calle Mayor 1, Madrid' } as LugarElegido['direccion'] }));
      componente.elegirPunto('destino', lugar({ placeId: 'p2', ciudad: 'Toledo', lat: 39.8, lng: -4 }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(store.borrador().origen).toEqual({ texto: 'Calle Mayor 1, Madrid', placeId: 'p1', lat: 40.4, lng: -3.7 });
      expect(store.borrador().destino?.texto).toBe('Toledo');
      expect(geo.trayecto).toHaveBeenCalledWith('p1', 'p2');
      expect(componente.trayecto()?.km).toBe(72);
      expect(componente.duracion(65)).toBe('1 h 05 min');
      expect(componente.origenValido()).toBe(true);
      expect(componente.puntosMapa()).toHaveLength(2);
    });

    it('debería guardar un punto sin placeId ni coordenadas válidas y no calcular trayecto', async () => {
      await crear();

      componente.elegirPunto('destino', lugar({ placeId: '', lat: Number.NaN, lng: Number.NaN }));

      expect(store.borrador().destino).toEqual({ texto: 'Madrid', placeId: undefined, lat: undefined, lng: undefined });
      expect(componente.destinoValido()).toBe(false);
      expect(componente.trayecto()).toBeNull();
    });

    it('debería olvidar el trayecto si falla su cálculo', async () => {
      geo.trayecto.mockRejectedValue(new Error('500'));
      await crear();
      componente.elegirPunto('origen', lugar());
      componente.elegirPunto('destino', lugar({ placeId: 'p2' }));
      await fixture.whenStable();

      expect(componente.trayecto()).toBeNull();
    });

    it('debería invalidar el punto si el cliente reescribe el texto', async () => {
      await crear();
      componente.elegirPunto('origen', lugar());

      componente.form.controls.origenTexto.setValue('Otra calle');

      expect(store.borrador().origen).toEqual({ texto: 'Otra calle' });
      expect(componente.origenValido()).toBe(false);
    });

    it('no debería invalidar el punto si el texto no cambia', async () => {
      await crear();
      componente.elegirPunto('destino', lugar({ direccion: { formateada: 'Toledo' } as LugarElegido['direccion'] }));

      componente.form.controls.destinoTexto.setValue('Toledo');

      expect(store.borrador().destino?.placeId).toBe('p1');
    });

    it('debería intercambiar origen y destino y reflejarlo en el formulario', async () => {
      await crear();
      componente.elegirPunto('origen', lugar({ direccion: { formateada: 'A' } as LugarElegido['direccion'] }));
      componente.elegirPunto('destino', lugar({ placeId: 'p2', direccion: { formateada: 'B' } as LugarElegido['direccion'] }));

      componente.intercambiar();

      expect(componente.form.controls.origenTexto.value).toBe('B');
      expect(componente.form.controls.destinoTexto.value).toBe('A');
    });

    it('debería usar la ubicación del móvil como origen', async () => {
      const getCurrentPosition = jest.fn();
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
      await crear();

      componente.usarMiUbicacion();
      expect(componente.localizando()).toBe(true);
      await getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 40.1, longitude: -3.2 } });

      expect(geo.direccionDePunto).toHaveBeenCalledWith(40.1, -3.2);
      expect(store.borrador().origen).toEqual({ texto: 'Calle Mayor 1, Madrid', lat: 40.1, lng: -3.2 });
      expect(componente.localizando()).toBe(false);
    });

    it('debería llamar «Mi ubicación» al punto si no hay dirección y soltar el aviso si no hay permiso', async () => {
      geo.direccionDePunto.mockResolvedValue(null);
      const getCurrentPosition = jest.fn();
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
      await crear();

      componente.usarMiUbicacion();
      await getCurrentPosition.mock.calls[0][0]({ coords: { latitude: 1, longitude: 2 } });
      expect(store.borrador().origen?.texto).toBe('Mi ubicación');

      componente.usarMiUbicacion();
      getCurrentPosition.mock.calls[1][1]();
      expect(componente.localizando()).toBe(false);
    });

    it('no debería hacer nada sin geolocalización', async () => {
      Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
      await crear();

      componente.usarMiUbicacion();

      expect(componente.localizando()).toBe(false);
    });
  });

  describe('tipo de servicio y horario', () => {
    it('debería aplicar los atajos del tipo y volcar el horario al store', async () => {
      await crear();

      componente.form.controls.tipo.setValue(TipoServicioTransporte.IDA_VUELTA);
      componente.form.patchValue({ hora: '08:30', vueltaHoras: 0, diasSemana: ['2', '4'] });

      expect(componente.esIdaVuelta()).toBe(true);
      expect(store.borrador().hora).toBe('08:30');
      expect(store.borrador().vueltaHoras).toBe(1);
      expect(store.borrador().diasSemana).toEqual([2, 4]);
    });

    it('debería pedir días sólo en los patrones que los necesitan y contar los viajes de la serie', async () => {
      await crear();
      componente.elegirPunto('origen', lugar());
      componente.elegirPunto('destino', lugar({ placeId: 'p2' }));
      componente.form.controls.tipo.setValue(TipoServicioTransporte.RECURRENTE);
      componente.form.patchValue({ patron: PatronRecurrenciaTransporte.LABORABLES, fecha: '2026-10-05', hasta: '2026-10-09' });

      expect(componente.esRecurrente()).toBe(true);
      expect(componente.pideDias()).toBe(false);
      expect(componente.viajes()).toBe(5);

      componente.form.patchValue({ patron: PatronRecurrenciaTransporte.SEMANAL });
      expect(componente.pideDias()).toBe(true);
    });
  });

  describe('continuar', () => {
    it('no debería avanzar sin ruta completa y debería enseñar los errores', async () => {
      await crear();

      componente.continuar();
      fixture.detectChanges();

      expect(componente.intento()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelectorAll('.rs-field-err').length).toBeGreaterThan(0);
    });

    it('debería pasar a la mascota con la ruta completa', async () => {
      await crear();
      componente.elegirPunto('origen', lugar());
      componente.elegirPunto('destino', lugar({ placeId: 'p2' }));

      componente.continuar();

      expect(router.navigate).toHaveBeenCalledWith(['/transporte/viaje/mascota']);
    });
  });
});
