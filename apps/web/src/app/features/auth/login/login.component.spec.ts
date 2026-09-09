import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = { login: jest.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authService },
        // Los botones sociales piden al API con qué client IDs dibujarse.
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener el formulario inválido al inicio', () => {
    expect(component.formulario.invalid).toBe(true);
  });

  it('debería llamar a authService.login con los datos del formulario', async () => {
    authService.login.mockResolvedValue(undefined);

    component.formulario.setValue({ email: 'juan@test.com', password: 'password123', recordar: false });
    await component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith(
      { email: 'juan@test.com', password: 'password123' },
      // Sin `volverA` en la URL no hay destino que conservar.
      null,
    );
  });

  /**
   * Llega aquí desde el interceptor de 401: sin este aviso el usuario aparecía
   * en el acceso sin saber por qué le habían echado (observación 09-09-2026).
   */
  describe('vuelta desde una sesión caducada', () => {
    const crearCon = async (queryParams: Record<string, string>): Promise<LoginComponent> => {
      TestBed.resetTestingModule();
      authService = { login: jest.fn() } as any;

      await TestBed.configureTestingModule({
        imports: [LoginComponent, ReactiveFormsModule, RouterTestingModule],
        providers: [
          { provide: AuthService, useValue: authService },
          provideHttpClient(),
          provideHttpClientTesting(),
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
          },
        ],
      }).compileComponents();

      const nuevo = TestBed.createComponent(LoginComponent);
      nuevo.detectChanges();
      return nuevo.componentInstance;
    };

    it('debería explicar por qué se ha cerrado la sesión', async () => {
      const componente = await crearCon({ motivo: 'sesion' });

      expect(componente.sesionCaducada()).toBe(true);
    });

    it('no debería avisar de nada en un acceso normal', async () => {
      const componente = await crearCon({});

      expect(componente.sesionCaducada()).toBe(false);
    });

    it('debería devolver al usuario a donde estaba tras entrar', async () => {
      const componente = await crearCon({ motivo: 'sesion', volverA: '/reservas/abc' });
      authService.login.mockResolvedValue(undefined);

      componente.formulario.setValue({ email: 'juan@test.com', password: 'password123', recordar: false });
      await componente.onSubmit();

      expect(authService.login).toHaveBeenCalledWith(expect.anything(), '/reservas/abc');
    });

    it('debería retirar el aviso al reintentar', async () => {
      const componente = await crearCon({ motivo: 'sesion' });
      authService.login.mockResolvedValue(undefined);

      componente.formulario.setValue({ email: 'juan@test.com', password: 'password123', recordar: false });
      await componente.onSubmit();

      expect(componente.sesionCaducada()).toBe(false);
    });
  });

  it('debería mostrar error si el login falla', async () => {
    authService.login.mockRejectedValue(new Error('Unauthorized'));

    component.formulario.setValue({ email: 'juan@test.com', password: 'password123', recordar: false });
    await component.onSubmit();

    expect(component.error()).toBe('Credenciales incorrectas. Intenta de nuevo.');
  });

  it('no debería llamar a login si el formulario es inválido', async () => {
    component.formulario.setValue({ email: '', password: '', recordar: false });
    await component.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('debería desactivar el botón mientras carga', () => {
    // login queda pendiente a propósito para observar el estado de carga.
    authService.login.mockImplementation(() => new Promise(() => {}));
    component.formulario.setValue({ email: 'juan@test.com', password: 'password123', recordar: false });

    void component.onSubmit();
    expect(component.cargando()).toBe(true);
  });
  describe('salida hacia la portada', () => {
    it('debería ofrecer un enlace visible de vuelta al inicio', () => {
      // Sin él, quien entra al login desde un enlace directo se queda encerrado:
      // el logo enlaza a la portada, pero nadie adivina que una imagen es pulsable.
      const volver: HTMLAnchorElement = fixture.nativeElement.querySelector('.rs-auth__volver');

      expect(volver).not.toBeNull();
      expect(volver.textContent?.trim()).toContain('Volver al inicio');
      expect(volver.getAttribute('href')).toBe('/');
    });

    it('debería llevar también a la portada desde el logo', () => {
      const logo: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.rs-auth__brand a');

      expect(logo?.getAttribute('href')).toBe('/');
      expect(logo?.getAttribute('aria-label')).toContain('Home');
    });
  });
});
