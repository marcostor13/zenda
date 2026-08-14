import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { CuponesAdminComponent } from './cupones-admin.component';
import { Cupon, CuponesAdminService } from './services/cupones-admin.service';
import { AdminApiService } from './admin-api.service';

const cupon = (extra: Partial<Cupon> = {}): Cupon => ({
  _id: 'cup1', codigo: 'VERANO', tipo: 'porcentaje', valor: 0.1,
  vertical: 'global', montoMinimo: 0, activo: true,
  ...extra,
});

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('CuponesAdminComponent', () => {
  let fixture: ComponentFixture<CuponesAdminComponent>;
  let componente: CuponesAdminComponent;
  let service: Record<string, jest.Mock>;
  let adminApi: Record<string, jest.Mock>;

  const crear = async (
    cupones: Cupon[] = [cupon()],
    ajustes: { service?: Record<string, jest.Mock>; admin?: Record<string, jest.Mock> } = {},
  ): Promise<void> => {
    service = {
      listar: jest.fn().mockResolvedValue(cupones),
      crear: jest.fn().mockResolvedValue(cupon()),
      ...ajustes.service,
    };
    adminApi = {
      actualizarCupon: jest.fn().mockReturnValue(of(cupon())),
      eliminarCupon: jest.fn().mockReturnValue(of(undefined)),
      ...ajustes.admin,
    };

    await TestBed.configureTestingModule({
      imports: [CuponesAdminComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CuponesAdminService, useValue: service },
        { provide: AdminApiService, useValue: adminApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CuponesAdminComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Deja el formulario en un estado válido para poder guardar. */
  const rellenar = () => componente.form.patchValue({ codigo: 'otoño', valor: 0.15, vertical: 'alojamiento' });

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('listado', () => {
    it('debería cargar los cupones al entrar', async () => {
      await crear([cupon(), cupon({ _id: 'cup2', codigo: 'INVIERNO' })]);

      expect(componente.cupones()).toHaveLength(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería quedarse con la lista vacía si el API falla', async () => {
      await crear([], { service: { listar: fallo('500'), crear: jest.fn() } });

      expect(componente.cupones()).toEqual([]);
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('alta', () => {
    it('no debería guardar sin código', async () => {
      await crear();

      await componente.guardar();

      expect(service['crear']).not.toHaveBeenCalled();
    });

    it('debería crear el cupón normalizando el código a mayúsculas', async () => {
      await crear();
      rellenar();

      await componente.guardar();

      // El cupón se valida en mayúsculas: crearlo en minúsculas lo haría inutilizable.
      expect(service['crear']).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'OTOÑO' }));
      expect(componente.formOk()).toContain('creado');
    });

    it('debería vaciar el código tras crear, para encadenar altas', async () => {
      await crear();
      rellenar();

      await componente.guardar();

      expect(componente.form.value.codigo).toBe('');
      expect(componente.form.value.vertical).toBe('alojamiento');
    });

    it('debería avisar de un código duplicado', async () => {
      await crear();
      service['crear'].mockRejectedValue(new Error('409'));
      rellenar();

      await componente.guardar();

      expect(componente.formError()).toContain('duplicado');
      expect(componente.guardando()).toBe(false);
    });

    it('debería recargar la lista tras crear', async () => {
      await crear();
      rellenar();

      await componente.guardar();

      expect(service['listar']).toHaveBeenCalledTimes(2);
    });
  });

  describe('edición', () => {
    it('debería volcar el cupón al formulario', async () => {
      await crear();
      jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

      componente.iniciarEdicion(cupon({ topeDescuento: 25, descripcion: 'Rebajas' }));

      expect(componente.editandoId()).toBe('cup1');
      expect(componente.form.value).toMatchObject({ codigo: 'VERANO', topeDescuento: 25, descripcion: 'Rebajas' });
    });

    it('debería actualizar sin tocar el código', async () => {
      await crear();
      jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      componente.iniciarEdicion(cupon());
      // El formulario habla en porcentaje entero; el API sigue guardando fracción.
      componente.form.patchValue({ valor: 25 });

      await componente.guardar();

      const [id, dto] = adminApi['actualizarCupon'].mock.calls[0];
      expect(id).toBe('cup1');
      expect(dto.valor).toBe(0.25);
      // Cambiar el código rompería los enlaces ya repartidos a los clientes.
      expect(dto).not.toHaveProperty('codigo');
    });

    it('debería salir del modo edición tras guardar', async () => {
      await crear();
      jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      componente.iniciarEdicion(cupon());

      await componente.guardar();

      expect(componente.editandoId()).toBeNull();
    });

    it('debería avisar si la actualización falla', async () => {
      await crear();
      jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      adminApi['actualizarCupon'] = fallo('500');
      componente.iniciarEdicion(cupon());

      await componente.guardar();

      expect(componente.formError()).toContain('No se pudo actualizar');
    });

    it('debería cancelar la edición devolviendo los valores por defecto', async () => {
      await crear();
      jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      componente.iniciarEdicion(cupon());

      componente.cancelarEdicion();

      expect(componente.editandoId()).toBeNull();
      expect(componente.form.value).toMatchObject({ tipo: 'porcentaje', valor: 20, vertical: 'global' });
    });
  });

  describe('activar y desactivar', () => {
    it('debería invertir el estado del cupón', async () => {
      await crear();

      await componente.toggleActivo(cupon({ activo: true }));

      expect(adminApi['actualizarCupon']).toHaveBeenCalledWith('cup1', { activo: false });
      expect(service['listar']).toHaveBeenCalledTimes(2);
    });

    it('no debería hacer nada con un cupón sin id', async () => {
      await crear();

      await componente.toggleActivo(cupon({ _id: undefined }));

      expect(adminApi['actualizarCupon']).not.toHaveBeenCalled();
    });
  });

  describe('eliminación', () => {
    it('debería pedir confirmación antes de borrar', async () => {
      await crear();

      componente.confirmarEliminar(cupon());

      expect(componente.eliminarCupon()?._id).toBe('cup1');
      expect(adminApi['eliminarCupon']).not.toHaveBeenCalled();
    });

    it('debería borrar tras confirmar', async () => {
      await crear();
      componente.confirmarEliminar(cupon());

      await componente.ejecutarEliminar();

      expect(adminApi['eliminarCupon']).toHaveBeenCalledWith('cup1');
      expect(componente.eliminarCupon()).toBeNull();
    });

    it('debería cancelar sin borrar', async () => {
      await crear();
      componente.confirmarEliminar(cupon());

      componente.cancelarEliminar();

      expect(componente.eliminarCupon()).toBeNull();
      expect(adminApi['eliminarCupon']).not.toHaveBeenCalled();
    });

    it('debería informar del fallo al eliminar', async () => {
      await crear();
      adminApi['eliminarCupon'] = fallo('500');
      componente.confirmarEliminar(cupon());

      await componente.ejecutarEliminar();

      expect(componente.deleteError()).toContain('Error eliminando');
      expect(componente.guardando()).toBe(false);
    });

    it('no debería llamar al API sin cupón confirmado', async () => {
      await crear();

      await componente.ejecutarEliminar();

      expect(adminApi['eliminarCupon']).not.toHaveBeenCalled();
    });
  });
});
