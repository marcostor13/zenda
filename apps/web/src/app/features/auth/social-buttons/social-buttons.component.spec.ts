import { TestBed } from '@angular/core/testing';
import { SocialButtonsComponent } from './social-buttons.component';
import { AuthService } from '../../../core/auth/auth.service';
import { SocialSdkService } from '../../../core/auth/social-sdk.service';

describe('SocialButtonsComponent', () => {
  let component: SocialButtonsComponent;
  let authService: jest.Mocked<AuthService>;
  let sdk: jest.Mocked<SocialSdkService>;

  beforeEach(async () => {
    authService = {
      loginConGoogle: jest.fn(),
      loginConFacebook: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;
    sdk = {
      renderizarBotonGoogle: jest.fn(),
      loginFacebook: jest.fn(),
    } as unknown as jest.Mocked<SocialSdkService>;

    await TestBed.configureTestingModule({
      imports: [SocialButtonsComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SocialSdkService, useValue: sdk },
      ],
    }).compileComponents();

    component = TestBed.createComponent(SocialButtonsComponent).componentInstance;
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });

  it('entrarConFacebook debería pedir el token al SDK y delegar al AuthService', async () => {
    sdk.loginFacebook.mockResolvedValue('fb-token');
    authService.loginConFacebook.mockResolvedValue(undefined);

    await component.entrarConFacebook();

    expect(authService.loginConFacebook).toHaveBeenCalledWith('fb-token');
    expect(component.error()).toBeNull();
    expect(component.cargando()).toBe(false);
  });

  it('entrarConFacebook no debería mostrar error si el usuario cancela', async () => {
    sdk.loginFacebook.mockRejectedValue(new Error('Acceso con Meta cancelado'));

    await component.entrarConFacebook();

    expect(authService.loginConFacebook).not.toHaveBeenCalled();
    expect(component.error()).toBeNull();
  });

  it('entrarConFacebook debería mostrar error ante un fallo real', async () => {
    sdk.loginFacebook.mockResolvedValue('fb-token');
    authService.loginConFacebook.mockRejectedValue(new Error('500'));

    await component.entrarConFacebook();

    expect(component.error()).toContain('No se pudo iniciar sesión con Meta');
  });
});
