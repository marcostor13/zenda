import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { PerfilSeguridadComponent } from './perfil-seguridad.component';

describe('PerfilSeguridadComponent', () => {
  let fixture: ComponentFixture<PerfilSeguridadComponent>;
  let componente: PerfilSeguridadComponent;
  let httpMock: HttpTestingController;

  const rellenar = (nueva = 'Secreta123!') => componente.form.setValue({
    passwordActual: 'Antigua123!', nuevaPassword: nueva, confirmarPassword: nueva,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilSeguridadComponent, RouterTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PerfilSeguridadComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    httpMock.verify();
  });

  describe('validación', () => {
    it('no debería enviar nada con el formulario vacío', async () => {
      await componente.cambiarPassword();

      httpMock.expectNone(() => true);
      expect(componente.form.touched).toBe(true);
    });

    it('debería exigir una contraseña de al menos 8 caracteres', async () => {
      rellenar('corta1!');

      await componente.cambiarPassword();

      httpMock.expectNone(() => true);
    });

    it('debería exigir que la confirmación coincida', async () => {
      componente.form.setValue({
        passwordActual: 'Antigua123!', nuevaPassword: 'Secreta123!', confirmarPassword: 'Otra123456!',
      });

      await componente.cambiarPassword();

      // Sin esta comprobación el usuario se quedaría fuera con una contraseña que no recuerda.
      httpMock.expectNone(() => true);
      expect(componente.form.invalid).toBe(true);
    });

    it('debería marcar en rojo solo los campos tocados', () => {
      expect(componente.hasErr('nuevaPassword')).toBe(false);

      componente.form.controls.nuevaPassword.markAsTouched();

      expect(componente.hasErr('nuevaPassword')).toBe(true);
    });
  });

  describe('medidor de fortaleza', () => {
    it('debería puntuar longitud, mayúsculas, dígitos y símbolos', () => {
      componente.form.patchValue({ nuevaPassword: 'abcdefgh' });
      expect(componente.strengthWidth()).toBe('25%');

      componente.form.patchValue({ nuevaPassword: 'Abcdefgh' });
      expect(componente.strengthWidth()).toBe('50%');

      componente.form.patchValue({ nuevaPassword: 'Abcdefg1' });
      expect(componente.strengthWidth()).toBe('75%');

      componente.form.patchValue({ nuevaPassword: 'Abcdefg1!' });
      expect(componente.strengthWidth()).toBe('100%');
    });

    it('debería marcar como vacía una contraseña sin escribir', () => {
      expect(componente.strengthWidth()).toBe('0%');
    });

    it('debería describir cada nivel con color y texto', () => {
      componente.form.patchValue({ nuevaPassword: 'abcdefgh' });
      expect(componente.strengthLabel()).toContain('débil');
      expect(componente.strengthColor()).toBe('#EF4444');

      componente.form.patchValue({ nuevaPassword: 'Abcdefgh' });
      expect(componente.strengthLabel()).toContain('regular');

      componente.form.patchValue({ nuevaPassword: 'Abcdefg1' });
      expect(componente.strengthLabel()).toContain('buena');

      componente.form.patchValue({ nuevaPassword: 'Abcdefg1!' });
      expect(componente.strengthLabel()).toContain('fuerte');
      expect(componente.strengthColor()).toBe('#10B981');
    });
  });

  describe('cambio de contraseña', () => {
    it('debería enviar la actual y la nueva, no la confirmación', async () => {
      rellenar();
      const promesa = componente.cambiarPassword();

      const req = httpMock.expectOne((r) => r.url.includes('/users/me/password'));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ passwordActual: 'Antigua123!', nuevaPassword: 'Secreta123!' });
      req.flush({});
      await promesa;

      expect(componente.exito()).toBe(true);
      expect(componente.guardando()).toBe(false);
    });

    it('debería vaciar el formulario tras el cambio', async () => {
      rellenar();
      const promesa = componente.cambiarPassword();
      httpMock.expectOne((r) => r.url.includes('/users/me/password')).flush({});
      await promesa;

      // Dejar la contraseña escrita en pantalla es una fuga innecesaria.
      expect(componente.form.getRawValue().nuevaPassword).toBe('');
    });

    it('debería mostrar el motivo que devuelve el servidor', async () => {
      rellenar();
      const promesa = componente.cambiarPassword();
      httpMock.expectOne((r) => r.url.includes('/users/me/password'))
        .flush({ message: 'La contraseña actual no es correcta' }, { status: 400, statusText: 'Bad Request' });
      await promesa;

      expect(componente.errorMsg()).toBe('La contraseña actual no es correcta');
      expect(componente.exito()).toBe(false);
    });

    it('debería dar un mensaje genérico si el servidor no explica el fallo', async () => {
      rellenar();
      const promesa = componente.cambiarPassword();
      httpMock.expectOne((r) => r.url.includes('/users/me/password'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.errorMsg()).toBe('No se pudo cambiar la contraseña.');
    });
  });

  describe('visibilidad de los campos', () => {
    it('debería alternar cada campo por separado', () => {
      componente.verActual.set(true);

      expect(componente.verActual()).toBe(true);
      expect(componente.verNueva()).toBe(false);
      expect(componente.verConfirmar()).toBe(false);
    });
  });
});
