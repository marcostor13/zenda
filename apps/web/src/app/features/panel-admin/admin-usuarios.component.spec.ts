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

    it('debería mantener el modal abierto si el email ya existe', async () => {
      await crear();
      api['actualizarUsuario'].mockReturnValue(throwError(() => new Error('409')));
      componente.abrirEditar(usuario());

      await componente.guardar();

      expect(componente.modalVisible()).toBe(true);
      expect(componente.modalError()).toContain('email no esté en uso');
      expect(componente.guardando()).toBe(false);
    });

    it('debería cerrar el modal descartando la edición', async () => {
      await crear();
      componente.abrirEditar(usuario());

      componente.cerrarModal();

      expect(componente.modalVisible()).toBe(false);
      expect(componente.editandoId()).toBeNull();
    });
  });

  describe('eliminación', () => {
    it('debería pedir confirmación antes de borrar', async () => {
      await crear();

      componente.confirmarEliminar(usuario());

      expect(componente.eliminarUsuario()?._id).toBe('u1');
      expect(api['eliminarUsuario']).not.toHaveBeenCalled();
    });

    it('debería borrar y recargar tras confirmar', async () => {
      await crear();
      componente.confirmarEliminar(usuario());

      await componente.ejecutarEliminar();

      expect(api['eliminarUsuario']).toHaveBeenCalledWith('u1');
      expect(componente.eliminarUsuario()).toBeNull();
      expect(api['getUsuarios']).toHaveBeenCalledTimes(2);
    });

    it('debería cancelar sin borrar', async () => {
      await crear();
      componente.confirmarEliminar(usuario());

      componente.cancelarEliminar();

      expect(componente.eliminarUsuario()).toBeNull();
      expect(api['eliminarUsuario']).not.toHaveBeenCalled();
    });

    it('no debería llamar al API sin usuario confirmado', async () => {
      await crear();

      await componente.ejecutarEliminar();

      expect(api['eliminarUsuario']).not.toHaveBeenCalled();
    });

    it('debería informar del fallo al eliminar', async () => {
      await crear();
      api['eliminarUsuario'].mockReturnValue(throwError(() => new Error('500')));
      componente.confirmarEliminar(usuario());

      await componente.ejecutarEliminar();

      expect(componente.modalError()).toContain('Error eliminando');
      expect(componente.eliminarUsuario()).not.toBeNull();
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
