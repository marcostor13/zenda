import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { ConexionApiService } from './conexion-api.service';
import { environment } from '../../../environments/environment';

describe('ConexionApiService', () => {
  let service: ConexionApiService;

  const enApp = (nativo: boolean): void => {
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(nativo);
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    enApp(false);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ConexionApiService] });
    service = TestBed.inject(ConexionApiService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('debería arrancar sin fallo mientras el API responda', () => {
    expect(service.fallo()).toBeNull();
    expect(service.mostrarAviso()).toBe(false);
  });

  it('debería recordar la url que no se pudo alcanzar', () => {
    service.registrarFallo('https://api.doogking.com/comercios');

    expect(service.fallo()).toBe('https://api.doogking.com/comercios');
  });

  it('debería dejarlo también en el log del WebView', () => {
    // Con `chrome://inspect` se lee sin reproducir el caso a mano: es la única
    // pista cuando la app instalada abre en blanco.
    service.registrarFallo('https://api.doogking.com/comercios');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('https://api.doogking.com/comercios'),
    );
  });

  it('debería exponer la dirección base a la que llama la app', () => {
    expect(service.apiUrl).toBe(environment.apiUrl);
  });

  it('debería olvidar el fallo en cuanto una petición vuelve a funcionar', () => {
    service.registrarFallo('https://api.doogking.com/comercios');

    service.registrarExito();

    expect(service.fallo()).toBeNull();
  });

  it('no debería tocar nada al acertar si no había fallo', () => {
    service.registrarExito();

    expect(service.fallo()).toBeNull();
  });

  describe('aviso en pantalla', () => {
    /*
     * La banda roja es sólo para la app instalada: en el navegador el dato ya
     * está en la consola y en la pestaña de red, y molestaría al desarrollar.
     */
    it('no debería avisar en el navegador', () => {
      service.registrarFallo('https://api.doogking.com/comercios');

      expect(service.mostrarAviso()).toBe(false);
    });

    it('debería avisar en la app instalada', () => {
      enApp(true);

      service.registrarFallo('https://api.doogking.com/comercios');

      expect(service.mostrarAviso()).toBe(true);
    });

    it('debería retirar el aviso cuando el API vuelve', () => {
      enApp(true);
      service.registrarFallo('https://api.doogking.com/comercios');

      service.registrarExito();

      expect(service.mostrarAviso()).toBe(false);
    });
  });
});
