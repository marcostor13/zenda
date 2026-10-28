import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { sesionOInvitadoGuard } from './sesion-o-invitado.guard';
import { AuthService } from '../auth/auth.service';
import { SesionInvitadoService } from '../auth/sesion-invitado.service';

describe('sesionOInvitadoGuard', () => {
  let autenticado: boolean;
  let tokenInvitado: string | null;
  let router: { createUrlTree: jest.Mock };

  beforeEach(() => {
    autenticado = false;
    tokenInvitado = null;
    router = { createUrlTree: jest.fn().mockReturnValue('/auth/login') };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { estaAutenticado: () => autenticado } },
        { provide: SesionInvitadoService, useValue: { token: () => tokenInvitado } },
        { provide: Router, useValue: router },
      ],
    });
  });

  const ejecutar = (): unknown =>
    TestBed.runInInjectionContext(() => sesionOInvitadoGuard({} as never, { url: '/reservas/RES-1' } as never));

  it('debería dejar pasar con sesión normal', () => {
    autenticado = true;
    expect(ejecutar()).toBe(true);
  });

  it('debería dejar pasar con sesión de invitado', () => {
    tokenInvitado = 'jwt-inv';
    expect(ejecutar()).toBe(true);
  });

  it('debería mandar al acceso sin ninguna de las dos, recordando a dónde iba', () => {
    expect(ejecutar()).toBe('/auth/login');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], { queryParams: { volverA: '/reservas/RES-1' } });
  });
});
