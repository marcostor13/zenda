import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ComercioEquipoComponent } from './comercio-equipo.component';
import { ComercioApiService, MiembroEquipo } from './comercio-api.service';

const miembro = (extra: Partial<MiembroEquipo> = {}): MiembroEquipo => ({
  _id: 'u1', nombre: 'Ana', email: 'ana@canes.com', puesto: 'recepcion',
  ...extra,
} as MiembroEquipo);

/** Fallo síncrono: una promesa rechazada la reporta zone.js como error global. */
const fallo = (mensaje: string) => jest.fn(() => { throw new Error(mensaje); });

describe('ComercioEquipoComponent', () => {
  let fixture: ComponentFixture<ComercioEquipoComponent>;
  let componente: ComercioEquipoComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (equipo: MiembroEquipo[] = [miembro()], ajustes: Record<string, jest.Mock> = {}): Promise<void> => {
    api = {
      getMiEquipo: jest.fn().mockReturnValue(of(equipo)),
      crearMiembroEquipo: jest.fn().mockReturnValue(of(miembro({ _id: 'u2' }))),
      eliminarMiembroEquipo: jest.fn().mockReturnValue(of(undefined)),
      ...ajustes,
    };

    await TestBed.configureTestingModule({
      imports: [ComercioEquipoComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioEquipoComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rellenar = () => componente.form.patchValue({
    nombre: 'Luis', email: 'luis@canes.com', password: 'secreto123', puesto: 'veterinario',
  });

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('carga', () => {
    it('debería listar el equipo del comercio', async () => {
      await crear([miembro(), miembro({ _id: 'u2', nombre: 'Luis' })]);

      expect(componente.miembros()).toHaveLength(2);
      expect(componente.cargando()).toBe(false);
    });

    it('debería avisar si el equipo no carga', async () => {
      await crear([], { getMiEquipo: fallo('500') });

      expect(componente.errorMsg()).toContain('No se pudo cargar el equipo');
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('alta de miembro', () => {
    it('no debería crear nada con el formulario vacío', async () => {
      await crear();

      await componente.crear();

      expect(api['crearMiembroEquipo']).not.toHaveBeenCalled();
    });

    it('debería exigir un email válido', async () => {
      await crear();
      rellenar();
      componente.form.patchValue({ email: 'no-es-un-email' });

      await componente.crear();

      expect(api['crearMiembroEquipo']).not.toHaveBeenCalled();
    });

    it('debería exigir una contraseña de al menos 8 caracteres', async () => {
      await crear();
      rellenar();
      componente.form.patchValue({ password: 'corta' });

      await componente.crear();

      expect(api['crearMiembroEquipo']).not.toHaveBeenCalled();
    });

    it('debería crear el miembro con su puesto', async () => {
      await crear();
      rellenar();

      await componente.crear();

      expect(api['crearMiembroEquipo']).toHaveBeenCalledWith({
        nombre: 'Luis', email: 'luis@canes.com', password: 'secreto123', puesto: 'veterinario',
      });
      expect(componente.okMsg()).toContain('añadido');
    });

    it('debería limpiar el formulario y recargar el equipo', async () => {
      await crear();
      rellenar();

      await componente.crear();

      expect(componente.form.getRawValue().email).toBeFalsy();
      expect(componente.form.getRawValue().puesto).toBe('recepcion');
      expect(api['getMiEquipo']).toHaveBeenCalledTimes(2);
    });

    it('debería avisar de un email ya registrado', async () => {
      await crear([], { crearMiembroEquipo: fallo('409') });
      rellenar();

      await componente.crear();

      expect(componente.errorMsg()).toContain('email ya existe');
      expect(componente.guardando()).toBe(false);
    });
  });

  describe('baja de miembro', () => {
    it('debería quitar el miembro de la lista', async () => {
      await crear();

      await componente.eliminar(miembro());

      expect(api['eliminarMiembroEquipo']).toHaveBeenCalledWith('u1');
      expect(componente.miembros()).toHaveLength(0);
      expect(componente.eliminandoId()).toBe('');
    });

    it('debería conservarlo si la baja falla', async () => {
      await crear([miembro()], { eliminarMiembroEquipo: fallo('500') });

      await componente.eliminar(miembro());

      expect(componente.errorMsg()).toContain('No se pudo eliminar');
      expect(componente.miembros()).toHaveLength(1);
    });
  });

  describe('puestos', () => {
    it('debería traducir el puesto y tolerar los desconocidos', async () => {
      await crear();

      expect(componente.puestoLabel('recepcion')).not.toBe('');
      expect(componente.puestoLabel('inventado')).toBe('');
      expect(componente.puestoLabel()).toBe('');
    });
  });
  describe('estado de cada miembro', () => {
    it('deberia dar por activo al miembro ya verificado', async () => {
      await crear([miembro({ verificado: true })]);

      expect(componente.badgeEstado(miembro({ verificado: true }))).toContain('success');
      expect(componente.etiquetaEstado(miembro({ verificado: true }))).toBeTruthy();
    });

    it('deberia marcar como invitacion pendiente a quien no ha verificado el email', async () => {
      await crear();
      const pendiente = miembro({ requiereVerificacionEmail: true, verificado: false });

      expect(componente.badgeEstado(pendiente)).toContain('warning');
    });

    it('deberia marcar como desactivado y ganar sobre la verificacion pendiente', async () => {
      // Alguien desactivado no es "pendiente de aceptar la invitacion": no entra.
      await crear();
      const baja = miembro({ activo: false, requiereVerificacionEmail: true, verificado: false });

      expect(componente.badgeEstado(baja)).toContain('neutral');
    });
  });

  describe('resumen de acceso', () => {
    it('deberia decir "todo el panel" cuando no hay permisos marcados', async () => {
      // Es como funcionaba el panel antes de que existieran los permisos.
      await crear();

      expect(componente.resumenAcceso(miembro())).toBe('todo el panel');
      expect(componente.resumenAcceso(miembro({ permisosComercio: [] }))).toBe('todo el panel');
    });

    it('deberia listar los permisos traducidos', async () => {
      await crear();

      const resumen = componente.resumenAcceso(miembro({ permisosComercio: ['reservas'] }));

      expect(resumen).not.toBe('todo el panel');
      expect(resumen.length).toBeGreaterThan(0);
    });

    it('deberia dejar en crudo un permiso desconocido en vez de romperse', async () => {
      await crear();

      expect(componente.resumenAcceso(miembro({ permisosComercio: ['inventado'] }))).toBe('inventado');
    });
  });

  describe('edicion de permisos', () => {
    it('deberia abrir el panel precargando permisos y puesto', async () => {
      await crear();
      const m = miembro({ permisosComercio: ['reservas'], puesto: 'gerente' });

      componente.abrirPermisos(m);

      expect(componente.editandoId()).toBe('u1');
      expect(componente.tienePermiso('reservas')).toBe(true);
      expect(componente.puestoEdit()).toBe('gerente');
    });

    it('deberia cerrar el panel al volver a pulsar el mismo miembro', async () => {
      await crear();

      componente.abrirPermisos(miembro());
      componente.abrirPermisos(miembro());

      expect(componente.editandoId()).toBe('');
    });

    it('deberia alternar un permiso en los dos sentidos', async () => {
      await crear();
      componente.abrirPermisos(miembro());

      componente.alternarPermiso('reservas');
      expect(componente.tienePermiso('reservas')).toBe(true);

      componente.alternarPermiso('reservas');
      expect(componente.tienePermiso('reservas')).toBe(false);
    });

    it('deberia guardar permisos y puesto y cerrar el panel', async () => {
      const actualizar = jest.fn().mockReturnValue(of(miembro({ puesto: 'gerente' })));
      await crear([miembro()], { actualizarMiembroEquipo: actualizar });
      componente.abrirPermisos(miembro());
      componente.puestoEdit.set('gerente');
      componente.alternarPermiso('reservas');

      await componente.guardarPermisos(miembro());

      expect(actualizar).toHaveBeenCalledWith('u1', {
        puesto: 'gerente',
        permisosComercio: ['reservas'],
      });
      expect(componente.editandoId()).toBe('');
    });

    it('deberia enviar puesto indefinido si se deja en blanco', async () => {
      const actualizar = jest.fn().mockReturnValue(of(miembro()));
      await crear([miembro()], { actualizarMiembroEquipo: actualizar });
      componente.abrirPermisos(miembro());
      componente.puestoEdit.set('');

      await componente.guardarPermisos(miembro());

      expect(actualizar.mock.calls[0][1].puesto).toBeUndefined();
    });
  });

  describe('activar y desactivar', () => {
    it('deberia reactivar a quien estaba desactivado', async () => {
      const actualizar = jest.fn().mockReturnValue(of(miembro({ activo: true })));
      await crear([miembro({ activo: false })], { actualizarMiembroEquipo: actualizar });

      await componente.alternarActivo(miembro({ activo: false }));

      expect(actualizar).toHaveBeenCalledWith('u1', { activo: true });
    });

    it('deberia desactivar en vez de eliminar, para conservar el historial', async () => {
      const actualizar = jest.fn().mockReturnValue(of(miembro({ activo: false })));
      await crear([miembro({ activo: true })], { actualizarMiembroEquipo: actualizar });

      await componente.alternarActivo(miembro({ activo: true }));

      expect(actualizar).toHaveBeenCalledWith('u1', { activo: false });
      expect(api['eliminarMiembroEquipo']).not.toHaveBeenCalled();
    });

    it('deberia avisar y desbloquear la fila si la actualizacion falla', async () => {
      await crear([miembro()], { actualizarMiembroEquipo: fallo('500') });

      await componente.alternarActivo(miembro());

      expect(componente.errorMsg()).toContain('No se pudo actualizar');
      expect(componente.guardandoMiembroId()).toBe('');
    });
  });

  it('deberia traducir el puesto y devolver vacio si no lo conoce', async () => {
    await crear();

    expect(componente.puestoLabel('inventado')).toBe('');
    expect(componente.puestoLabel(undefined)).toBe('');
  });
});
