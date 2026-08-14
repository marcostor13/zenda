import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { PerfilEditarComponent } from './perfil-editar.component';
import { AuthService } from '../../core/auth/auth.service';

describe('PerfilEditarComponent', () => {
  let fixture: ComponentFixture<PerfilEditarComponent>;
  let componente: PerfilEditarComponent;
  let httpMock: HttpTestingController;
  let auth: Record<string, unknown> & { actualizarDatosLocales: jest.Mock };

  const crear = async (usuario: Record<string, unknown> | null = { nombre: 'Ana Ruiz', telefono: '600000000' }): Promise<void> => {
    auth = {
      usuario: signal(usuario),
      estaAutenticado: signal(usuario !== null),
      esAdmin: signal(false),
      esComercio: signal(false),
      esCliente: signal(usuario !== null),
      clienteVerificado: signal(false),
      actualizarDatosLocales: jest.fn(),
      logout: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PerfilEditarComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PerfilEditarComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // El <rs-navbar> embebido pide sus propios contadores (mascotas, favoritos,
    // próxima reserva, reseñas pendientes, nivel Alpha) cuando hay sesión; se
    // drenan aquí para no interferir con las peticiones que sí le importan a este spec.
    if (usuario !== null) {
      const respuestas: Record<string, unknown[] | null> = {
        '/favoritos/ids': [], '/perros/mis': [], '/reservas/proxima': null,
        '/reviews/pendientes': [], '/alpha/mi-estado': null,
      };
      for (const [url, cuerpo] of Object.entries(respuestas)) {
        httpMock.match((r) => r.url.includes(url)).forEach((req) => req.flush(cuerpo));
      }
    }
  };

  const peticion = () => httpMock.expectOne((r) => r.url.includes('/users/me'));

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  describe('carga del perfil', () => {
    it('debería precargar el formulario con los datos actuales', async () => {
      await crear();

      expect(componente.form.getRawValue()).toEqual({ nombre: 'Ana Ruiz', telefono: '600000000' });
    });

    it('debería dejar el formulario vacío sin usuario', async () => {
      await crear(null);

      expect(componente.form.getRawValue().nombre).toBe('');
    });

    it('debería componer las iniciales del nombre', async () => {
      await crear({ nombre: 'Ana Ruiz García' });

      expect(componente.iniciales()).toBe('AR');
    });

    it('debería mostrar el avatar guardado', async () => {
      await crear({ nombre: 'Ana', avatarUrl: '/avatar.png' });

      expect(componente.avatarPreview()).toBe('/avatar.png');
    });

    it('debería preferir la imagen recién subida sobre la guardada', async () => {
      await crear({ nombre: 'Ana', avatarUrl: '/antiguo.png' });

      componente.avatarControl.setValue(['/nuevo.png']);

      expect(componente.avatarPreview()).toBe('/nuevo.png');
    });
  });

  describe('validación', () => {
    it('no debería guardar sin nombre', async () => {
      await crear();
      componente.form.patchValue({ nombre: '' });

      await componente.guardar();

      httpMock.expectNone(() => true);
      expect(componente.form.touched).toBe(true);
    });

    it('debería señalar solo los campos tocados', async () => {
      await crear();

      expect(componente.hasErr('nombre')).toBe(false);
      componente.form.patchValue({ nombre: '' });
      componente.form.controls.nombre.markAsTouched();
      expect(componente.hasErr('nombre')).toBe(true);
    });
  });

  describe('guardado', () => {
    it('debería enviar nombre y teléfono con PATCH', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Ana R.', telefono: '611111111' });

      const promesa = componente.guardar();
      const req = peticion();
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ nombre: 'Ana R.', telefono: '611111111' });
      req.flush({ nombre: 'Ana R.' });
      await promesa;

      expect(componente.exito()).toBe(true);
      expect(componente.guardando()).toBe(false);
    });

    it('debería adjuntar el avatar solo si se ha subido uno', async () => {
      await crear();
      componente.avatarControl.setValue(['/nuevo.png']);

      const promesa = componente.guardar();
      const req = peticion();
      expect(req.request.body.avatarUrl).toBe('/nuevo.png');
      req.flush({ nombre: 'Ana Ruiz' });
      await promesa;
    });

    it('debería refrescar el nombre en la sesión abierta', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Ana R.' });

      const promesa = componente.guardar();
      peticion().flush({ nombre: 'Ana R.' });
      await promesa;

      // Sin esto, la barra superior seguiría mostrando el nombre antiguo.
      expect(auth.actualizarDatosLocales).toHaveBeenCalledWith({ nombre: 'Ana R.' });
    });

    it('debería avisar si el guardado falla', async () => {
      await crear();

      const promesa = componente.guardar();
      peticion().flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.errorMsg()).toContain('No se pudo actualizar');
      expect(componente.exito()).toBe(false);
      expect(componente.guardando()).toBe(false);
    });
  });
});
