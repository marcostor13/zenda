import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { PerfilAlphaComponent } from './perfil-alpha.component';
import { AuthService } from '../../core/auth/auth.service';
import { AlphaService, AlphaEstadoApi, AlphaNivelApi } from '../alpha/alpha.service';

/** Nombres con el formato antiguo a propósito: la BD del cliente aún los tiene así. */
const NIVELES: AlphaNivelApi[] = [
  { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: ['Promociones y ofertas exclusivas'] },
  { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: ['Hasta 5% de descuento'] },
  { nivel: 3, nombre: 'Alpha 3', reservasRequeridas: 15, descuentoPct: 0.1, beneficios: ['Hasta 10% de descuento'] },
];

describe('PerfilAlphaComponent', () => {
  let fixture: ComponentFixture<PerfilAlphaComponent>;
  let componente: PerfilAlphaComponent;
  let alphaService: jest.Mocked<Pick<AlphaService, 'niveles' | 'miEstado'>>;

  /** Monta el componente con los dobles indicados; resetea el TestBed para poder
      montarlo varias veces dentro de un mismo `it`. */
  const montar = async (
    niveles: jest.Mock,
    miEstado: jest.Mock,
  ): Promise<void> => {
    TestBed.resetTestingModule();
    alphaService = { niveles, miEstado };

    await TestBed.configureTestingModule({
      imports: [PerfilAlphaComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { usuario: signal(null), estaAutenticado: signal(false), esAdmin: signal(false), esComercio: signal(false), logout: jest.fn() } },
        { provide: AlphaService, useValue: alphaService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilAlphaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  const crear = (miEstado: AlphaEstadoApi | null): Promise<void> =>
    montar(jest.fn().mockResolvedValue(NIVELES), jest.fn().mockResolvedValue(miEstado));

  const estadoNivel2: AlphaEstadoApi = {
    nivelActual: 2, nombreNivel: 'Alpha 2', descuentoPct: 0.05, beneficios: [],
    reservasCompletadas: 6, reservasParaSiguiente: 9, siguienteNivel: NIVELES[2], esMaximoNivel: false,
  };

  it('debería listar los 3 niveles de la escalera', async () => {
    await crear(null);

    expect(componente.niveles()).toHaveLength(3);
    expect(componente.cargando()).toBe(false);
  });

  it('debería marcar el nivel actual del usuario', async () => {
    await crear(estadoNivel2);

    const vista = componente.nivelesVista();
    expect(vista.find((n) => n.nivel === 2)?.esActual).toBe(true);
    expect(vista.find((n) => n.nivel === 1)?.esActual).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tu nivel actual');
  });

  it('no debería marcar ningún nivel como actual si no hay usuario autenticado', async () => {
    await crear(null);

    expect(componente.nivelesVista().every((n) => !n.esActual)).toBe(true);
  });

  it('debería mostrar los niveles en numeración romana (TCK-8011)', async () => {
    await crear(estadoNivel2);

    expect(componente.nivelesVista().map((n) => n.nombre)).toEqual(['ALPHA I', 'ALPHA II', 'ALPHA III']);
    expect(componente.nombreActual()).toBe('ALPHA II');
    expect(componente.nombreSiguiente()).toBe('ALPHA III');
  });

  it('debería calcular el progreso dentro del tramo hacia el siguiente nivel', async () => {
    await crear(estadoNivel2);

    // 6 reservas: 1 de las 10 que van de ALPHA II (5) a ALPHA III (15).
    expect(componente.progresoPct()).toBe(10);
  });

  it('debería mostrar cuántas reservas faltan para subir de nivel', async () => {
    await crear(estadoNivel2);

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Solo te faltan');
    expect(texto).toContain('9');
    expect(texto).toContain('ALPHA III');
  });

  it('debería dar el progreso al 100% cuando el usuario está en el nivel máximo', async () => {
    await crear({
      nivelActual: 3, nombreNivel: 'Alpha 3', descuentoPct: 0.1, beneficios: [],
      reservasCompletadas: 20, reservasParaSiguiente: null, siguienteNivel: null, esMaximoNivel: true,
    });

    expect(componente.progresoPct()).toBe(100);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('nivel máximo');
  });

  it('debería respetar un nombre propio que haya puesto el admin', async () => {
    await montar(
      jest.fn().mockResolvedValue([
        { nivel: 1, nombre: 'Club Doogking', reservasRequeridas: 0, descuentoPct: 0, beneficios: [] },
      ]),
      jest.fn().mockResolvedValue(null),
    );

    expect(componente.nivelesVista()[0].nombre).toBe('Club Doogking');
  });

  it('no debería usar emojis en la pantalla (TCK-8010)', async () => {
    await crear(estadoNivel2);

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  describe('iconos de beneficio', () => {
    const conBeneficios = async (beneficios: string[]): Promise<string[]> => {
      await montar(
        jest.fn().mockResolvedValue([
          { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios },
        ]),
        jest.fn().mockResolvedValue(null),
      );
      return componente.nivelesVista()[0].beneficios.map((b) => b.icono);
    };

    it('debería elegir el icono según el tipo de beneficio, que el admin escribe libre', async () => {
      expect(await conBeneficios(['Ahorra hasta un 5% en tus reservas'])).toEqual(['percent']);
      expect(await conBeneficios(['Descuento en peluquería'])).toEqual(['percent']);
      expect(await conBeneficios(['Prioridad en las campañas'])).toEqual(['zap']);
      expect(await conBeneficios(['Accede antes que nadie'])).toEqual(['zap']);
      expect(await conBeneficios(['Promociones de temporada'])).toEqual(['tag']);
      expect(await conBeneficios(['Ofertas de verano'])).toEqual(['tag']);
      expect(await conBeneficios(['Ventajas premium'])).toEqual(['sparkles']);
      expect(await conBeneficios(['Contenido exclusivo'])).toEqual(['sparkles']);
      expect(await conBeneficios(['Regalo de bienvenida'])).toEqual(['gift']);
      expect(await conBeneficios(['Sorteos mensuales'])).toEqual(['gift']);
    });

    it('debería caer en un check genérico si el beneficio no encaja en ninguna categoría', async () => {
      expect(await conBeneficios(['Atención personalizada'])).toEqual(['check']);
    });
  });

  describe('progreso', () => {
    it('debería quedarse a 0 mientras no se conoce el estado del usuario', async () => {
      await crear(null);

      expect(componente.progresoPct()).toBe(0);
      expect(componente.nombreActual()).toBe('');
      expect(componente.nombreSiguiente()).toBe('');
      expect(componente.beneficiosSiguiente()).toEqual([]);
    });

    it('debería dar el 100% si el tramo hacia el siguiente nivel no avanza', async () => {
      // Dos niveles con el mismo umbral: el tramo es 0 y no se puede dividir.
      await montar(
        jest.fn().mockResolvedValue([
          { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 5, descuentoPct: 0, beneficios: [] },
          { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0, beneficios: [] },
        ]),
        jest.fn().mockResolvedValue({
          nivelActual: 1, nombreNivel: 'Alpha 1', descuentoPct: 0, beneficios: [],
          reservasCompletadas: 5, reservasParaSiguiente: 0,
          siguienteNivel: { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0, beneficios: [] },
          esMaximoNivel: false,
        }),
      );

      expect(componente.progresoPct()).toBe(100);
    });
  });

  it('debería dejar de cargar aunque la API falle, sin romper el perfil', async () => {
    // El rechazo se difiere un tick para que se parezca a un fallo HTTP real:
    // rechazar de forma síncrona haría que zone.js lo viera como no capturado.
    await montar(
      jest.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('API caída')), 0)),
      ),
      jest.fn().mockResolvedValue(null),
    );

    expect(componente.cargando()).toBe(false);
    expect(componente.niveles()).toEqual([]);
  });
});
