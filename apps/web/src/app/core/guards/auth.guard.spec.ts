import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';

describe('authGuard', () => {
  let authService: { estaAutenticado: () => boolean };
  let router: jest.Mocked<Router>;

  beforeEach(() => {
    authService = { estaAutenticado: jest.fn().mockReturnValue(false) };
    router = { createUrlTree: jest.fn().mockReturnValue('/auth/login') } as any;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  const ejecutarGuard = (): ReturnType<typeof authGuard> =>
    TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

  it('debería permitir acceso si el usuario está autenticado', () => {
    (authService.estaAutenticado as jest.Mock).mockReturnValue(true);
    const resultado = ejecutarGuard();
    expect(resultado).toBe(true);
  });

  it('debería redirigir a /auth/login si el usuario no está autenticado', () => {
    (authService.estaAutenticado as jest.Mock).mockReturnValue(false);
    ejecutarGuard();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
  });
});
