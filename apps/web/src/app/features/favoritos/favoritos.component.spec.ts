import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FavoritoResumenDto, VerticalKey } from 'shared';
import { FavoritosComponent } from './favoritos.component';
import { FavoritosService } from './favoritos.service';
import { ReservasService } from '../reservas/services/reservas.service';
import { AuthService } from '../../core/auth/auth.service';

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

  const crear = async (
    favoritos: FavoritoResumenDto[],
    opciones: { misReservas?: Array<{ servicioId: string }>; usuario?: unknown } = {},
  ): Promise<void> => {
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
        {
          provide: ReservasService,
          useValue: { misReservas: jest.fn().mockResolvedValue(opciones.misReservas ?? []) },
        },
        {
          provide: AuthService,
          useValue: {
            usuario: () => opciones.usuario ?? null,
            estaAutenticado: () => !!opciones.usuario,
            esAdmin: () => false,
            esComercio: () => false,
          },
        },
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

  it('debería etiquetar la antigüedad del favorito (HU-10.2)', async () => {
    await crear([favorito({ servicioId: 's1' })]);

    expect(componente.desdeHace(new Date().toISOString())).toBe('Añadido hoy');
    expect(componente.desdeHace(new Date(Date.now() - 86_400_000).toISOString())).toBe('Añadido ayer');
    expect(componente.desdeHace(new Date(Date.now() - 5 * 86_400_000).toISOString())).toBe('Favorito desde hace 5 días');
    expect(componente.desdeHace(new Date(Date.now() - 90 * 86_400_000).toISOString())).toBe('Favorito desde hace 3 meses');
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

  describe('disponibilidad y acciones (HU-10.4/10.2)', () => {
    it('debería marcar "ya reservaste aquí" cuando el usuario ya reservó ese servicio', async () => {
      await crear([favorito({ servicioId: 's1' })], {
        usuario: { id: 'u1' },
        misReservas: [{ servicioId: 's1' }, { servicioId: 'otro' }],
      });

      expect(componente.yaReservados().has('s1')).toBe(true);
      expect(componente.yaReservados().has('otro')).toBe(true);
      expect(componente.yaReservados().has('s2')).toBe(false);
    });

    it('no debería consultar reservas sin sesión iniciada', async () => {
      const reservasSpy = jest.fn().mockResolvedValue([]);
      await TestBed.configureTestingModule({
        imports: [FavoritosComponent, RouterTestingModule],
        providers: [
          provideHttpClient(), provideHttpClientTesting(),
          {
            provide: FavoritosService,
            useValue: { cargarIds: jest.fn().mockResolvedValue(undefined), listar: jest.fn().mockResolvedValue([]) },
          },
          { provide: ReservasService, useValue: { misReservas: reservasSpy } },
          {
            provide: AuthService,
            useValue: { usuario: () => null, estaAutenticado: () => false, esAdmin: () => false, esComercio: () => false },
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(FavoritosComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(reservasSpy).not.toHaveBeenCalled();
    });

    it('debería enlazar "Reservar" a la ficha cuando el vertical tiene una', async () => {
      await crear([favorito({ servicioId: 's1', vertical: VerticalKey.ALOJAMIENTO })]);
      const f = componente.favoritos()[0];

      expect(componente.rutaReservar(f)).toEqual(['/', VerticalKey.ALOJAMIENTO, 's1']);
    });

    it('debería enlazar "Reservar" al listado cuando el vertical no tiene ficha propia', async () => {
      await crear([favorito({ servicioId: 's1', vertical: VerticalKey.VETERINARIA })]);
      const f = componente.favoritos()[0];

      expect(componente.rutaReservar(f)).toEqual(['/', VerticalKey.VETERINARIA]);
    });

    it('debería compartir con la Web Share API cuando está disponible', async () => {
      await crear([favorito({ servicioId: 's1' })]);
      const share = jest.fn().mockResolvedValue(undefined);
      (navigator as unknown as { share: typeof share }).share = share;

      await componente.compartir(componente.favoritos()[0]);

      expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Doogking' }));
    });

    it('debería copiar al portapapeles si no hay Web Share API', async () => {
      await crear([favorito({ servicioId: 's1', titulo: 'Hotel canino' })]);
      delete (navigator as unknown as { share?: unknown }).share;
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      await componente.compartir(componente.favoritos()[0]);

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Hotel canino'));
    });
  });
});
