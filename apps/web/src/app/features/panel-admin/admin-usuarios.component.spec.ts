import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

/** Fallo del API sin observable de por medio: evita rechazos que zone.js reporta como globales. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });
import { AdminUsuariosComponent } from './admin-usuarios.component';
import { AdminApiService, UsuarioAdmin } from './admin-api.service';

const usuario = (extra: Partial<UsuarioAdmin> = {}): UsuarioAdmin => ({
  _id: 'u1', nombre: 'Ana Ruiz', email: 'ana@ruiz.com', rol: 'cliente',
  verificado: true, createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
} as UsuarioAdmin);

describe('AdminUsuariosComponent', () => {
  let fixture: ComponentFixture<AdminUsuariosComponent>;
  let componente: AdminUsuariosComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (
    items: UsuarioAdmin[] = [usuario()],
    total = items.length,
    ajustes: Record<string, jest.Mock> = {},
  ): Promise<void> => {
    api = {
      getUsuarios: jest.fn().mockReturnValue(of({ items, total, page: 1, totalPages: 1 })),
      getComercios: jest.fn().mockReturnValue(of({
        items: [{ _id: 'c1', nombreComercial: 'Canes' }], total: 1, page: 1, totalPages: 1,
      })),
      crearUsuario: jest.fn().mockReturnValue(of(usuario())),
      actualizarUsuario: jest.fn().mockReturnValue(of(usuario())),
      eliminarUsuario: jest.fn().mockReturnValue(of(undefined)),
      desactivarUsuario: jest.fn().mockReturnValue(of(undefined)),
      reactivarUsuario: jest.fn().mockReturnValue(of(undefined)),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsuariosComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsuariosComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // Dos esperas: `ngOnInit` encadena la carga de usuarios y la de comercios.
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimaConsulta = () => api['getUsuarios'].mock.calls.at(-1)![0];

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('listado', () => {
    it('debería cargar usuarios y comercios vinculables', async () => {
      await crear([usuario(), usuario({ _id: 'u2', email: 'luis@ruiz.com' })], 2);

      expect(componente.usuarios()).toHaveLength(2);
      expect(componente.comercios()).toEqual([{ _id: 'c1', nombreComercial: 'Canes' }]);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si no puede cargar los usuarios', async () => {
      await crear([], 0, { getUsuarios: fallo('500') });

      expect(componente.errorMsg()).toContain('Error cargando');
    });

    it('debería seguir funcionando si la lista de comercios falla', async () => {
      await crear([usuario()], 1, { getComercios: fallo('500') });

      expect(componente.usuarios()).toHaveLength(1);
      expect(componente.comercios()).toEqual([]);
    });

    it('debería calcular las páginas del listado', async () => {
      await crear([usuario()], 60);

      expect(componente.totalPaginas()).toBeGreaterThan(1);
    });
  });

  describe('filtros', () => {
    it('debería filtrar por rol volviendo a la primera página', async () => {
      await crear();
      await componente.cambiarPagina(2);

      await componente.setFiltro('admin');

      expect(componente.paginaActual()).toBe(1);
      expect(ultimaConsulta()).toMatchObject({ rol: 'admin', page: 1 });
    });

    it('debería omitir el rol al elegir "todos"', async () => {
      await crear();

      await componente.setFiltro('');

      expect(ultimaConsulta().rol).toBeUndefined();
    });
  });

  describe('alta', () => {
    it('debería exigir contraseña al crear', async () => {
      await crear();

      componente.abrirCrear();
      componente.form.patchValue({ nombre: 'Luis', email: 'luis@ruiz.com' });

      // Un usuario nuevo sin contraseña no podría iniciar sesión nunca.
      expect(componente.form.get('password')!.invalid).toBe(true);
    });

    it('debería rechazar contraseñas demasiado cortas', async () => {
      await crear();
      componente.abrirCrear();
      componente.form.patchValue({ nombre: 'Luis', email: 'luis@ruiz.com', password: '123' });

      await componente.guardar();

      expect(api['crearUsuario']).not.toHaveBeenCalled();
    });

    it('debería crear el usuario con sus credenciales', async () => {
      await crear();
      componente.abrirCrear();
      componente.form.patchValue({
        nombre: 'Luis', email: 'luis@ruiz.com', password: 'secreto123', telefono: '600000000',
      });

      await componente.guardar();

      expect(api['crearUsuario']).toHaveBeenCalledWith(expect.objectContaining({
        email: 'luis@ruiz.com', password: 'secreto123', rol: 'cliente',
      }));
      expect(componente.modalVisible()).toBe(false);
    });

    it('debería exigir comercio a las cuentas de comercio', async () => {
      await crear();
      componente.abrirCrear();
      componente.form.patchValue({
        nombre: 'Luis', email: 'luis@ruiz.com', password: 'secreto123', rol: 'comercio_admin',
      });

      await componente.guardar();

      // Una cuenta de comercio sin comercioId no vería datos de ningún negocio.
      expect(componente.modalError()).toContain('Selecciona el comercio');
      expect(api['crearUsuario']).not.toHaveBeenCalled();
      expect(componente.guardando()).toBe(false);
    });

    it('debería vincular la cuenta al comercio elegido', async () => {
      await crear();
      componente.abrirCrear();
      componente.form.patchValue({
        nombre: 'Luis', email: 'luis@ruiz.com', password: 'secreto123',
        rol: 'comercio_staff', comercioId: 'c1',
      });

      await componente.guardar();

      expect(api['crearUsuario']).toHaveBeenCalledWith(expect.objectContaining({ comercioId: 'c1' }));
    });

    it('no debería vincular comercio a un cliente', async () => {
      await crear();
      componente.abrirCrear();
      componente.form.patchValue({
        nombre: 'Luis', email: 'luis@ruiz.com', password: 'secreto123',
        rol: 'cliente', comercioId: 'c1',
      });

      await componente.guardar();

      expect(api['crearUsuario'].mock.calls[0][0].comercioId).toBeUndefined();
    });

    it('debería reconocer los roles de comercio', async () => {
      await crear();

      componente.form.patchValue({ rol: 'comercio_admin' });
      expect(componente.esRolComercio()).toBe(true);

      componente.form.patchValue({ rol: 'admin' });
      expect(componente.esRolComercio()).toBe(false);
    });
  });

  describe('edición', () => {
    it('debería cargar el usuario y no exigir contraseña nueva', async () => {
      await crear();

      componente.abrirEditar(usuario({ telefono: '600000000', rol: 'comercio_admin', comercioId: 'c1' }));

      // Editar un perfil no debe obligar a rotar la contraseña.
      expect(componente.form.get('password')!.valid).toBe(true);
      expect(componente.form.value).toMatchObject({ email: 'ana@ruiz.com', comercioId: 'c1' });
    });

    it('debería actualizar sin enviar contraseña', async () => {
      await crear();
      componente.abrirEditar(usuario());
      componente.form.patchValue({ nombre: 'Ana R.' });

      await componente.guardar();

      const [id, dto] = api['actualizarUsuario'].mock.calls[0];
      expect(id).toBe('u1');
      expect(dto.nombre).toBe('Ana R.');
      expect(dto).not.toHaveProperty('password');
    });

    it('debería mantener el modal abierto y enseñar el motivo que da el API', async () => {
      // El API sabe por qué rechaza (email en uso, último administrador…): ese
      // texto es el que le dice al operador qué hacer, no uno genérico.
      await crear();
      api['actualizarUsuario'].mockReturnValue(
        throwError(() => ({ status: 409, error: { message: 'Ya existe una cuenta con ese email.' } })),
      );
      componente.abrirEditar(usuario());

      await componente.guardar();

      expect(componente.modalVisible()).toBe(true);
      expect(componente.modalError()).toBe('Ya existe una cuenta con ese email.');
      expect(componente.guardando()).toBe(false);
    });

    it('debería caer a un texto propio si el API no explica el fallo', async () => {
      await crear();
      api['actualizarUsuario'].mockReturnValue(throwError(() => new Error('boom')));
      componente.abrirEditar(usuario());

      await componente.guardar();

      expect(componente.modalError()).toBe('Error guardando el usuario.');
    });

    it('debería cerrar el modal descartando la edición', async () => {
      await crear();
      componente.abrirEditar(usuario());

      componente.cerrarModal();

      expect(componente.modalVisible()).toBe(false);
      expect(componente.editandoId()).toBeNull();
    });
  });

  describe('desactivar y eliminar', () => {
    it('debería pedir confirmación antes de actuar', async () => {
      await crear();

      componente.confirmarAccion(usuario(), 'eliminar');

      expect(componente.usuarioAccion()?._id).toBe('u1');
      expect(componente.accion()).toBe('eliminar');
      expect(api['eliminarUsuario']).not.toHaveBeenCalled();
    });

    it('debería desactivar (baja reversible) y recargar tras confirmar', async () => {
      await crear();
      componente.confirmarAccion(usuario(), 'desactivar');

      await componente.ejecutarAccion();

      expect(api['desactivarUsuario']).toHaveBeenCalledWith('u1');
      expect(api['eliminarUsuario']).not.toHaveBeenCalled();
      expect(componente.usuarioAccion()).toBeNull();
      expect(api['getUsuarios']).toHaveBeenCalledTimes(2);
    });

    it('debería eliminar de verdad cuando se elige eliminar', async () => {
      await crear();
      componente.confirmarAccion(usuario(), 'eliminar');

      await componente.ejecutarAccion();

      expect(api['eliminarUsuario']).toHaveBeenCalledWith('u1');
      expect(api['desactivarUsuario']).not.toHaveBeenCalled();
    });

    it('debería mostrar el error del API sin cerrar el modal', async () => {
      await crear([], 0, { eliminarUsuario: fallo('500') });
      componente.confirmarAccion(usuario(), 'eliminar');

      await componente.ejecutarAccion();

      expect(componente.usuarioAccion()?._id).toBe('u1');
      expect(componente.modalError()).not.toBe('');
    });

    it('debería cancelar sin tocar la cuenta', async () => {
      await crear();
      componente.confirmarAccion(usuario(), 'desactivar');

      componente.cancelarAccion();

      expect(componente.usuarioAccion()).toBeNull();
      expect(api['desactivarUsuario']).not.toHaveBeenCalled();
    });

    it('no debería llamar al API sin usuario confirmado', async () => {
      await crear();

      await componente.ejecutarAccion();

      expect(api['eliminarUsuario']).not.toHaveBeenCalled();
      expect(api['desactivarUsuario']).not.toHaveBeenCalled();
    });

    it('debería listar los desactivados al filtrar por estado', async () => {
      await crear();

      componente.setBajas(true);

      expect(ultimaConsulta().bajas).toBe(true);
    });

    it('debería reactivar un usuario desactivado y recargar', async () => {
      await crear();

      await componente.reactivar(usuario());

      expect(api['reactivarUsuario']).toHaveBeenCalledWith('u1');
      expect(componente.reactivandoId()).toBeNull();
      expect(api['getUsuarios']).toHaveBeenCalledTimes(2);
    });

    it('debería avisar si la reactivación falla', async () => {
      await crear([], 0, { reactivarUsuario: fallo('500') });

      await componente.reactivar(usuario());

      expect(componente.errorMsg()).not.toBe('');
    });
  });

  describe('etiquetas de rol', () => {
    it('debería dar clase y nombre a cada rol', async () => {
      await crear();

      expect(componente.badgeRol('admin')).toContain('rs-badge--');
      expect(componente.labelRol('admin')).not.toBe('');
    });

    it('debería tolerar un rol desconocido', async () => {
      await crear();

      expect(componente.badgeRol('inventado')).toContain('neutral');
      expect(componente.labelRol('inventado')).toBe('inventado');
    });
  });
});
