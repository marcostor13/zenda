import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { VerticalKey } from 'shared';
import { ComercioLayoutComponent } from './comercio-layout.component';
import { ComercioApiService, MiComercio } from './comercio-api.service';
import { AuthService } from '../../core/auth/auth.service';

const miComercio = (extra: Partial<MiComercio> = {}): MiComercio => ({
  _id: 'c1', nombreComercial: 'Canes', razonSocial: 'Canes SL', vatNumber: 'ESB12345678',
  verticales: [VerticalKey.ALOJAMIENTO], plan: 'basico', estado: 'activo',
  ...extra,
} as MiComercio);

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('ComercioLayoutComponent', () => {
  let fixture: ComponentFixture<ComercioLayoutComponent>;
  let componente: ComercioLayoutComponent;
  let api: Record<string, jest.Mock>;
  let auth: Record<string, unknown> & { aplicarSesion: jest.Mock };

  const crear = async (ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getMiComercio: jest.fn().mockReturnValue(of(miComercio())),
      onboarding: jest.fn().mockReturnValue(of({ accessToken: 'jwt', usuario: {} })),
      ...ajustes,
    };
    auth = {
      usuario: signal({ nombre: 'Canes' }),
      estaAutenticado: signal(true),
      esAdmin: signal(false),
      esComercio: signal(true),
      aplicarSesion: jest.fn(),
      logout: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioLayoutComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioLayoutComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    for (let i = 0; i < 3; i++) await fixture.whenStable();
    fixture.detectChanges();
  };

  const rellenar = () => componente.onboardingForm.patchValue({
    nombreComercial: 'DogVan', razonSocial: 'DogVan SL', vatNumber: 'ESB99999999',
  });

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('acceso al panel', () => {
    it('debería cargar el comercio vinculado', async () => {
      await crear();

      expect(componente.comercio()?.nombreComercial).toBe('Canes');
      expect(componente.sinNegocio()).toBe(false);
      expect(componente.cargando()).toBe(false);
    });

    it('debería ofrecer el alta si la cuenta no tiene negocio', async () => {
      await crear({ getMiComercio: fallo('404') });

      // Es la vía de entrada del comercio nuevo: sin ella el panel queda inservible.
      expect(componente.sinNegocio()).toBe(true);
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('alta rápida del negocio', () => {
    it('debería empezar con alojamiento preseleccionado', async () => {
      await crear({ getMiComercio: fallo('404') });

      expect([...componente.verticalesSel()]).toEqual([VerticalKey.ALOJAMIENTO]);
    });

    it('debería alternar los verticales elegidos', async () => {
      await crear({ getMiComercio: fallo('404') });

      componente.toggleVertical(VerticalKey.PELUQUERIA);
      expect(componente.verticalesSel().has(VerticalKey.PELUQUERIA)).toBe(true);

      componente.toggleVertical(VerticalKey.PELUQUERIA);
      expect(componente.verticalesSel().has(VerticalKey.PELUQUERIA)).toBe(false);
    });

    it('no debería enviar el alta incompleta', async () => {
      await crear({ getMiComercio: fallo('404') });

      await componente.crearNegocio();

      expect(api['onboarding']).not.toHaveBeenCalled();
    });

    it('debería crear el negocio con los verticales marcados', async () => {
      await crear();
      rellenar();
      componente.toggleVertical(VerticalKey.TRANSPORTE);

      await componente.crearNegocio();

      expect(api['onboarding']).toHaveBeenCalledWith({
        nombreComercial: 'DogVan', razonSocial: 'DogVan SL', vatNumber: 'ESB99999999',
        verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.TRANSPORTE],
      });
    });

    it('debería renovar la sesión con el token que ya incluye el comercio', async () => {
      await crear();
      rellenar();

      await componente.crearNegocio();

      // Sin renovar el token el comercio tendría que volver a entrar a mano.
      expect(auth.aplicarSesion).toHaveBeenCalledWith({ accessToken: 'jwt', usuario: {} });
      expect(componente.sinNegocio()).toBe(false);
      expect(componente.comercio()).not.toBeNull();
    });

    it('debería avisar si el CIF ya está registrado', async () => {
      await crear({ onboarding: fallo('409') });
      rellenar();

      await componente.crearNegocio();

      expect(componente.onboardingError()).toContain('ya está registrado');
      expect(componente.creando()).toBe(false);
    });
  });

  describe('presentación', () => {
    it('debería dar un badge por plan con respaldo neutro', async () => {
      await crear();

      expect(componente.planBadge('premium')).toContain('rs-badge--');
      expect(componente.planBadge('inventado')).toContain('neutral');
    });

    it('debería dar un icono por vertical', async () => {
      await crear();

      expect(componente.iconVertical(VerticalKey.ALOJAMIENTO)).toBeTruthy();
    });

    it('debería exponer la navegación del panel', async () => {
      await crear();

      expect(componente.navItems.length).toBeGreaterThan(0);
    });
  });
});
