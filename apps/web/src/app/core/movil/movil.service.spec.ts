import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { MovilService, rutaDeUrl } from './movil.service';
import { PushRegistroService } from './push-registro.service';

/*
 * `registerPlugin` se ejecuta al importar cualquier plugin de Capacitor, y
 * `movil.service` arrastra el de push a través de PushRegistroService: sin él
 * en el doble, el módulo revienta antes de que corra ningún test.
 */
jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: jest.fn(), getPlatform: jest.fn() },
  registerPlugin: jest.fn(),
}));
jest.mock('@capacitor/app', () => ({ App: { addListener: jest.fn(), exitApp: jest.fn() } }));
jest.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: jest.fn() } }));
jest.mock('@capacitor/status-bar', () => ({
  StatusBar: { setStyle: jest.fn(), setBackgroundColor: jest.fn() },
  Style: { Dark: 'DARK' },
}));

const capacitor = Capacitor as jest.Mocked<typeof Capacitor>;
const app = App as unknown as { addListener: jest.Mock; exitApp: jest.Mock };
const splash = SplashScreen as unknown as { hide: jest.Mock };
const barra = StatusBar as unknown as { setStyle: jest.Mock; setBackgroundColor: jest.Mock };

describe('MovilService', () => {
  let service: MovilService;
  let router: { navigateByUrl: jest.Mock };
  let pushRegistro: { iniciar: jest.Mock };

  /** Oyente que el servicio registró para un evento del envoltorio nativo. */
  const oyente = (evento: string): ((dato: never) => void) =>
    app.addListener.mock.calls.find((c) => c[0] === evento)![1];

  beforeEach(() => {
    jest.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.getPlatform.mockReturnValue('android');
    splash.hide.mockResolvedValue(undefined);
    barra.setStyle.mockResolvedValue(undefined);
    barra.setBackgroundColor.mockResolvedValue(undefined);
    app.addListener.mockResolvedValue(undefined);

    router = { navigateByUrl: jest.fn() };
    pushRegistro = { iniciar: jest.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        MovilService,
        { provide: Router, useValue: router },
        { provide: PushRegistroService, useValue: pushRegistro },
      ],
    });
    service = TestBed.inject(MovilService);
  });

  describe('arranque', () => {
    it('no debería tocar nada en el navegador', async () => {
      capacitor.isNativePlatform.mockReturnValue(false);

      await service.iniciar();

      expect(service.esNativo).toBe(false);
      expect(splash.hide).not.toHaveBeenCalled();
      expect(pushRegistro.iniciar).not.toHaveBeenCalled();
    });

    it('debería ocultar la splash, ajustar la barra y preparar las push', async () => {
      await service.iniciar();

      expect(splash.hide).toHaveBeenCalledWith({ fadeOutDuration: 200 });
      expect(barra.setStyle).toHaveBeenCalledWith({ style: Style.Dark });
      expect(barra.setBackgroundColor).toHaveBeenCalledWith({ color: '#08258B' });
      expect(pushRegistro.iniciar).toHaveBeenCalled();
    });

    it('no debería pintar el fondo de la barra en iOS, que no lo admite', async () => {
      capacitor.getPlatform.mockReturnValue('ios');

      await service.iniciar();

      expect(barra.setStyle).toHaveBeenCalled();
      expect(barra.setBackgroundColor).not.toHaveBeenCalled();
    });

    /* El arranque no puede caerse porque un plugin nativo falle. */
    it('debería seguir adelante aunque un plugin falle', async () => {
      splash.hide.mockRejectedValue(new Error('sin splash'));

      await expect(service.iniciar()).resolves.toBeUndefined();

      expect(pushRegistro.iniciar).toHaveBeenCalled();
    });
  });

  /*
   * Sin esto el botón físico cierra la app desde cualquier pantalla, incluso a
   * mitad de una reserva.
   */
  describe('botón de atrás de Android', () => {
    it('debería retroceder en el historial cuando hay a dónde volver', async () => {
      const atras = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
      await service.iniciar();

      oyente('backButton')({ canGoBack: true } as never);

      expect(atras).toHaveBeenCalled();
      expect(app.exitApp).not.toHaveBeenCalled();
      atras.mockRestore();
    });

    it('debería cerrar la app cuando ya no hay historial', async () => {
      await service.iniciar();

      oyente('backButton')({ canGoBack: false } as never);

      expect(app.exitApp).toHaveBeenCalled();
    });
  });

  describe('enlaces profundos', () => {
    it('debería abrir la pantalla equivalente por el router', async () => {
      await service.iniciar();

      oyente('appUrlOpen')({ url: 'https://doogking.com/reservas?codigo=A1' } as never);

      expect(router.navigateByUrl).toHaveBeenCalledWith('/reservas?codigo=A1');
    });

    it('no debería navegar con un enlace de otro dominio', async () => {
      await service.iniciar();

      oyente('appUrlOpen')({ url: 'https://otro-sitio.example/reservas' } as never);

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});

describe('rutaDeUrl', () => {
  it.each([
    ['https://doogking.com/reservas', '/reservas'],
    ['https://www.doogking.com/perfil?tab=perros', '/perfil?tab=perros'],
    ['https://doogking.com/', '/'],
  ])('debería extraer la ruta interna de %s', (url, esperado) => {
    expect(rutaDeUrl(url)).toBe(esperado);
  });

  /*
   * Navegar a lo que llegue por un intent sería dejar que cualquier app decida
   * qué pantalla abrimos.
   */
  it.each([
    ['otro dominio', 'https://malo.example/reservas'],
    ['un subdominio parecido', 'https://doogking.com.malo.example/x'],
    ['algo que no es una URL', 'esto no es una url'],
  ])('debería rechazar %s', (_caso, url) => {
    expect(rutaDeUrl(url)).toBeNull();
  });
});
