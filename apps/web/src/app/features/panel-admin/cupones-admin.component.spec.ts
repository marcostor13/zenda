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
  /**
   * Cada casilla de "sin limite" esconde un 0 en el formulario. Confundir "0
   * como sin tope" con "0 como tope real" es la diferencia entre un cupon sin
   * limite y uno que no descuenta nada.
   */
  describe('casillas de sin limite', () => {
    it('deberia arrancar con las tres opciones sin limite marcadas', async () => {
      await crear();

      expect(componente.sinTope()).toBe(true);
      expect(componente.usosIlimitados()).toBe(true);
      expect(componente.sinCaducidad()).toBe(true);
      expect(componente.usosPorUsuarioIlimitado()).toBe(true);
    });

    it('deberia dejar teclear un tope al desmarcar "sin tope"', async () => {
      await crear();

      componente.alternarSinTope();
      expect(componente.sinTope()).toBe(false);

      componente.form.patchValue({ topeDescuento: 25 });
      componente.alternarSinTope();

      // Al volver a marcarla, el tope tecleado se descarta a 0.
      expect(componente.sinTope()).toBe(true);
      expect(componente.form.value.topeDescuento).toBe(0);
    });

    it('deberia borrar el maximo de usos al volver a "ilimitados"', async () => {
      await crear();
      componente.alternarUsosIlimitados();
      componente.form.patchValue({ usoMaximo: 100 });

      componente.alternarUsosIlimitados();

      expect(componente.form.value.usoMaximo).toBe(0);
    });

    it('deberia borrar la caducidad al volver a "sin caducidad"', async () => {
      await crear();
      componente.alternarSinCaducidad();
      componente.form.patchValue({ validoHasta: '2026-12-31' });

      componente.alternarSinCaducidad();

      expect(componente.form.value.validoHasta).toBe('');
    });

    it('deberia borrar los usos por usuario al volver a ilimitado', async () => {
      await crear();
      componente.alternarUsosPorUsuario();
      componente.form.patchValue({ usosPorUsuario: 3 });

      componente.alternarUsosPorUsuario();

      expect(componente.form.value.usosPorUsuario).toBe(0);
    });

    it('no deberia tocar el valor mientras la casilla esta desmarcada', async () => {
      await crear();

      componente.alternarSinTope();
      componente.form.patchValue({ topeDescuento: 25 });

      expect(componente.form.value.topeDescuento).toBe(25);
    });
  });

  describe('apertura del formulario', () => {
    it('deberia empezar cerrado y abrirse al pulsar', async () => {
      await crear();

      expect(componente.formularioVisible()).toBe(false);

      componente.alternarFormulario();

      expect(componente.formularioVisible()).toBe(true);
    });

    it('deberia cancelar la edicion al cerrarlo', async () => {
      // Si no, reabrirlo mostraria los datos del cupon anterior.
      await crear();
      componente.alternarFormulario();
      componente.iniciarEdicion(cupon({ _id: 'cup1', codigo: 'INVIERNO' }));

      componente.alternarFormulario();

      expect(componente.formularioVisible()).toBe(false);
      expect(componente.form.value.codigo).not.toBe('INVIERNO');
    });
  });

  /*
   * El admin escribe "20" para un 20 %, pero el backend guarda la fracción. Si
   * se manda el entero, un cupón del 20 % descuenta el 2000 % de la reserva.
   */
  describe('valor del descuento', () => {
    /** Datos con los que se llamó a crear. */
    const creado = (): Record<string, unknown> => service['crear'].mock.calls.at(-1)![0];

    it('deberia guardar el porcentaje como fraccion', async () => {
      await crear();
      componente.form.patchValue({ codigo: 'otoño', tipo: 'porcentaje', valor: 20 });

      await componente.guardar();

      expect(creado()['valor']).toBe(0.2);
    });

    it('deberia guardar el importe fijo tal cual, en euros', async () => {
      await crear();
      componente.form.patchValue({ codigo: 'otoño', tipo: 'fijo', valor: 15 });

      await componente.guardar();

      expect(creado()['valor']).toBe(15);
    });

    /* Un cupón a cero es un cupón sin descuento, no un formulario a medias. */
    it('deberia guardar un descuento de cero sin convertirlo en NaN', async () => {
      await crear();
      componente.form.patchValue({ codigo: 'otoño', tipo: 'fijo', valor: 0 });

      await componente.guardar();

      expect(creado()['valor']).toBe(0);
    });

    it('deberia devolver el porcentaje a enteros al editarlo', async () => {
      await crear();

      componente.iniciarEdicion(cupon({ tipo: 'porcentaje', valor: 0.25 }));

      expect(componente.form.value.valor).toBe(25);
    });

    it('no deberia reescalar un importe fijo al editarlo', async () => {
      await crear();

      componente.iniciarEdicion(cupon({ tipo: 'fijo', valor: 15 }));

      expect(componente.form.value.valor).toBe(15);
    });
  });

  describe('alcance del cupon', () => {
    const creado = (): Record<string, unknown> => service['crear'].mock.calls.at(-1)![0];

    it('deberia acotarlo a comercio, ciudad, nivel alpha y campana', async () => {
      await crear();
      rellenar();
      componente.form.patchValue({
        comercioId: 'com-1', ciudad: 'Valencia', nivelAlphaMinimo: 2, campanaId: 'camp-1',
      });

      await componente.guardar();

      expect(creado()).toMatchObject({
        comercioId: 'com-1', ciudad: 'Valencia', nivelAlphaMinimo: 2, campanaId: 'camp-1',
      });
    });

    /* Un campo en blanco es "sin restricción", no una cadena vacía que no case con nada. */
    it('no deberia mandar los campos de alcance vacios', async () => {
      await crear();
      rellenar();

      await componente.guardar();

      expect(creado()).toMatchObject({
        comercioId: undefined, ciudad: undefined, campanaId: undefined, nivelAlphaMinimo: 0,
      });
    });

    it('deberia mandar cero usos por usuario cuando es ilimitado', async () => {
      await crear();
      rellenar();
      componente.form.patchValue({ usosPorUsuario: 3 });

      await componente.guardar();

      expect(creado()['usosPorUsuario']).toBe(0);
    });

    it('deberia respetar el limite por usuario al desmarcar ilimitado', async () => {
      await crear();
      rellenar();
      componente.alternarUsosPorUsuario();
      componente.form.patchValue({ usosPorUsuario: 3 });

      await componente.guardar();

      expect(creado()['usosPorUsuario']).toBe(3);
    });
  });

  describe('edicion de un cupon incompleto', () => {
    /* Los cupones antiguos no traen los campos nuevos: el formulario no puede
     * quedarse con `undefined` en un control ni inventar restricciones. */
    it('deberia rellenar con valores neutros lo que el cupon no trae', async () => {
      await crear();

      componente.iniciarEdicion(cupon({
        topeDescuento: undefined, usoMaximo: undefined, validoHasta: undefined,
        asumeDescuento: undefined, soloPrimeraReserva: undefined, usosPorUsuario: undefined,
        comercioId: undefined, ciudad: undefined, nivelAlphaMinimo: undefined,
        campanaId: undefined, descripcion: undefined,
      }));

      expect(componente.form.value).toMatchObject({
        topeDescuento: 0, usoMaximo: 0, validoHasta: '', asumeDescuento: 'plataforma',
        soloPrimeraReserva: false, usosPorUsuario: 1, comercioId: '', ciudad: '',
        nivelAlphaMinimo: 0, campanaId: '', descripcion: '',
      });
      expect(componente.sinTope()).toBe(true);
      expect(componente.usosIlimitados()).toBe(true);
      expect(componente.sinCaducidad()).toBe(true);
    });

    it('deberia recortar la caducidad a la fecha, sin la hora', async () => {
      await crear();

      componente.iniciarEdicion(cupon({ validoHasta: '2026-12-31T23:59:59.000Z' }));

      expect(componente.form.value.validoHasta).toBe('2026-12-31');
      expect(componente.sinCaducidad()).toBe(false);
    });

    it('deberia identificar por codigo un cupon sin id', async () => {
      await crear();

      componente.iniciarEdicion(cupon({ _id: undefined }));

      expect(componente.editandoId()).toBe('VERANO');
    });
  });

  describe('carga de datos auxiliares', () => {
    it('deberia seguir funcionando si no se pueden cargar los comercios', async () => {
      // Sin la lista el cupon se queda con alcance global, que sigue siendo valido.
      await crear([cupon()], { admin: { getComercios: fallo('500') } });

      expect(componente.comercios()).toEqual([]);
      expect(componente.cupones()).toHaveLength(1);
    });
  });
});
