import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialButtonsComponent } from './social-buttons.component';
import { AuthService } from '../../../core/auth/auth.service';
import { SocialSdkService } from '../../../core/auth/social-sdk.service';
import { SocialConfigService } from '../../../core/auth/social-config.service';
import { ConsentimientoService } from '../../../core/cookies/consentimiento.service';

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
  let configSocial: jest.Mocked<SocialConfigService>;
  /*
   * El doble se apoya en una señal de verdad, no en un `jest.fn` que devuelve
   * siempre lo mismo: el componente decide qué botón pinta con un `computed`, y
   * un valor que no es reactivo se quedaría cacheado para siempre.
   */
  let consentido: WritableSignal<boolean>;
  let consentimiento: { permite: () => boolean; decision: () => unknown; guardar: jest.Mock };

  beforeEach(async () => {
    authService = {
      loginConGoogle: jest.fn(),
      loginConFacebook: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;
    sdk = {
      renderizarBotonGoogle: jest.fn(),
      loginFacebook: jest.fn(),
      entrarConGoogleNativo: jest.fn(),
      // Por defecto, navegador. Las pruebas de la app lo cambian antes de crear
      // el componente, porque la bandera se lee al construirlo.
      usaSdkNativo: false,
    } as unknown as jest.Mocked<SocialSdkService>;
    // Los client IDs los manda el API, no el environment: el componente no
    // dibuja nada hasta tenerlos.
    configSocial = {
      cargar: jest.fn().mockResolvedValue({ googleClientId: 'client-api', facebookAppId: 'app-api' }),
    } as unknown as jest.Mocked<SocialConfigService>;

    /*
     * Consentimiento ya dado: es el camino que ejercitan casi todas las pruebas,
     * y el único en el que Google llega a dibujar su propio botón. El caso
     * contrario —el script no se descarga hasta que el visitante lo pide— tiene
     * su propio bloque más abajo.
     */
    consentido = signal(true);
    consentimiento = {
      permite: () => consentido(),
      decision: () => ({ preferencias: consentido(), analitica: false, marketing: false }),
      guardar: jest.fn(() => consentido.set(true)),
    };

    await TestBed.configureTestingModule({
      imports: [SocialButtonsComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SocialSdkService, useValue: sdk },
        { provide: SocialConfigService, useValue: configSocial },
        { provide: ConsentimientoService, useValue: consentimiento },
      ],
    }).compileComponents();

    component = TestBed.createComponent(SocialButtonsComponent).componentInstance;
  });

  it('debería crearse', () => {
    expect(component).toBeTruthy();
  });

  /*
   * El `aud` del ID token es el cliente que dibujó el botón, y el API rechaza
   * cualquier otro: por eso el client ID sale del API y no del environment. Con
   * las dos fuentes, bastaba con que una estuviera sin actualizar para que todo
   * acceso con Google acabara en 401.
   */
  describe('client IDs servidos por el API', () => {
    const montarYEstabilizar = async (): Promise<ComponentFixture<SocialButtonsComponent>> => {
      sdk.renderizarBotonGoogle.mockResolvedValue(jest.fn());
      const f = TestBed.createComponent(SocialButtonsComponent);
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      await f.whenStable();
      return f;
    };

    it('debería dibujar el botón con el client ID que manda el API', async () => {
      await montarYEstabilizar();

      expect(sdk.renderizarBotonGoogle).toHaveBeenCalledWith(
        expect.anything(), 'client-api', expect.any(Function),
      );
    });

    it('debería abrir Meta con el app id que manda el API', async () => {
      const f = await montarYEstabilizar();
      sdk.loginFacebook.mockResolvedValue('fb-token');
      authService.loginConFacebook.mockResolvedValue(undefined);

      await f.componentInstance.entrarConFacebook();

      expect(sdk.loginFacebook).toHaveBeenCalledWith('app-api');
    });

    it('no debería mostrar los botones mientras no llega la configuración', () => {
      configSocial.cargar.mockReturnValue(new Promise(() => undefined));
      const f = TestBed.createComponent(SocialButtonsComponent);

      f.detectChanges();

      expect(f.nativeElement.querySelector('.sb')).toBeNull();
    });

    it('debería ocultar el bloque entero si el API no tiene nada configurado', async () => {
      configSocial.cargar.mockResolvedValue({ googleClientId: '', facebookAppId: '' });

      const f = await montarYEstabilizar();

      expect(f.componentInstance.hayGoogle()).toBe(false);
      expect(f.componentInstance.hayFacebook()).toBe(false);
      expect(f.nativeElement.querySelector('.sb')).toBeNull();
      expect(sdk.renderizarBotonGoogle).not.toHaveBeenCalled();
    });

    it('debería enseñar solo Meta cuando Google no está configurado', async () => {
      configSocial.cargar.mockResolvedValue({ googleClientId: '', facebookAppId: 'app-api' });

      const f = await montarYEstabilizar();

      expect(f.nativeElement.querySelector('.sb__fb')).not.toBeNull();
      expect(f.nativeElement.querySelector('.sb__google')).toBeNull();
    });
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

    /*
     * El contenedor no existe hasta que llega la configuración del API, y el
     * observador se queda con el ancho que haya al registrarse: por eso el
     * dibujo se resuelve a mano, ya con el ancho puesto.
     */
    const montar = async (ancho: number): Promise<void> => {
      dibujar = jest.fn();
      let resolverDibujo: (fn: () => void) => void = () => undefined;
      sdk.renderizarBotonGoogle.mockReturnValue(
        new Promise<() => void>((resolver) => { resolverDibujo = resolver; }),
      );
      fixture = TestBed.createComponent(SocialButtonsComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      contenedor = fixture.nativeElement.querySelector('.sb__google') as HTMLElement;
      Object.defineProperty(contenedor, 'clientWidth', { value: ancho, configurable: true });

      resolverDibujo(dibujar);
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
      // Dos vueltas: primero llega la configuración del API y aparece el
      // contenedor, y sólo entonces se intenta dibujar el botón.
      await f.whenStable();
      f.detectChanges();
      await f.whenStable();

      expect(f.componentInstance.error()).toContain('No se pudo cargar el acceso con Google');
    });
  });

  /**
   * El texto genérico escondía la razón real: un 401 por el client ID mal
   * configurado en el servidor se leía igual que un fallo pasajero, y no había
   * forma de saber desde la pantalla que no era problema de la cuenta.
   */
  describe('el error del API llega a la pantalla', () => {
    let montado: SocialButtonsComponent;

    /** Monta el componente y devuelve el callback con el que Google entrega el token. */
    const montarYObtenerCallback = async (): Promise<(idToken: string) => void> => {
      sdk.renderizarBotonGoogle.mockResolvedValue(jest.fn());
      const fixture = TestBed.createComponent(SocialButtonsComponent);
      montado = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      return sdk.renderizarBotonGoogle.mock.calls[0][2];
    };

    it('debería mostrar el mensaje del API cuando el login con Google falla', async () => {
      const onToken = await montarYObtenerCallback();
      authService.loginConGoogle.mockRejectedValue({
        error: { message: 'El acceso con Google no está bien configurado en este servidor.' },
      });

      await onToken('id-token');

      expect(montado.error()).toBe('El acceso con Google no está bien configurado en este servidor.');
    });

    it('debería caer al texto genérico si el fallo no trae mensaje', async () => {
      const onToken = await montarYObtenerCallback();
      authService.loginConGoogle.mockRejectedValue(new Error('sin red'));

      await onToken('id-token');

      expect(montado.error()).toContain('No se pudo iniciar sesión con Google');
    });

    it('debería mostrar el mensaje del API cuando el login con Meta falla', async () => {
      sdk.loginFacebook.mockResolvedValue('fb-token');
      authService.loginConFacebook.mockRejectedValue({
        error: { message: 'Tu cuenta de Meta no comparte un email.' },
      });

      await component.entrarConFacebook();

      expect(component.error()).toBe('Tu cuenta de Meta no comparte un email.');
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

  /**
   * Los SDK de Google y Meta ponen cookies suyas en cuanto se cargan, así que no
   * pueden descargarse antes de que el visitante lo pida. Pulsar el botón **es**
   * esa petición, y el aviso de debajo dice qué implica antes de pulsarlo.
   */
  describe('sin consentimiento de cookies', () => {
    let fixture: ComponentFixture<SocialButtonsComponent>;

    const html = () => fixture.nativeElement as HTMLElement;

    beforeEach(async () => {
      consentido.set(false);
      sdk.renderizarBotonGoogle.mockResolvedValue(jest.fn());

      fixture = TestBed.createComponent(SocialButtonsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('no debería descargar el SDK de Google al abrir la pantalla', () => {
      expect(sdk.renderizarBotonGoogle).not.toHaveBeenCalled();
    });

    it('debería pintar un botón propio en lugar del de Google', () => {
      expect(html().querySelector('.sb__google-nativo')).not.toBeNull();
      expect(html().querySelector('.sb__google')).toBeNull();
    });

    it('debería avisar de lo que implica continuar', () => {
      expect(html().querySelector('.sb__aviso')?.textContent)
        .toContain('cookies propias');
    });

    /** Pulsar anota el consentimiento y, con él, carga y dibuja el botón real. */
    it('debería cargar el SDK al pulsar', async () => {
      await component['pulsarGoogle']();

      expect(consentimiento.guardar).toHaveBeenCalled();
      expect(sdk.renderizarBotonGoogle).toHaveBeenCalled();
    });

    it('debería guardar el consentimiento cuando todavía no lo había', async () => {
      await component['pulsarGoogle']();

      expect(consentimiento.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ preferencias: true }),
      );
    });

    it('no debería tocar el resto de familias de cookies al consentir', async () => {
      await component['pulsarGoogle']();

      expect(consentimiento.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ analitica: false, marketing: false }),
      );
    });
  });
});

describe('SocialButtonsComponent dentro de la app', () => {
  let authService: jest.Mocked<AuthService>;
  let sdk: jest.Mocked<SocialSdkService>;

  const montar = async () => {
    await TestBed.configureTestingModule({
      imports: [SocialButtonsComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SocialSdkService, useValue: sdk },
        {
          provide: SocialConfigService,
          useValue: {
            cargar: jest.fn().mockResolvedValue({
              googleClientId: 'client-web',
              facebookAppId: '',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SocialButtonsComponent);
    await fixture.componentInstance.ngAfterViewInit();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    authService = { loginConGoogle: jest.fn(), loginConFacebook: jest.fn() } as unknown as jest.Mocked<AuthService>;
    sdk = {
      renderizarBotonGoogle: jest.fn(),
      loginFacebook: jest.fn(),
      entrarConGoogleNativo: jest.fn(),
      usaSdkNativo: true,
    } as unknown as jest.Mocked<SocialSdkService>;
  });

  it('no debería intentar dibujar el botón web de Google, que no funciona en un WebView', async () => {
    await montar();
    expect(sdk.renderizarBotonGoogle).not.toHaveBeenCalled();
  });

  it('debería pintar su propio botón de Google', async () => {
    const fixture = await montar();
    expect(fixture.nativeElement.querySelector('.sb__google-nativo')).toBeTruthy();
  });

  it('debería iniciar sesión con el token que devuelve el SDK nativo', async () => {
    sdk.entrarConGoogleNativo.mockResolvedValue('id-token-nativo');
    const fixture = await montar();

    await fixture.componentInstance.entrarConGoogleNativo();

    // El cliente que se pasa es el de web, también en Android: es el `aud` que
    // el API tiene configurado.
    expect(sdk.entrarConGoogleNativo).toHaveBeenCalledWith('client-web');
    expect(authService.loginConGoogle).toHaveBeenCalledWith('id-token-nativo');
  });

  it('no debería enseñar error si el usuario cierra el selector de cuentas', async () => {
    sdk.entrarConGoogleNativo.mockRejectedValue(new Error('The user canceled the sign-in flow'));
    const fixture = await montar();

    await fixture.componentInstance.entrarConGoogleNativo();

    expect(fixture.componentInstance.error()).toBeNull();
    expect(authService.loginConGoogle).not.toHaveBeenCalled();
  });

  it('debería enseñar error si Google falla de verdad', async () => {
    sdk.entrarConGoogleNativo.mockRejectedValue(new Error('[28444] Developer console is not set up correctly'));
    const fixture = await montar();

    await fixture.componentInstance.entrarConGoogleNativo();

    expect(fixture.componentInstance.error()).toBeTruthy();
  });

});
