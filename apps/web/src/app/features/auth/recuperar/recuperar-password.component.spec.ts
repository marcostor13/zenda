import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { RecuperarPasswordComponent } from './recuperar-password.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RecuperarPasswordComponent', () => {
  let fixture: ComponentFixture<RecuperarPasswordComponent>;
  let component: RecuperarPasswordComponent;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = { recuperarPassword: jest.fn() } as any;

    await TestBed.configureTestingModule({
      imports: [RecuperarPasswordComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(RecuperarPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener el formulario inválido al inicio', () => {
    expect(component.formulario.invalid).toBe(true);
  });

  it('no debería enviar si el email no es válido', async () => {
    component.formulario.setValue({ email: 'no-es-un-email' });
    await component.onSubmit();

    expect(authService.recuperarPassword).not.toHaveBeenCalled();
  });

  it('debería pedir el enlace con el email del formulario', async () => {
    authService.recuperarPassword.mockResolvedValue(undefined);

    component.formulario.setValue({ email: 'juan@test.com' });
    await component.onSubmit();

    expect(authService.recuperarPassword).toHaveBeenCalledWith('juan@test.com');
    expect(component.enviado()).toBe(true);
  });

  it('debería mostrar el mismo mensaje exista o no la cuenta', async () => {
    // El API responde igual en ambos casos; distinguirlos aquí convertiría la
    // pantalla en un buscador de usuarios.
    authService.recuperarPassword.mockResolvedValue(undefined);

    component.formulario.setValue({ email: 'nadie@test.com' });
    await component.onSubmit();

    expect(component.enviado()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('debería mostrar un error de red sin insinuar que el email no existe', async () => {
    authService.recuperarPassword.mockRejectedValue(new Error('Network'));

    component.formulario.setValue({ email: 'juan@test.com' });
    await component.onSubmit();

    expect(component.enviado()).toBe(false);
    expect(component.error()).toContain('No hemos podido enviar');
    expect(component.error()).not.toContain('existe');
  });

  it('debería marcar el estado de carga mientras espera', () => {
    authService.recuperarPassword.mockImplementation(() => new Promise(() => {}));
    component.formulario.setValue({ email: 'juan@test.com' });

    void component.onSubmit();

    expect(component.cargando()).toBe(true);
  });
});
