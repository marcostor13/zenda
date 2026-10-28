import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CLAVE_SESION_INVITADO, SesionInvitadoService } from './sesion-invitado.service';

describe('SesionInvitadoService', () => {
  let http: HttpTestingController;

  const datos = { nombre: 'Ana Pérez', email: 'Ana@Correo.com', telefono: '600111222', aceptaCondiciones: true };

  function crear(): SesionInvitadoService {
    return TestBed.inject(SesionInvitadoService);
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('debería empezar sin sesión', () => {
    const servicio = crear();
    expect(servicio.activa()).toBe(false);
    expect(servicio.token()).toBeNull();
  });

  it('debería pedir la sesión al API y guardarla con el email normalizado', async () => {
    const servicio = crear();
    const promesa = servicio.iniciar(datos);

    const peticion = http.expectOne((r) => r.url.endsWith('/auth/invitado'));
    expect(peticion.request.body.email).toBe('ana@correo.com');
    peticion.flush({ accessToken: 'jwt-inv', usuario: { nombre: 'Ana Pérez' } });
    await promesa;

    expect(servicio.token()).toBe('jwt-inv');
    expect(servicio.email()).toBe('ana@correo.com');
    expect(sessionStorage.getItem(CLAVE_SESION_INVITADO)).toContain('jwt-inv');
  });

  it('no debería pedir otra sesión si ya hay una vigente con el mismo correo', async () => {
    const servicio = crear();
    const primera = servicio.iniciar(datos);
    http.expectOne((r) => r.url.endsWith('/auth/invitado')).flush({ accessToken: 'jwt-inv', usuario: { nombre: 'Ana' } });
    await primera;

    await servicio.iniciar({ ...datos, email: 'ana@correo.com' });

    http.expectNone((r) => r.url.endsWith('/auth/invitado'));
  });

  it('debería descartar una sesión guardada que ya caducó', () => {
    sessionStorage.setItem(CLAVE_SESION_INVITADO, JSON.stringify({
      token: 'viejo', email: 'a@b.com', nombre: 'A', expiraEn: Date.now() - 1000,
    }));
    expect(crear().token()).toBeNull();
  });

  it('debería borrar la sesión al cerrarla', () => {
    sessionStorage.setItem(CLAVE_SESION_INVITADO, JSON.stringify({
      token: 't', email: 'a@b.com', nombre: 'A', expiraEn: Date.now() + 60_000,
    }));
    const servicio = crear();
    expect(servicio.activa()).toBe(true);

    servicio.cerrar();

    expect(servicio.activa()).toBe(false);
    expect(sessionStorage.getItem(CLAVE_SESION_INVITADO)).toBeNull();
  });
});
