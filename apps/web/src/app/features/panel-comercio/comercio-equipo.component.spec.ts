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
});
