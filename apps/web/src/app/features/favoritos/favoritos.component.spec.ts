import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FavoritoResumenDto, VerticalKey } from 'shared';
import { FavoritosComponent } from './favoritos.component';
import { FavoritosService } from './favoritos.service';

const favorito = (overrides: Partial<FavoritoResumenDto>): FavoritoResumenDto => ({
  servicioId: 's1',
  titulo: 'Hotel canino',
  imagen: null,
  ciudad: 'Madrid',
  vertical: VerticalKey.ALOJAMIENTO,
  precioBase: 40,
  moneda: 'EUR',
  ratingPromedio: 4,
  totalResenas: 10,
  createdAt: new Date('2026-01-01').toISOString(),
  ...overrides,
});

describe('FavoritosComponent', () => {
  let fixture: ComponentFixture<FavoritosComponent>;
  let componente: FavoritosComponent;
  let servicio: jest.Mocked<Pick<FavoritosService, 'cargarIds' | 'listar' | 'esFavorito'>>;

  const crear = async (favoritos: FavoritoResumenDto[]): Promise<void> => {
    servicio = {
      cargarIds: jest.fn().mockResolvedValue(undefined),
      listar: jest.fn().mockResolvedValue(favoritos),
      esFavorito: jest.fn().mockReturnValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [FavoritosComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FavoritosService, useValue: servicio },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FavoritosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // ngOnInit encadena dos await (cargarIds → listar); whenStable() no basta
    // para esperar la cadena completa, se necesita un macrotask real.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  it('debería cargar y mostrar los favoritos del usuario', async () => {
    await crear([favorito({ servicioId: 's1' })]);

    expect(componente.favoritos()).toHaveLength(1);
    expect(componente.cargando()).toBe(false);
  });

  it('debería ordenar por más recientes por defecto', async () => {
    const antiguo = favorito({ servicioId: 'antiguo', createdAt: new Date('2026-01-01').toISOString() });
    const reciente = favorito({ servicioId: 'reciente', createdAt: new Date('2026-03-01').toISOString() });
    await crear([antiguo, reciente]);

    expect(componente.favoritosVisibles().map((f) => f.servicioId)).toEqual(['reciente', 'antiguo']);
  });

  it('debería ordenar por mejor valorados', async () => {
    const bajo = favorito({ servicioId: 'bajo', ratingPromedio: 3 });
    const alto = favorito({ servicioId: 'alto', ratingPromedio: 5 });
    await crear([bajo, alto]);

    componente.orden.set('valorados');

    expect(componente.favoritosVisibles().map((f) => f.servicioId)).toEqual(['alto', 'bajo']);
  });

  it('debería ordenar por precio ascendente', async () => {
    const caro = favorito({ servicioId: 'caro', precioBase: 90 });
    const barato = favorito({ servicioId: 'barato', precioBase: 20 });
    await crear([caro, barato]);

    componente.orden.set('precio');

    expect(componente.favoritosVisibles().map((f) => f.servicioId)).toEqual(['barato', 'caro']);
  });

  it('debería filtrar por categoría', async () => {
    const aloj = favorito({ servicioId: 'a', vertical: VerticalKey.ALOJAMIENTO });
    const vet = favorito({ servicioId: 'v', vertical: VerticalKey.VETERINARIA });
    await crear([aloj, vet]);

    componente.filtroVertical.set(VerticalKey.VETERINARIA);

    expect(componente.favoritosVisibles().map((f) => f.servicioId)).toEqual(['v']);
  });

  it('debería listar solo las categorías presentes en los favoritos', async () => {
    await crear([favorito({ vertical: VerticalKey.ALOJAMIENTO })]);

    expect(componente.verticalesDisponibles()).toEqual([VerticalKey.ALOJAMIENTO]);
  });

  it('debería retirar un favorito de la lista visible cuando se desmarca', async () => {
    await crear([favorito({ servicioId: 's1' })]);
    servicio.esFavorito.mockReturnValue(false);
    jest.useFakeTimers();

    componente.marcarPendiente('s1');
    jest.advanceTimersByTime(250);

    expect(componente.favoritos()).toHaveLength(0);
    jest.useRealTimers();
  });
});
