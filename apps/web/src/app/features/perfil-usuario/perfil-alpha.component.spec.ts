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

  const crear = async (miEstado: AlphaEstadoApi | null): Promise<void> => {
    alphaService = {
      niveles: jest.fn().mockResolvedValue(NIVELES),
      miEstado: jest.fn().mockResolvedValue(miEstado),
    };

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
    alphaService = {
      niveles: jest.fn().mockResolvedValue([
        { nivel: 1, nombre: 'Club Doogking', reservasRequeridas: 0, descuentoPct: 0, beneficios: [] },
      ]),
      miEstado: jest.fn().mockResolvedValue(null),
    };
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

    expect(componente.nivelesVista()[0].nombre).toBe('Club Doogking');
  });

  it('no debería usar emojis en la pantalla (TCK-8010)', async () => {
    await crear(estadoNivel2);

    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
