import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { RestablecerPasswordComponent } from './restablecer-password.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RestablecerPasswordComponent', () => {
  let fixture: ComponentFixture<RestablecerPasswordComponent>;
  let component: RestablecerPasswordComponent;
  let authService: jest.Mocked<AuthService>;

  /** Monta el componente con (o sin) el token que llega en el enlace del correo. */
  async function montar(token: string | null): Promise<void> {
    authService = { restablecerPassword: jest.fn() } as any;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [RestablecerPasswordComponent, ReactiveFormsModule, RouterTestingModule],
        providers: [
          { provide: AuthService, useValue: authService },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { queryParamMap: { get: () => token } } },
          },
        ],
      })
      .compileComponents();

    fixture = TestBed.createComponent(RestablecerPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('debería crear el componente', async () => {
    await montar('token-valido');
    expect(component).toBeTruthy();
  });

  it('debería mostrar "enlace no válido" si la URL no trae token', async () => {
    await montar(null);

    expect(component.sinToken()).toBe(true);
  });

  it('debería exigir al menos 8 caracteres', async () => {
    await montar('token-valido');

    component.formulario.setValue({ nuevaPassword: 'corta', repetirPassword: 'corta' });

    expect(component.formulario.invalid).toBe(true);
  });

  it('debería exigir que ambas contraseñas coincidan', async () => {
    await montar('token-valido');

    component.formulario.setValue({ nuevaPassword: 'contrasena1', repetirPassword: 'contrasena2' });

    expect(component.formulario.hasError('noCoinciden')).toBe(true);
  });

  it('debería enviar el token del enlace junto a la contraseña nueva', async () => {
    await montar('token-del-correo');
    authService.restablecerPassword.mockResolvedValue(undefined);

    component.formulario.setValue({ nuevaPassword: 'contrasena1', repetirPassword: 'contrasena1' });
    await component.onSubmit();

    expect(authService.restablecerPassword).toHaveBeenCalledWith('token-del-correo', 'contrasena1');
  });

  it('no debería enviar si las contraseñas no coinciden', async () => {
    await montar('token-valido');

    component.formulario.setValue({ nuevaPassword: 'contrasena1', repetirPassword: 'otra-cosa1' });
    await component.onSubmit();

    expect(authService.restablecerPassword).not.toHaveBeenCalled();
  });

  it('debería avisar de que el enlace caducó si el API lo rechaza', async () => {
    await montar('token-caducado');
    authService.restablecerPassword.mockRejectedValue(new Error('400'));

    component.formulario.setValue({ nuevaPassword: 'contrasena1', repetirPassword: 'contrasena1' });
    await component.onSubmit();

    expect(component.error()).toContain('caducado');
  });
});
