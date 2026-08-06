import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { TransporteListaComponent } from './transporte-lista.component';
import { TransporteCard, TransporteService } from '../services/transporte.service';

const card = (extra: Partial<TransporteCard> = {}): TransporteCard => ({
  id: 't1', nombre: 'DogVan Madrid', comercioId: 'c1', ciudad: 'Madrid',
  imagen: '/van.jpg', tipoVehiculo: 'van_acondicionada', capacidadPerros: 4,
  zonaCobertura: ['Madrid'], tarifaBase: 25, tarifaKm: 0.9,
  jaulasIncluidas: true, acompananteHumano: false,
  score: 9, scoreLabel: 'Excepcional', numResenas: 12, destacado: false,
  ...extra,
} as TransporteCard);

describe('TransporteListaComponent', () => {
  let fixture: ComponentFixture<TransporteListaComponent>;
  let componente: TransporteListaComponent;
  let service: Record<string, jest.Mock>;
  let router: Router;
  let queryParams: BehaviorSubject<Record<string, string>>;

  const crear = async (
    params: Record<string, string> = {},
    resultado: TransporteCard[] | Error = [card()],
  ): Promise<void> => {
    queryParams = new BehaviorSubject(params);
    service = {
      buscar: resultado instanceof Error
        ? jest.fn(() => { throw resultado; })
        : jest.fn().mockResolvedValue(resultado),
    };

    await TestBed.configureTestingModule({
      imports: [TransporteListaComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TransporteService, useValue: service },
        {
          provide: ActivatedRoute,
          // El buscador embebido lee el snapshot; el listado, el observable.
          useValue: { queryParams, snapshot: { queryParamMap: convertToParamMap(params) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(TransporteListaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('listado', () => {
    it('debería cargar los traslados de la ciudad buscada', async () => {
      await crear({ ciudad: 'Madrid' });

      expect(service['buscar']).toHaveBeenCalledWith('Madrid');
      expect(componente.transportes()).toHaveLength(1);
      expect(componente.cargando()).toBe(false);
      expect(componente.error()).toBe(false);
    });

    it('debería recargar cuando cambia la búsqueda en la url', async () => {
      await crear({ ciudad: 'Madrid' });

      queryParams.next({ ciudad: 'Toledo' });
      await fixture.whenStable();

      // La url es la fuente de verdad: el buscador y el listado no pueden divergir.
      expect(service['buscar']).toHaveBeenLastCalledWith('Toledo');
    });

    it('debería marcar el error sin inventar traslados', async () => {
      await crear({}, new Error('500'));

      expect(componente.error()).toBe(true);
      expect(componente.transportes()).toEqual([]);
    });

    it('debería anunciar la ciudad de salida en el titular', async () => {
      await crear({ ciudad: 'Madrid' });

      expect(componente.sufijoCiudad()).toBe(' desde Madrid');
    });

    it('no debería añadir sufijo sin ciudad buscada', async () => {
      await crear();

      expect(componente.sufijoCiudad()).toBe('');
    });
  });

  describe('etiquetas', () => {
    it('debería nombrar cada tipo de vehículo', async () => {
      await crear();

      expect(componente.tipoLabel('van_acondicionada')).toContain('Van');
      expect(componente.tipoLabel('coche')).toContain('Coche');
      expect(componente.tipoLabel('furgon_climatizado')).toContain('Furgón');
    });
  });

  describe('badges automáticos (HU-3.2)', () => {
    it('debería añadir "Mejor valorado" cuando la puntuación y el nº de reseñas superan el umbral', async () => {
      await crear();
      const t = card({ score: 4.9, numResenas: 30 });

      const badges = componente.badgesDe(t);

      expect(badges).toContainEqual({ icon: 'trophy', label: 'Mejor valorado', variant: 'warning' });
    });

    it('no debería inventar el badge si no hay suficientes reseñas reales', async () => {
      await crear();
      const t = card({ score: 4.9, numResenas: 3 });

      const badges = componente.badgesDe(t);

      expect(badges.some((b) => b.label === 'Mejor valorado')).toBe(false);
    });
  });
});
