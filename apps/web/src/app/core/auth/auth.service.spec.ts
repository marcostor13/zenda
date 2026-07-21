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
    it('debería registrar el comercio y devolver estado pendiente (sin sesión ni redirección)', async () => {
      const promesa = service.registrarComercio({
        nombre: 'Ana', email: 'ana@royaldog.eu', password: 'password123', nombreComercial: 'Royal Dog',
      });

      const req = httpMock.expectOne((r) => r.url.includes('/comercios/registro'));
      expect(req.request.method).toBe('POST');
      req.flush({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
      const resultado = await promesa;

      expect(resultado).toEqual({ requiereVerificacion: true, email: 'ana@royaldog.eu' });
      expect(service.estaAutenticado()).toBe(false);
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });

  describe('registro', () => {
    it('debería devolver estado pendiente sin iniciar sesión', async () => {
      const promesa = service.registro({ nombre: 'Juan', email: 'juan@test.com', password: 'password123' });
      const req = httpMock.expectOne((r) => r.url.includes('/auth/registro'));
      req.flush({ requiereVerificacion: true, email: 'juan@test.com' });
      const resultado = await promesa;

      expect(resultado).toEqual({ requiereVerificacion: true, email: 'juan@test.com' });
      expect(service.estaAutenticado()).toBe(false);
    });
  });

  describe('verificarEmail', () => {
    it('debería confirmar el email, iniciar sesión y redirigir por rol', async () => {
      const promesa = service.verificarEmail('token-123');
      const req = httpMock.expectOne((r) => r.url.includes('/auth/verificar-email'));
      expect(req.request.body).toEqual({ token: 'token-123' });
      req.flush(authResponseMock);
      await promesa;

      expect(service.estaAutenticado()).toBe(true);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('reenviarVerificacion', () => {
    it('debería postear el email al endpoint de reenvío', async () => {
      const promesa = service.reenviarVerificacion('juan@test.com');
      const req = httpMock.expectOne((r) => r.url.includes('/auth/reenviar-verificacion'));
      expect(req.request.body).toEqual({ email: 'juan@test.com' });
      req.flush({ ok: true });
      await promesa;
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
