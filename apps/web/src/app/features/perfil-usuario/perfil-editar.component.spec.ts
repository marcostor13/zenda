import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { PerfilEditarComponent } from './perfil-editar.component';
import { AuthService } from '../../core/auth/auth.service';

/**
 * La sesión de `AuthService` sólo lleva nombre, email y rol: **no** el teléfono
 * ni el avatar. El doble antiguo los incluía, y por eso los tests no vieron que
 * la pantalla abría siempre en blanco.
 */
const SESION = { id: 'u1', nombre: 'Ana Ruiz', email: 'ana@doogking.com', rol: 'cliente' };

describe('PerfilEditarComponent', () => {
  let fixture: ComponentFixture<PerfilEditarComponent>;
  let componente: PerfilEditarComponent;
  let httpMock: HttpTestingController;
  let auth: Record<string, unknown> & { actualizarDatosLocales: jest.Mock };

  const peticionPerfil = () => httpMock.expectOne((r) => r.url.includes('/users/me'));

  /**
   * Monta el componente y responde a la carga del perfil.
   *
   * `perfil: null` deja fallar esa petición, para comprobar que la pantalla
   * sigue siendo usable sin ella.
   */
  const crear = async (
    perfil: Record<string, unknown> | null = { nombre: 'Ana Ruiz', telefono: '600000000' },
    sesion: Record<string, unknown> | null = SESION,
  ): Promise<void> => {
    auth = {
      usuario: signal(sesion),
      estaAutenticado: signal(sesion !== null),
      esAdmin: signal(false),
      esComercio: signal(false),
      esCliente: signal(sesion !== null),
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

    if (perfil) {
      peticionPerfil().flush(perfil);
    } else {
      peticionPerfil().flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    }

    await fixture.whenStable();
    fixture.detectChanges();

    // El <rs-navbar> embebido pide sus propios contadores cuando hay sesión; se
    // drenan aquí para no interferir con lo que sí le importa a este spec.
    if (sesion !== null) {
      const respuestas: Record<string, unknown[] | null> = {
        '/favoritos/ids': [], '/perros/mis': [], '/reservas/proxima': null,
        '/reviews/pendientes': [], '/alpha/mi-estado': null, '/reviews?': [],
      };
      for (const [url, cuerpo] of Object.entries(respuestas)) {
        httpMock.match((r) => r.url.includes(url)).forEach((req) => req.flush(cuerpo));
      }
    }
  };

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  describe('carga del perfil', () => {
    it('debería pedir el perfil guardado al abrir', async () => {
      // La sesión no lleva teléfono ni avatar: sin esta petición no hay forma
      // de saberlos y la pantalla abría vacía.
      await crear();

      expect(componente.form.getRawValue()).toEqual({ nombre: 'Ana Ruiz', telefono: '600000000' });
    });

    it('debería traer el teléfono del API, no de la sesión', async () => {
      await crear({ nombre: 'Ana Ruiz', telefono: '655444333' });

      expect(componente.form.getRawValue().telefono).toBe('655444333');
    });

    it('debería mostrar el avatar guardado', async () => {
      await crear({ nombre: 'Ana', avatarUrl: 'https://cdn.doogking.com/avatar.png' });

      expect(componente.avatarPreview()).toBe('https://cdn.doogking.com/avatar.png');
    });

    it('debería dejar el control del avatar con la URL entera', async () => {
      // Estaba tipado como string[] y `value[0]` devolvía la primera letra de
      // la URL: el perfil se guardaba con un avatar que era la cadena "h".
      await crear({ nombre: 'Ana', avatarUrl: 'https://cdn.doogking.com/avatar.png' });

      expect(componente.avatarControl.value).toBe('https://cdn.doogking.com/avatar.png');
    });

    it('debería preferir la imagen recién subida sobre la guardada', async () => {
      await crear({ nombre: 'Ana', avatarUrl: '/antiguo.png' });

      componente.avatarControl.setValue('/nuevo.png');

      expect(componente.avatarPreview()).toBe('/nuevo.png');
    });

    it('debería componer las iniciales del nombre', async () => {
      await crear({ nombre: 'Ana Ruiz García' });

      expect(componente.iniciales()).toBe('AR');
    });

    it('debería seguir siendo usable si el perfil no carga', async () => {
      await crear(null);

      expect(componente.form.getRawValue().nombre).toBe('Ana Ruiz');
      expect(componente.errorMsg()).toContain('No hemos podido cargar');
      expect(componente.cargando()).toBe(false);
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
      const req = peticionPerfil();
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ nombre: 'Ana R.', telefono: '611111111' });
      req.flush({ nombre: 'Ana R.', telefono: '611111111' });
      await promesa;

      expect(componente.exito()).toBe(true);
      expect(componente.guardando()).toBe(false);
    });

    it('debería mandar la URL entera del avatar', async () => {
      await crear();
      componente.avatarControl.setValue('https://cdn.doogking.com/nuevo.png');

      const promesa = componente.guardar();
      const req = peticionPerfil();
      expect(req.request.body.avatarUrl).toBe('https://cdn.doogking.com/nuevo.png');
      req.flush({ nombre: 'Ana Ruiz' });
      await promesa;
    });

    it('no debería mandar avatarUrl si no hay foto', async () => {
      // Un `null` haría que el API borrase la que hubiera.
      await crear({ nombre: 'Ana Ruiz' });

      const promesa = componente.guardar();
      const req = peticionPerfil();
      expect(req.request.body).not.toHaveProperty('avatarUrl');
      req.flush({ nombre: 'Ana Ruiz' });
      await promesa;
    });

    it('no debería borrar el teléfono recién guardado', async () => {
      // Un effect sobre la sesión volvía a rellenar el formulario al guardar y
      // dejaba el teléfono en blanco: parecía que no se había guardado.
      await crear();
      componente.form.patchValue({ telefono: '677888999' });

      const promesa = componente.guardar();
      peticionPerfil().flush({ nombre: 'Ana Ruiz', telefono: '677888999' });
      await promesa;

      expect(componente.form.getRawValue().telefono).toBe('677888999');
    });

    it('debería quedarse con lo que devuelve el API', async () => {
      await crear();

      const promesa = componente.guardar();
      peticionPerfil().flush({ nombre: 'Ana Ruiz', telefono: '600000000', avatarUrl: '/a.png' });
      await promesa;

      expect(componente.avatarPreview()).toBe('/a.png');
    });

    it('debería refrescar el nombre en la sesión abierta', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Ana R.' });

      const promesa = componente.guardar();
      peticionPerfil().flush({ nombre: 'Ana R.' });
      await promesa;

      // Sin esto, la barra superior seguiría mostrando el nombre antiguo.
      expect(auth.actualizarDatosLocales).toHaveBeenCalledWith({ nombre: 'Ana R.' });
    });

    it('debería avisar si el guardado falla', async () => {
      await crear();

      const promesa = componente.guardar();
      peticionPerfil().flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });
      await promesa;

      expect(componente.errorMsg()).toContain('No se pudo actualizar');
      expect(componente.exito()).toBe(false);
      expect(componente.guardando()).toBe(false);
    });
  });
});
