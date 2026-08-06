import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { PerfilAlphaComponent } from './perfil-alpha.component';
import { AuthService } from '../../core/auth/auth.service';
import { AlphaService, AlphaEstadoApi, AlphaNivelApi, AlphaVentajaApi } from '../alpha/alpha.service';

const NIVELES: AlphaNivelApi[] = [
  { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: ['Promociones y ofertas exclusivas'] },
  { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: ['Hasta 5% de descuento'] },
  { nivel: 3, nombre: 'Alpha 3', reservasRequeridas: 15, descuentoPct: 0.1, beneficios: ['Hasta 10% de descuento'] },
];

describe('PerfilAlphaComponent', () => {
  let fixture: ComponentFixture<PerfilAlphaComponent>;
  let componente: PerfilAlphaComponent;
  let alphaService: jest.Mocked<Pick<AlphaService, 'niveles' | 'miEstado' | 'ventajas'>>;

  const crear = async (miEstado: AlphaEstadoApi | null, ventajas: AlphaVentajaApi[] = []): Promise<void> => {
    alphaService = {
      niveles: jest.fn().mockResolvedValue(NIVELES),
      miEstado: jest.fn().mockResolvedValue(miEstado),
      ventajas: jest.fn().mockResolvedValue(ventajas),
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

  it('debería listar los 3 niveles de la escalera', async () => {
    await crear(null);

    expect(componente.niveles()).toHaveLength(3);
    expect(componente.cargando()).toBe(false);
  });

  it('debería marcar el nivel actual del usuario', async () => {
    await crear({
      nivelActual: 2, nombreNivel: 'Alpha 2', descuentoPct: 0.05, beneficios: [],
      reservasCompletadas: 6, reservasParaSiguiente: 9, siguienteNivel: NIVELES[2], esMaximoNivel: false,
    });

    expect(componente.esNivelActual(2)).toBe(true);
    expect(componente.esNivelActual(1)).toBe(false);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tu nivel actual');
  });

  it('no debería marcar ningún nivel como actual si no hay usuario autenticado', async () => {
    await crear(null);

    expect(componente.esNivelActual(1)).toBe(false);
  });

  describe('carrusel de ventajas (HU-13.3)', () => {
    const ventaja: AlphaVentajaApi = {
      id: 'h1', nombre: 'Hotel Luna', ciudad: 'Madrid',
      vertical: 'hoteles', imagenes: ['luna.jpg'],
    };

    it('no debería pintar el carrusel si no hay negocios adheridos', async () => {
      await crear(null);

      expect(componente.adheridos()).toEqual([]);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('Ventajas disponibles para ti');
    });

    it('debería listar los negocios adheridos al programa', async () => {
      await crear(null, [ventaja]);

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Ventajas disponibles para ti');
      expect(el.textContent).toContain('Hotel Luna');
    });

    it('debería enlazar a la ficha cuando el vertical tiene una', async () => {
      await crear(null, [ventaja]);

      expect(componente.enlaceAServicio('hoteles', 'h1')).toEqual(['/hoteles', 'h1']);
    });

    it('debería enlazar al listado cuando el vertical no tiene ficha propia', async () => {
      await crear(null, [ventaja]);

      // Veterinaria no tiene ruta `:id`: enlazar al detalle daría un 404.
      expect(componente.enlaceAServicio('veterinaria', 'v1')).toEqual(['/veterinaria']);
    });
  });
});
