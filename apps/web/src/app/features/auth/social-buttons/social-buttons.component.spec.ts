import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialButtonsComponent } from './social-buttons.component';
import { AuthService } from '../../../core/auth/auth.service';
import { SocialSdkService } from '../../../core/auth/social-sdk.service';

/** Doble de ResizeObserver: guarda el callback para dispararlo a mano. */
class ResizeObserverFalso {
  static ultimo: ResizeObserverFalso | undefined;
  readonly observados: Element[] = [];
  desconectado = false;

  constructor(readonly cb: () => void) {
    ResizeObserverFalso.ultimo = this;
  }
  observe(el: Element): void { this.observados.push(el); }
  disconnect(): void { this.desconectado = true; }
  unobserve(): void { /* no se usa */ }
}

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

  /**
   * Google escribe el ancho del botón en píxeles dentro del marcado que inyecta
   * y no lo recalcula nunca: al girar el móvil o redimensionar la ventana se
   * quedaba con el ancho viejo y se salía de la tarjeta.
   */
  describe('el botón de Google sigue el ancho del contenedor', () => {
    let fixture: ComponentFixture<SocialButtonsComponent>;
    let dibujar: jest.Mock;
    let contenedor: HTMLElement;

    const montar = async (ancho: number): Promise<void> => {
      dibujar = jest.fn();
      sdk.renderizarBotonGoogle.mockResolvedValue(dibujar);
      fixture = TestBed.createComponent(SocialButtonsComponent);
      fixture.detectChanges();
      contenedor = fixture.nativeElement.querySelector('.sb__google') as HTMLElement;
      Object.defineProperty(contenedor, 'clientWidth', { value: ancho, configurable: true });
      await fixture.whenStable();
    };

    beforeEach(() => {
      ResizeObserverFalso.ultimo = undefined;
      (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso;
    });

    it('debería observar el contenedor del botón', async () => {
      await montar(320);

      expect(ResizeObserverFalso.ultimo?.observados).toContain(contenedor);
    });

    it('debería repintar cuando el contenedor cambia de ancho', async () => {
      await montar(320);
      dibujar.mockClear();

      Object.defineProperty(contenedor, 'clientWidth', { value: 190, configurable: true });
      ResizeObserverFalso.ultimo!.cb();

      expect(dibujar).toHaveBeenCalledTimes(1);
    });

    it('no debería repintar por variaciones mínimas, que realimentarían al observador', async () => {
      await montar(320);
      dibujar.mockClear();

      Object.defineProperty(contenedor, 'clientWidth', { value: 324, configurable: true });
      ResizeObserverFalso.ultimo!.cb();

      expect(dibujar).not.toHaveBeenCalled();
    });

    it('debería dejar de observar al destruir el componente', async () => {
      await montar(320);

      fixture.destroy();

      expect(ResizeObserverFalso.ultimo?.desconectado).toBe(true);
    });

    it('debería avisar si el SDK de Google no carga', async () => {
      sdk.renderizarBotonGoogle.mockRejectedValue(new Error('sin red'));
      const f = TestBed.createComponent(SocialButtonsComponent);
      f.detectChanges();
      await f.whenStable();

      expect(f.componentInstance.error()).toContain('No se pudo cargar el acceso con Google');
    });
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
