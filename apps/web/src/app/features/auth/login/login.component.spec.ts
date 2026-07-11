import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
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
      providers: [{ provide: AuthService, useValue: authService }],
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

    component.formulario.setValue({ email: 'juan@test.com', password: 'password123' });
    await component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'juan@test.com',
      password: 'password123',
    });
  });

  it('debería mostrar error si el login falla', async () => {
    authService.login.mockRejectedValue(new Error('Unauthorized'));

    component.formulario.setValue({ email: 'juan@test.com', password: 'password123' });
    await component.onSubmit();

    expect(component.error()).toBe('Credenciales incorrectas. Intenta de nuevo.');
  });

  it('no debería llamar a login si el formulario es inválido', async () => {
    component.formulario.setValue({ email: '', password: '' });
    await component.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('debería desactivar el botón mientras carga', () => {
    // login queda pendiente a propósito para observar el estado de carga.
    authService.login.mockImplementation(() => new Promise(() => {}));
    component.formulario.setValue({ email: 'juan@test.com', password: 'password123' });

    void component.onSubmit();
    expect(component.cargando()).toBe(true);
  });
});
