import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { conexionInterceptor } from './conexion.interceptor';
import { ConexionApiService } from '../diagnostico/conexion-api.service';

describe('conexionInterceptor', () => {
  let conexion: { registrarExito: jest.Mock; registrarFallo: jest.Mock };

  const peticion = new HttpRequest('GET', 'https://api.doogking.com/comercios');

  const interceptar = (respuesta: unknown, falla = false): Promise<unknown> =>
    TestBed.runInInjectionContext(() =>
      firstValueFrom(
        conexionInterceptor(peticion, () => (falla ? throwError(() => respuesta) : of(respuesta as never))),
      ),
    );

  beforeEach(() => {
    conexion = { registrarExito: jest.fn(), registrarFallo: jest.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ConexionApiService, useValue: conexion }],
    });
  });

  it('debería dar el API por vivo cuando la petición responde', async () => {
    await interceptar(new HttpResponse({ status: 200 }));

    expect(conexion.registrarExito).toHaveBeenCalled();
    expect(conexion.registrarFallo).not.toHaveBeenCalled();
  });

  /*
   * `status === 0` es lo que devuelve el navegador cuando la petición no llegó
   * a completarse: servidor caído, sin red, o un CORS que la bloqueó.
   */
  it('debería avisar del fallo de conexión con la url que no se alcanzó', async () => {
    const error = new HttpErrorResponse({ status: 0, url: peticion.url });

    await expect(interceptar(error, true)).rejects.toBe(error);

    expect(conexion.registrarFallo).toHaveBeenCalledWith(peticion.url);
  });

  it('no debería tomar por caída del API un error que sí llegó al servidor', async () => {
    // Un 401 o un 500 los gestiona cada pantalla; no son un problema de red.
    for (const status of [401, 404, 500]) {
      const error = new HttpErrorResponse({ status, url: peticion.url });

      await expect(interceptar(error, true)).rejects.toBe(error);
    }

    expect(conexion.registrarFallo).not.toHaveBeenCalled();
  });

  it('no debería tomar por caída del API un error que no es HTTP', async () => {
    const error = new Error('algo se rompió antes de salir');

    await expect(interceptar(error, true)).rejects.toBe(error);

    expect(conexion.registrarFallo).not.toHaveBeenCalled();
  });

  it('debería dejar pasar el error a quien hizo la petición', async () => {
    // El interceptor observa; no se traga nada ni cambia el error.
    const error = new HttpErrorResponse({ status: 0 });

    await expect(interceptar(error, true)).rejects.toBe(error);
  });
});
