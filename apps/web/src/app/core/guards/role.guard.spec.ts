import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Rol } from 'shared';
import { adminGuard, comercioGuard } from './role.guard';
import { AuthService, UsuarioAutenticado } from '../auth/auth.service';

describe('guards de rol', () => {
  let usuario: UsuarioAutenticado | null;
  let router: Router;

  /** Ejecuta el guard dentro del contexto de inyección que necesita. */
  const ejecutar = (guard: typeof adminGuard): boolean | UrlTree =>
    TestBed.runInInjectionContext(() => guard(null as never, null as never)) as boolean | UrlTree;

  const destino = (resultado: boolean | UrlTree): string =>
    router.serializeUrl(resultado as UrlTree);

  const comoUsuario = (rol: Rol): void => {
    usuario = { id: 'u1', nombre: 'Test', email: 't@t.com', rol };
  };

  beforeEach(() => {
    usuario = null;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            usuario: () => usuario,
            estaAutenticado: () => usuario !== null,
          },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  describe('adminGuard', () => {
    it('debería dejar pasar al administrador', () => {
      comoUsuario(Rol.ADMIN);

      expect(ejecutar(adminGuard)).toBe(true);
    });

    it('debería mandar al login si no hay sesión', () => {
      expect(destino(ejecutar(adminGuard))).toBe('/auth/login');
    });

    it('debería mandar al inicio, no al login, si hay sesión pero sin permiso', () => {
      // Mandarlo al login sería confuso: ya ha iniciado sesión, lo que le falta
      // es el rol.
      comoUsuario(Rol.CLIENTE);

      expect(destino(ejecutar(adminGuard))).toBe('/');
    });

    it('no debería dejar pasar a un comercio al panel de administración', () => {
      comoUsuario(Rol.COMERCIO_ADMIN);

      expect(destino(ejecutar(adminGuard))).toBe('/');
    });
  });

  describe('comercioGuard', () => {
    it('debería dejar pasar al administrador del comercio', () => {
      comoUsuario(Rol.COMERCIO_ADMIN);

      expect(ejecutar(comercioGuard)).toBe(true);
    });

    it('debería dejar pasar también al staff del comercio', () => {
      comoUsuario(Rol.COMERCIO_STAFF);

      expect(ejecutar(comercioGuard)).toBe(true);
    });

    it('debería mandar al login si no hay sesión', () => {
      expect(destino(ejecutar(comercioGuard))).toBe('/auth/login');
    });

    it('no debería dejar pasar a un cliente al panel de comercio', () => {
      comoUsuario(Rol.CLIENTE);

      expect(destino(ejecutar(comercioGuard))).toBe('/');
    });

    it('no debería dejar pasar al administrador de plataforma al panel de comercio', () => {
      // El admin gestiona la plataforma desde su propio panel; entrar aquí
      // implicaría un comercioId que no tiene.
      comoUsuario(Rol.ADMIN);

      expect(destino(ejecutar(comercioGuard))).toBe('/');
    });
  });
});
