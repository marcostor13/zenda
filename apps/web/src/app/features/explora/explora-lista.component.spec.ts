import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TipoLugar } from 'shared';
import { ExploraListaComponent } from './explora-lista.component';
import { LugaresService } from './lugares.service';

const lugar = (extra: Record<string, unknown> = {}) => ({
  _id: 'l1', nombre: 'Playa canina', tipo: TipoLugar.PLAYA,
  ubicacion: { ciudad: 'Valencia' }, fotos: [], puntuacionMedia: 4.5, totalReviews: 12,
  ...extra,
});

describe('ExploraListaComponent', () => {
  let fixture: ComponentFixture<ExploraListaComponent>;
  let componente: ExploraListaComponent;
  let lugares: Record<string, jest.Mock>;
  let router: Router;

  const crear = async (
    query: Record<string, string> = {},
    resultado: unknown[] = [lugar()],
  ): Promise<void> => {
    lugares = { buscar: jest.fn().mockResolvedValue(resultado) };

    await TestBed.configureTestingModule({
      imports: [ExploraListaComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LugaresService, useValue: lugares },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ExploraListaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimaBusqueda = () => lugares['buscar'].mock.calls.at(-1)![0];

  afterEach(() => {
    fixture?.destroy();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('carga inicial', () => {
    it('debería buscar con los filtros que vienen en la url', async () => {
      await crear({ tipo: TipoLugar.PLAYA, ciudad: 'Valencia' });

      expect(componente.tipo()).toBe(TipoLugar.PLAYA);
      expect(ultimaBusqueda()).toMatchObject({ tipo: TipoLugar.PLAYA, ciudad: 'Valencia' });
      expect(componente.lugares()).toHaveLength(1);
      expect(componente.cargando()).toBe(false);
    });

    it('debería buscar sin filtros cuando la url no trae ninguno', async () => {
      await crear();

      expect(componente.tipo()).toBeNull();
      expect(ultimaBusqueda()).toEqual({ tipo: undefined, ciudad: undefined, lat: undefined, lng: undefined });
    });

    it('debería mostrar la lista vacía si la búsqueda falla', async () => {
      lugares = { buscar: jest.fn(() => { throw new Error('500'); }) };
      await TestBed.configureTestingModule({
        imports: [ExploraListaComponent, RouterTestingModule],
        providers: [
          provideHttpClient(), provideHttpClientTesting(),
          { provide: LugaresService, useValue: lugares },
          { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ExploraListaComponent);
      componente = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(componente.lugares()).toEqual([]);
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('filtro por tipo', () => {
    it('debería reflejar el filtro en la url y recargar', async () => {
      await crear();

      await componente.filtrar(TipoLugar.PLAYA);

      expect(componente.tipo()).toBe(TipoLugar.PLAYA);
      // La url es la fuente de verdad: así el filtro sobrevive a compartir el enlace.
      expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
        queryParams: { tipo: TipoLugar.PLAYA },
      }));
      expect(ultimaBusqueda().tipo).toBe(TipoLugar.PLAYA);
    });

    it('debería limpiar el filtro al elegir "todos"', async () => {
      await crear({ tipo: TipoLugar.PLAYA });

      await componente.filtrar(null);

      expect(componente.tipo()).toBeNull();
      expect(ultimaBusqueda().tipo).toBeUndefined();
    });
  });

  describe('buscar cerca de mí', () => {
    const conGeolocalizacion = (impl: Partial<Geolocation>) => {
      Object.defineProperty(navigator, 'geolocation', { value: impl, configurable: true });
    };

    it('debería avisar si el navegador no comparte ubicación', async () => {
      await crear();
      conGeolocalizacion(undefined as never);

      await componente.buscarCerca();

      expect(componente.avisoUbicacion()).toContain('no comparte la ubicación');
      expect(componente.cerca()).toBe(false);
    });

    it('debería buscar por coordenadas cuando se concede el permiso', async () => {
      await crear();
      conGeolocalizacion({
        getCurrentPosition: (ok) => ok({ coords: { latitude: 39.4, longitude: -0.3 } } as GeolocationPosition),
      });

      await componente.buscarCerca();

      expect(componente.cerca()).toBe(true);
      expect(componente.avisoUbicacion()).toBe('');
      expect(ultimaBusqueda()).toMatchObject({ lat: 39.4, lng: -0.3 });
    });

    it('debería seguir mostrando resultados si se deniega el permiso', async () => {
      await crear();
      conGeolocalizacion({
        getCurrentPosition: (_ok, err) => err?.({ code: 1 } as GeolocationPositionError),
      });

      await componente.buscarCerca();

      // Denegar la ubicación no puede dejar la pantalla vacía.
      expect(componente.avisoUbicacion()).toContain('mejor valorados');
      expect(componente.cerca()).toBe(false);
      expect(lugares['buscar']).toHaveBeenCalledTimes(2);
    });
  });

  describe('etiquetas', () => {
    it('debería dar nombre e icono a cada tipo de lugar', async () => {
      await crear();

      expect(componente.etiqueta(TipoLugar.PLAYA)).toBeTruthy();
      expect(componente.icono(TipoLugar.PLAYA)).toBeTruthy();
      expect(componente.tipos.length).toBeGreaterThan(0);
    });
  });
});
