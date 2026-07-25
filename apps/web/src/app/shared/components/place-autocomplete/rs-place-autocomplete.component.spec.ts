import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { GeoService, SugerenciaLugar } from '../../../core/geo/geo.service';
import { RsPlaceAutocompleteComponent } from './rs-place-autocomplete.component';

const valencia: SugerenciaLugar = {
  placeId: 'place-valencia',
  descripcion: 'Valencia, España',
  principal: 'Valencia',
  secundario: 'Comunidad Valenciana, España',
};

describe('RsPlaceAutocompleteComponent', () => {
  let fixture: ComponentFixture<RsPlaceAutocompleteComponent>;
  let componente: RsPlaceAutocompleteComponent;
  let geoService: jest.Mocked<Pick<GeoService, 'autocompletar' | 'coordenadas' | 'cerrarSesion'>>;

  const escribir = (valor: string): void => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.pa__inp');
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };

  /**
   * El componente se instancia dentro de cada prueba, no en el `beforeEach`:
   * su suscripción con `debounceTime` debe nacer dentro de la zona de
   * `fakeAsync` para que `tick()` controle el temporizador.
   */
  const crear = (): void => {
    fixture = TestBed.createComponent(RsPlaceAutocompleteComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    geoService = {
      autocompletar: jest.fn().mockReturnValue(of([valencia])),
      coordenadas: jest.fn().mockResolvedValue({ ciudad: 'Valencia', lat: 39.47, lng: -0.376 }),
      cerrarSesion: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RsPlaceAutocompleteComponent, RouterTestingModule],
      providers: [{ provide: GeoService, useValue: geoService }],
    }).compileComponents();
  });

  it('debería sugerir desde la primera letra escrita', fakeAsync(() => {
    crear();
    escribir('v');
    tick(300);
    fixture.detectChanges();

    expect(geoService.autocompletar).toHaveBeenCalledWith('v');
    expect(componente.sugerencias()).toEqual([valencia]);
  }));

  it('debería agrupar las pulsaciones seguidas en una sola consulta', fakeAsync(() => {
    crear();
    escribir('v');
    tick(50);
    escribir('va');
    tick(50);
    escribir('val');
    tick(300);

    expect(geoService.autocompletar).toHaveBeenCalledTimes(1);
    expect(geoService.autocompletar).toHaveBeenCalledWith('val');
  }));

  it('no debería consultar con el campo vacío', fakeAsync(() => {
    crear();
    escribir('   ');
    tick(300);

    expect(geoService.autocompletar).not.toHaveBeenCalled();
    expect(componente.sugerencias()).toEqual([]);
  }));

  it('debería emitir las coordenadas al elegir una población', async () => {
    crear();
    const emitido = jest.fn();
    componente.lugarElegido.subscribe(emitido);

    await componente.elegir(valencia);

    expect(componente.texto()).toBe('Valencia');
    expect(geoService.cerrarSesion).toHaveBeenCalled();
    // Incluye el `placeId` para que quien lo reciba pueda pedir un trayecto
    // después sin volver a resolver la búsqueda.
    expect(emitido).toHaveBeenCalledWith({
      placeId: 'place-valencia', ciudad: 'Valencia', lat: 39.47, lng: -0.376,
    });
  });

  it('debería llevar al resultado aunque no haya coordenadas disponibles', async () => {
    crear();
    geoService.coordenadas.mockResolvedValue(null);
    const emitido = jest.fn();
    componente.lugarElegido.subscribe(emitido);

    await componente.elegir(valencia);

    expect(emitido).toHaveBeenCalledWith(expect.objectContaining({ ciudad: 'Valencia' }));
  });

  it('debería recorrer las sugerencias con las flechas y elegir con Enter', fakeAsync(() => {
    crear();
    geoService.autocompletar.mockReturnValue(
      of([valencia, { ...valencia, placeId: 'p2', principal: 'Valladolid' }]),
    );
    escribir('va');
    tick(300);
    fixture.detectChanges();

    componente.teclear(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    componente.teclear(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(componente.indiceActivo()).toBe(1);

    componente.teclear(new KeyboardEvent('keydown', { key: 'Enter' }));
    tick();
    expect(componente.texto()).toBe('Valladolid');
  }));

  it('debería confirmar la búsqueda con Enter cuando no hay lista desplegada', () => {
    crear();
    const confirmado = jest.fn();
    componente.confirmado.subscribe(confirmado);

    componente.teclear(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(confirmado).toHaveBeenCalled();
  });

  it('debería seguir aceptando texto libre si el proxy no devuelve nada', fakeAsync(() => {
    crear();
    geoService.autocompletar.mockReturnValue(of([]));
    const alCambiar = jest.fn();
    componente.registerOnChange(alCambiar);

    escribir('Cuenca');
    tick(300);
    fixture.detectChanges();

    expect(componente.hayLista()).toBe(false);
    expect(alCambiar).toHaveBeenCalledWith('Cuenca');
  }));
});
