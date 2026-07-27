import { TestBed } from '@angular/core/testing';
import { SocialSdkService } from './social-sdk.service';

type Ventana = typeof globalThis & { google?: unknown; FB?: unknown };

describe('SocialSdkService', () => {
  let service: SocialSdkService;
  let scriptsInyectados: HTMLScriptElement[];

  /** Simula la carga correcta de cualquier <script> que se añada al head. */
  const autoResolverScripts = () => {
    jest.spyOn(document.head, 'appendChild').mockImplementation(((nodo: HTMLScriptElement) => {
      scriptsInyectados.push(nodo);
      queueMicrotask(() => nodo.onload?.(new Event('load')));
      return nodo;
    }) as never);
  };

  beforeEach(() => {
    scriptsInyectados = [];
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocialSdkService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as Ventana).google;
    delete (window as Ventana).FB;
  });

  describe('Google', () => {
    const prepararGoogle = () => {
      const id = { initialize: jest.fn(), renderButton: jest.fn() };
      (window as Ventana).google = { accounts: { id } };
      return id;
    };

    it('debería inyectar el script oficial de Google Identity', async () => {
      autoResolverScripts();
      prepararGoogle();

      await service.renderizarBotonGoogle(document.createElement('div'), 'cid', jest.fn());

      expect(scriptsInyectados[0].src).toContain('accounts.google.com/gsi/client');
      expect(scriptsInyectados[0].async).toBe(true);
    });

    it('debería inicializar con el clientId y pintar el botón en el contenedor', async () => {
      autoResolverScripts();
      const id = prepararGoogle();
      const contenedor = document.createElement('div');

      await service.renderizarBotonGoogle(contenedor, 'cid-123', jest.fn());

      expect(id.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'cid-123' }),
      );
      expect(id.renderButton).toHaveBeenCalledWith(contenedor, expect.any(Object));
    });

    it('debería entregar el credential recibido de Google al callback', async () => {
      autoResolverScripts();
      const id = prepararGoogle();
      const onToken = jest.fn();

      await service.renderizarBotonGoogle(document.createElement('div'), 'cid', onToken);
      const config = id.initialize.mock.calls[0][0] as { callback: (r: { credential: string }) => void };
      config.callback({ credential: 'id-token' });

      expect(onToken).toHaveBeenCalledWith('id-token');
    });

    it('debería inyectar el script una sola vez para varios botones', async () => {
      autoResolverScripts();
      prepararGoogle();

      await service.renderizarBotonGoogle(document.createElement('div'), 'cid', jest.fn());
      await service.renderizarBotonGoogle(document.createElement('div'), 'cid', jest.fn());

      expect(scriptsInyectados).toHaveLength(1);
    });

    it('debería propagar el error si el script no carga', async () => {
      jest.spyOn(document.head, 'appendChild').mockImplementation(((nodo: HTMLScriptElement) => {
        queueMicrotask(() => nodo.onerror?.(new Event('error')));
        return nodo;
      }) as never);

      await expect(
        service.renderizarBotonGoogle(document.createElement('div'), 'cid', jest.fn()),
      ).rejects.toThrow(/No se pudo cargar/);
    });
  });

  describe('Meta', () => {
    const prepararFacebook = (respuesta: { authResponse?: { accessToken?: string } }) => {
      const FB = {
        init: jest.fn(),
        login: jest.fn((cb: (r: typeof respuesta) => void, _opciones: { scope: string }) => cb(respuesta)),
      };
      (window as Ventana).FB = FB;
      return FB;
    };

    it('debería inicializar el SDK con el appId antes de abrir el diálogo', async () => {
      autoResolverScripts();
      const FB = prepararFacebook({ authResponse: { accessToken: 'fb-token' } });

      await service.loginFacebook('app-1');

      expect(FB.init).toHaveBeenCalledWith(expect.objectContaining({ appId: 'app-1' }));
      expect(scriptsInyectados[0].src).toContain('connect.facebook.net');
    });

    it('debería resolver con el access token cuando el usuario acepta', async () => {
      autoResolverScripts();
      prepararFacebook({ authResponse: { accessToken: 'fb-token' } });

      await expect(service.loginFacebook('app-1')).resolves.toBe('fb-token');
    });

    it('debería rechazar cuando el usuario cancela el diálogo', async () => {
      autoResolverScripts();
      prepararFacebook({});

      // Meta responde con `authResponse` vacío al cancelar; sin este rechazo el
      // login quedaría colgado sin feedback.
      await expect(service.loginFacebook('app-1')).rejects.toThrow('Acceso con Meta cancelado');
    });

    it('debería pedir el ámbito de perfil y email', async () => {
      autoResolverScripts();
      const FB = prepararFacebook({ authResponse: { accessToken: 'fb-token' } });

      await service.loginFacebook('app-1');

      expect(FB.login.mock.calls[0][1]).toEqual({ scope: 'public_profile,email' });
    });
  });
});
