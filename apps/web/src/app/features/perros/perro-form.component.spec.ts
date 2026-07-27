import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Vacuna } from 'shared';
import { PerroFormComponent } from './perro-form.component';
import { PerroApi, PerroPayload, PerrosService } from './perros.service';

const perro = (extra: Partial<PerroApi> = {}): PerroApi => ({
  _id: 'p1', nombre: 'Maya', esterilizado: false, esMestizo: false,
  puedeQuedarseSolo: true, ansiedadSeparacion: false, seMarea: false,
  requiereTransportin: false, autorizaCompartirHistorial: true,
  ...extra,
} as PerroApi);

describe('PerroFormComponent', () => {
  let fixture: ComponentFixture<PerroFormComponent>;
  let componente: PerroFormComponent;
  let service: Record<string, jest.Mock>;
  let router: Router;

  const crear = async (id: string | null = null, datos: PerroApi | Error = perro()): Promise<void> => {
    service = {
      obtener: datos instanceof Error
        ? jest.fn(() => { throw datos; })
        : jest.fn().mockResolvedValue(datos),
      crear: jest.fn().mockResolvedValue(perro()),
      actualizar: jest.fn().mockResolvedValue(perro()),
    };

    await TestBed.configureTestingModule({
      imports: [PerroFormComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PerrosService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PerroFormComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const payload = (): PerroPayload =>
    (service['crear'].mock.calls[0]?.[0] ?? service['actualizar'].mock.calls[0]?.[1]) as PerroPayload;

  afterEach(() => {
    fixture?.destroy();
    jest.clearAllMocks();
  });

  describe('alta frente a edición', () => {
    it('debería empezar en blanco sin id en la ruta', async () => {
      await crear();

      expect(componente.esEdicion()).toBe(false);
      expect(service['obtener']).not.toHaveBeenCalled();
    });

    it('debería cargar la ficha existente al editar', async () => {
      await crear('p1', perro({
        raza: 'Border Collie', peso: 18, tipoPelo: ['largo'],
        fechaNacimiento: '2023-05-10T00:00:00.000Z',
        miedos: ['tormentas', 'petardos'],
      }));

      expect(componente.esEdicion()).toBe(true);
      expect(componente.form.getRawValue()).toMatchObject({ raza: 'Border Collie', peso: 18 });
      // El input date solo entiende YYYY-MM-DD.
      expect(componente.form.getRawValue().fechaNacimiento).toBe('2023-05-10');
      expect(componente.form.getRawValue().miedos).toEqual(['tormentas', 'petardos']);
      expect(componente.tienePelo('largo')).toBe(true);
    });

    it('debería avisar si la ficha no se puede cargar', async () => {
      await crear('p1', new Error('404'));

      expect(componente.errorMsg()).toContain('No se pudo cargar');
      expect(componente.cargando()).toBe(false);
    });
  });

  describe('validación', () => {
    it('no debería guardar sin nombre', async () => {
      await crear();

      await componente.submit();

      expect(service['crear']).not.toHaveBeenCalled();
      expect(componente.form.touched).toBe(true);
    });

    it('debería rechazar un peso imposible', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya', peso: 500 });

      await componente.submit();

      expect(service['crear']).not.toHaveBeenCalled();
    });

    it('debería señalar solo los campos ya tocados', async () => {
      await crear();

      expect(componente.hasError('nombre')).toBe(false);
      componente.form.controls.nombre.markAsTouched();
      expect(componente.hasError('nombre')).toBe(true);
    });
  });

  describe('tipo de pelo', () => {
    it('debería alternar los tipos marcados', async () => {
      await crear();

      componente.togglePelo('rizado');
      expect(componente.tienePelo('rizado')).toBe(true);

      componente.togglePelo('rizado');
      expect(componente.tienePelo('rizado')).toBe(false);
    });

    it('debería enviar los tipos de pelo elegidos', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });
      componente.togglePelo('corto');
      componente.togglePelo('doble_capa');

      await componente.submit();

      expect(payload().tipoPelo).toEqual(['corto', 'doble_capa']);
    });
  });

  describe('vacunas', () => {
    it('debería marcar y desmarcar una vacuna del catálogo', async () => {
      await crear();

      componente.alternarVacuna(Vacuna.ANTIRRABICA);
      expect(componente.tieneVacuna(Vacuna.ANTIRRABICA)).toBe(true);

      componente.alternarVacuna(Vacuna.ANTIRRABICA);
      expect(componente.tieneVacuna(Vacuna.ANTIRRABICA)).toBe(false);
    });

    it('debería guardar la fecha de aplicación', async () => {
      await crear();
      componente.alternarVacuna(Vacuna.ANTIRRABICA);

      componente.cambiarFechaVacuna(Vacuna.ANTIRRABICA, {
        target: { value: '2026-03-01' },
      } as unknown as Event);

      expect(componente.fechaVacuna(Vacuna.ANTIRRABICA)).toBe('2026-03-01');
    });

    it('debería permitir borrar una fecha equivocada', async () => {
      await crear();
      componente.alternarVacuna(Vacuna.ANTIRRABICA);
      componente.cambiarFechaVacuna(Vacuna.ANTIRRABICA, { target: { value: '2026-03-01' } } as unknown as Event);

      componente.cambiarFechaVacuna(Vacuna.ANTIRRABICA, { target: { value: '' } } as unknown as Event);

      expect(componente.fechaVacuna(Vacuna.ANTIRRABICA)).toBe('');
    });

    it('debería recortar la hora de la fecha guardada', async () => {
      await crear('p1', perro({
        vacunasDetalle: [{ tipo: Vacuna.ANTIRRABICA, fecha: '2026-03-01T00:00:00.000Z' }],
      }));

      expect(componente.fechaVacuna(Vacuna.ANTIRRABICA)).toBe('2026-03-01');
    });

    it('debería enviar las vacunas con su fecha', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });
      componente.alternarVacuna(Vacuna.ANTIRRABICA);

      await componente.submit();

      expect(payload().vacunasDetalle).toEqual([{ tipo: Vacuna.ANTIRRABICA }]);
    });
  });

  describe('guardado', () => {
    it('debería registrar el perro y volver al listado', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya', raza: 'Border Collie' });
      jest.useFakeTimers();

      await componente.submit();
      jest.runAllTimers();

      expect(service['crear']).toHaveBeenCalled();
      expect(componente.exitoMsg()).toContain('registrado');
      expect(router.navigate).toHaveBeenCalledWith(['/perros']);
      jest.useRealTimers();
    });

    it('debería actualizar la ficha existente', async () => {
      await crear('p1');
      componente.form.patchValue({ nombre: 'Maya II' });

      await componente.submit();

      expect(service['actualizar']).toHaveBeenCalledWith('p1', expect.objectContaining({ nombre: 'Maya II' }));
      expect(componente.exitoMsg()).toContain('guardados');
    });

    it('debería enviar como listas las etiquetas elegidas', async () => {
      await crear();
      componente.form.patchValue({
        nombre: 'Maya', miedos: ['Tormentas', 'Petardos'], alergias: ['Pollo'],
      });

      await componente.submit();

      expect(payload().miedos).toEqual(['Tormentas', 'Petardos']);
      expect(payload().alergias).toEqual(['Pollo']);
    });

    it('debería enviar listas vacías cuando no se marca ninguna etiqueta', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });

      await componente.submit();

      expect(payload().miedos).toEqual([]);
      expect(payload().medicacion).toEqual([]);
    });

    it('debería omitir los campos opcionales vacíos', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });

      await componente.submit();

      // Enviar cadenas vacías guardaría "sin raza" como si fuera un dato.
      expect(payload().raza).toBeUndefined();
      expect(payload().dieta).toBeUndefined();
      expect(payload().sexo).toBeUndefined();
    });

    it('debería informar del fallo sin bloquear el botón', async () => {
      await crear();
      service['crear'].mockRejectedValue(new Error('500'));
      componente.form.patchValue({ nombre: 'Maya' });

      await componente.submit();

      expect(componente.errorMsg()).toContain('Error al guardar');
      expect(componente.guardando()).toBe(false);
    });
  });
});
