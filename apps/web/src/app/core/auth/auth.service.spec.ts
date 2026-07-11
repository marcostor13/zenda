import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Rol, AuthResponseDto } from 'shared';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerMock: jest.Mocked<Router>;

  const authResponseMock: AuthResponseDto = {
    accessToken: 'jwt-token',
    usuario: { id: 'user-1', nombre: 'Juan', email: 'juan@test.com', rol: Rol.CLIENTE },
  };

  beforeEach(() => {
    routerMock = { navigate: jest.fn().mockResolvedValue(true) } as any;

    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: routerMock }],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('estaAutenticado', () => {
    it('debería ser false si no hay usuario en storage', () => {
      expect(service.estaAutenticado()).toBe(false);
    });
  });

  describe('login', () => {
    it('debería guardar el token y navegar al inicio si el rol es cliente', async () => {
      const loginPromise = service.login({ email: 'juan@test.com', password: 'password123' });

      const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
      req.flush(authResponseMock);
      await loginPromise;

      expect(service.estaAutenticado()).toBe(true);
      expect(service.token()).toBe('jwt-token');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('registrarComercio', () => {
    it('debería registrar el comercio y navegar al panel si el rol es comercio_admin', async () => {
      const respuestaComercio: AuthResponseDto = {
        accessToken: 'jwt-comercio',
        usuario: {
          id: 'user-2', nombre: 'Ana', email: 'ana@royaldog.eu',
          rol: Rol.COMERCIO_ADMIN, comercioId: 'comercio-1',
        },
      };

      const promesa = service.registrarComercio({
        nombre: 'Ana', email: 'ana@royaldog.eu', password: 'password123',
        razonSocial: 'Royal Dog S.L.', vatNumber: 'ES-B1', nombreComercial: 'Royal Dog',
      });

      const req = httpMock.expectOne((r) => r.url.includes('/comercios/registro'));
      expect(req.request.method).toBe('POST');
      req.flush(respuestaComercio);
      await promesa;

      expect(service.estaAutenticado()).toBe(true);
      expect(service.token()).toBe('jwt-comercio');
      expect(routerMock.navigate).toHaveBeenCalledWith(['/comercio']);
    });
  });

  describe('logout', () => {
    it('debería limpiar el estado y navegar a /auth/login', () => {
      localStorage.setItem('zenda_token', 'jwt-token');
      service.logout();

      expect(service.estaAutenticado()).toBe(false);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('esAdmin', () => {
    it('debería retornar true si el usuario tiene rol ADMIN', async () => {
      const loginPromise = service.login({ email: 'admin@test.com', password: 'password123' });
      const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
      req.flush({ ...authResponseMock, usuario: { ...authResponseMock.usuario, rol: Rol.ADMIN } });
      await loginPromise;

      expect(service.esAdmin()).toBe(true);
    });
  });
});
