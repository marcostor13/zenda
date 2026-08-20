import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { VerticalKey } from 'shared';
import { RegistroComercioComponent } from './registro-comercio.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RegistroComercioComponent (wizard)', () => {
  let fixture: ComponentFixture<RegistroComercioComponent>;
  let component: RegistroComercioComponent;
  let authService: jest.Mocked<AuthService>;

  const rellenarNegocio = (): void => {
    component.negocioForm.setValue({ nombreComercial: 'Royal Dog Resort', ciudad: 'Madrid' });
  };
  const rellenarCuenta = (): void => {
    component.cuentaForm.setValue({
      nombre: 'Ana Torres',
      email: 'ana@royaldog.eu',
      telefono: '',
      password: 'password123',
    });
  };

  beforeEach(async () => {
    localStorage.clear();
    authService = { registrarComercio: jest.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [RegistroComercioComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComercioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente e iniciar en el paso 1', () => {
    expect(component).toBeTruthy();
    expect(component.paso()).toBe(1);
  });

  it('no debería avanzar del paso 1 sin categorías seleccionadas', () => {
    component.siguiente();
    expect(component.paso()).toBe(1);
  });

  it('debería avanzar al paso 2 tras elegir una categoría', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    expect(component.paso()).toBe(2);
  });

  it('no debería avanzar más allá del último paso', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    component.siguiente();
    expect(component.paso()).toBe(component.pasos.length);
  });

  it('debería marcar los dos formularios si el negocio está incompleto al enviar', async () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    rellenarCuenta();

    await component.onSubmit();

    expect(authService.registrarComercio).not.toHaveBeenCalled();
    expect(component.negocioForm.get('nombreComercial')?.touched).toBe(true);
  });

  it('debería registrar el comercio con negocio, cuenta y categorías', async () => {
    authService.registrarComercio.mockResolvedValue({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.toggleVertical(VerticalKey.PELUQUERIA);
    rellenarNegocio();
    rellenarCuenta();

    await component.onSubmit();

    expect(authService.registrarComercio).toHaveBeenCalledWith({
      nombre: 'Ana Torres',
      email: 'ana@royaldog.eu',
      password: 'password123',
      telefono: undefined,
      nombreComercial: 'Royal Dog Resort',
      ciudad: 'Madrid',
      verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA],
    });
  });

  it('debería enviar verticales=undefined si no hay categorías', async () => {
    authService.registrarComercio.mockResolvedValue({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
    rellenarNegocio();
    rellenarCuenta();

    await component.onSubmit();

    expect(authService.registrarComercio).toHaveBeenCalledWith(
      expect.objectContaining({ verticales: undefined }),
    );
  });

  it('no debería registrar si la cuenta es inválida', async () => {
    rellenarNegocio();
    await component.onSubmit();
    expect(authService.registrarComercio).not.toHaveBeenCalled();
  });

  it('debería mostrar un error específico si el email ya existe (409)', async () => {
    authService.registrarComercio.mockRejectedValue({ status: 409 });
    rellenarNegocio();
    rellenarCuenta();

    await component.onSubmit();

    expect(component.error()).toContain('ya está registrado');
    expect(component.emailDuplicado()).toBe(true);
  });

  it('debería mostrar un error genérico ante cualquier otro fallo', async () => {
    authService.registrarComercio.mockRejectedValue(new Error('network error'));
    rellenarNegocio();
    rellenarCuenta();

    await component.onSubmit();

    expect(component.error()).toContain('No pudimos crear tu negocio');
  });

  it('toggleVertical debería añadir y quitar categorías', () => {
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(false);
    component.toggleVertical(VerticalKey.VETERINARIA);
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(true);
    component.toggleVertical(VerticalKey.VETERINARIA);
    expect(component.estaSeleccionada(VerticalKey.VETERINARIA)).toBe(false);
  });

  it('atras debería retroceder de paso y limpiar el error', () => {
    component.toggleVertical(VerticalKey.ALOJAMIENTO);
    component.siguiente();
    component.error.set('algo');
    component.atras();
    expect(component.paso()).toBe(1);
    expect(component.error()).toBeNull();
  });

  describe('placeholder del nombre del negocio (HU-6.1.1)', () => {
    it('debería sugerir un ejemplo genérico sin categoría elegida', () => {
      expect(component.placeholderNombreNegocio()).toBe('Ej. Royal Dog Resort');
    });

    it('debería adaptar el ejemplo a la primera categoría elegida', () => {
      component.toggleVertical(VerticalKey.VETERINARIA);
      expect(component.placeholderNombreNegocio()).toContain('Veterinario');

      component.toggleVertical(VerticalKey.HOTELES);
      component.toggleVertical(VerticalKey.VETERINARIA);
      expect(component.placeholderNombreNegocio()).toContain('Hotel');
    });
  });

  describe('fuerza de la contraseña (HU-6.1.4)', () => {
    it('debería marcar como débil una contraseña corta y simple', () => {
      component.cuentaForm.patchValue({ password: 'abcdefgh' });
      expect(component.fuerzaPassword()).toBe('debil');
    });

    it('debería subir de nivel con longitud y variedad de caracteres', () => {
      component.cuentaForm.patchValue({ password: 'abcdefgh' });
      const debil = component.nivelFuerzaPassword();

      component.cuentaForm.patchValue({ password: 'AbcdefghIJKL' });
      const media = component.nivelFuerzaPassword();

      component.cuentaForm.patchValue({ password: 'AbcdefghIJKL123!' });
      const muySegura = component.nivelFuerzaPassword();

      expect(media).toBeGreaterThan(debil);
      expect(muySegura).toBeGreaterThan(media);
      expect(component.fuerzaPassword()).toBe('muy_segura');
    });
  });
});
