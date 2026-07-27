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
  const crear = (catalogoLocal: readonly string[] = []): void => {
    fixture = TestBed.createComponent(RsPlaceAutocompleteComponent);
    componente = fixture.componentInstance;
    // Por defecto sin catálogo local: cada prueba de Places mide solo su fuente.
    fixture.componentRef.setInput('catalogoLocal', catalogoLocal);
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

  describe('catálogo local', () => {
    const catalogo = ['Madrid', 'Málaga', 'Murcia', 'Valencia', 'Valladolid', 'Cádiz'];

    // Salvo donde se indique, se mide el catálogo local con Places en silencio.
    beforeEach(() => geoService.autocompletar.mockReturnValue(of([])));

    it('debería sugerir sin salir a la red', fakeAsync(() => {
      crear(catalogo);
      escribir('mal');
      tick(300);

      // Es lo que salva el campo cuando no hay clave de Google configurada.
      expect(componente.sugerencias().map((s) => s.principal)).toEqual(['Málaga']);
    }));

    it('debería encontrar ignorando tildes y mayúsculas', fakeAsync(() => {
      crear(catalogo);
      escribir('CADIZ');
      tick(300);

      expect(componente.sugerencias().map((s) => s.principal)).toEqual(['Cádiz']);
    }));

    it('debería poner primero las que empiezan por lo escrito', fakeAsync(() => {
      crear(['Alcalá de Madrid', 'Madrid']);
      escribir('madrid');
      tick(300);

      expect(componente.sugerencias()[0].principal).toBe('Madrid');
    }));

    it('debería ofrecer una lista inicial al enfocar sin escribir', () => {
      crear(catalogo);

      componente.alEnfocar();
      fixture.detectChanges();

      // "Selector siempre": el campo nunca se queda sin nada que elegir.
      expect(componente.hayLista()).toBe(true);
      expect(componente.sugerencias().length).toBeGreaterThan(0);
    });

    it('debería respetar cuántas sugerencias iniciales se piden', () => {
      crear(catalogo);
      fixture.componentRef.setInput('sugerenciasIniciales', 2);
      fixture.detectChanges();

      expect(componente.sugerencias()).toHaveLength(2);
    });

    it('debería elegir del catálogo sin pedir coordenadas ni gastar sesión', async () => {
      crear(catalogo);
      const emitido = jest.fn();
      componente.lugarElegido.subscribe(emitido);

      await componente.elegir(componente.sugerencias()[0]);

      expect(geoService.coordenadas).not.toHaveBeenCalled();
      expect(geoService.cerrarSesion).not.toHaveBeenCalled();
      expect(emitido).toHaveBeenCalledWith(expect.objectContaining({ placeId: '', ciudad: 'Madrid' }));
      expect(componente.texto()).toBe('Madrid');
    });

    it('debería combinar catálogo local y Places sin repetir', fakeAsync(() => {
      crear(catalogo);
      geoService.autocompletar.mockReturnValue(of([
        valencia,
        { ...valencia, placeId: 'p-vinaros', principal: 'Vinaròs' },
      ]));

      escribir('val');
      tick(300);

      const nombres = componente.sugerencias().map((s) => s.principal);
      expect(nombres).toEqual(['Valencia', 'Valladolid', 'Vinaròs']);
      // "Valencia" está en las dos fuentes y aparece una sola vez.
      expect(nombres.filter((n) => n === 'Valencia')).toHaveLength(1);
    }));

    it('no debería consultar Places en una lista cerrada', fakeAsync(() => {
      crear(catalogo);
      fixture.componentRef.setInput('usaPlaces', false);

      escribir('mad');
      tick(300);

      expect(geoService.autocompletar).not.toHaveBeenCalled();
      expect(componente.sugerencias().map((s) => s.principal)).toEqual(['Madrid']);
    }));
  });
});
