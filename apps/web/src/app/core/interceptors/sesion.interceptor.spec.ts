import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { sesionInterceptor } from './sesion.interceptor';
import { AuthService } from '../auth/auth.service';

describe('sesionInterceptor', () => {
  let auth: { estaAutenticado: jest.Mock; cerrarSesionLocal: jest.Mock };
  let router: { navigate: jest.Mock; url: string };

  beforeEach(() => {
    auth = { estaAutenticado: jest.fn().mockReturnValue(true), cerrarSesionLocal: jest.fn() };
    router = { navigate: jest.fn(), url: '/reservas/abc' };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  const ejecutar = (url: string, error: unknown): Promise<unknown> =>
    TestBed.runInInjectionContext(() =>
      firstValueFrom(
        sesionInterceptor(new HttpRequest('GET', url), () => throwError(() => error)),
      ),
    );

  const error401 = new HttpErrorResponse({ status: 401, url: '/api/reservas' });

  it('debería cerrar la sesión y llevar al acceso cuando el API devuelve 401', async () => {
    await expect(ejecutar('/api/reservas', error401)).rejects.toBe(error401);

    expect(auth.cerrarSesionLocal).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { motivo: 'sesion', volverA: '/reservas/abc' },
    });
  });

  it('no debería tocar la sesión si el 401 viene del propio login', async () => {
    await expect(ejecutar('/api/auth/login', error401)).rejects.toBe(error401);

    expect(auth.cerrarSesionLocal).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no debería tocar la sesión si el alta de comercio devuelve 401', async () => {
    await expect(ejecutar('/api/comercios/registro', error401)).rejects.toBe(error401);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no debería redirigir si no había sesión iniciada', async () => {
    auth.estaAutenticado.mockReturnValue(false);
    await expect(ejecutar('/api/reservas', error401)).rejects.toBe(error401);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no debería redirigir ante errores que no son 401', async () => {
    const error500 = new HttpErrorResponse({ status: 500 });
    await expect(ejecutar('/api/reservas', error500)).rejects.toBe(error500);

    expect(auth.cerrarSesionLocal).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('debería dejar pasar las respuestas correctas sin tocar nada', async () => {
    const respuesta = await TestBed.runInInjectionContext(() =>
      firstValueFrom(sesionInterceptor(new HttpRequest('GET', '/api/reservas'), () => of('ok' as never))),
    );

    expect(respuesta).toBe('ok');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no debería proponer volver al propio login', async () => {
    router.url = '/auth/login';
    await expect(ejecutar('/api/reservas', error401)).rejects.toBe(error401);

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { motivo: 'sesion', volverA: null },
    });
  });
});
