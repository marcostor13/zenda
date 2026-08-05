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

    it('debería explicar que la foto no se subió en vez de callar (TCK-8012)', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });
      componente.form.controls.fotos.setErrors({ subidaFallida: true });

      await componente.submit();

      expect(service['crear']).not.toHaveBeenCalled();
      expect(componente.errorMsg()).toContain('no se pudo subir');
    });

    it('debería pedir esperar mientras la foto se está subiendo', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });
      componente.form.controls.fotos.setErrors({ subidaEnCurso: true });

      await componente.submit();

      expect(componente.errorMsg()).toContain('Espera a que termine');
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

  describe('wizard por bloques (HU-8.2.2)', () => {
    it('debería empezar en el paso 1 y avanzar/retroceder', async () => {
      await crear();
      expect(componente.paso()).toBe(1);

      await componente.siguiente();
      expect(componente.paso()).toBe(2);

      componente.atras();
      expect(componente.paso()).toBe(1);
    });

    it('no debería retroceder antes del primer paso ni avanzar más allá del último', async () => {
      await crear();
      componente.atras();
      expect(componente.paso()).toBe(1);

      componente.irAPaso(6);
      await componente.siguiente();
      expect(componente.paso()).toBe(6);
    });

    it('debería seguir validando el formulario entero al enviar, sin importar en qué paso esté', async () => {
      await crear();
      componente.irAPaso(3);

      await componente.submit();

      expect(service['crear']).not.toHaveBeenCalled();
      expect(componente.form.touched).toBe(true);
    });

    it('no debería autoguardar sin nombre todavía (nada que crear)', async () => {
      await crear();

      await componente.siguiente();

      expect(service['crear']).not.toHaveBeenCalled();
      expect(componente.paso()).toBe(2);
    });

    it('debería autoguardar como borrador al avanzar de paso una vez hay nombre', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });
      jest.useFakeTimers();

      await componente.siguiente();

      expect(service['crear']).toHaveBeenCalled();
      expect(componente.perroId()).toBe('p1');
      expect(componente.autoguardadoMsg()).toContain('Guardado automáticamente');
      jest.runAllTimers();
      expect(componente.autoguardadoMsg()).toBe('');
      jest.useRealTimers();
    });

    it('debería actualizar (no volver a crear) en los siguientes autoguardados del mismo borrador', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya' });

      await componente.siguiente();
      await componente.siguiente();

      expect(service['crear']).toHaveBeenCalledTimes(1);
      expect(service['actualizar']).toHaveBeenCalledTimes(1);
    });

    it('un fallo de autoguardado no debe bloquear la navegación', async () => {
      await crear();
      service['crear'].mockRejectedValue(new Error('500'));
      componente.form.patchValue({ nombre: 'Maya' });

      await componente.siguiente();

      expect(componente.paso()).toBe(2);
    });
  });

  describe('% de completitud (HU-8.1.2/8.2.8)', () => {
    it('debería subir a medida que se rellenan campos opcionales', async () => {
      await crear();
      const inicial = componente.completitud();

      componente.form.patchValue({ raza: 'Golden Retriever', peso: 20, temperamento: 'tranquilo' });

      expect(componente.completitud()).toBeGreaterThan(inicial);
    });

    it('debería ser 0% en una ficha completamente en blanco', async () => {
      await crear();
      expect(componente.completitud()).toBe(0);
    });
  });

  describe('temperamento y sociabilidad con chips (HU-8.2.3)', () => {
    it('debería seleccionar un temperamento del catálogo cerrado', async () => {
      await crear();

      componente.elegirTemperamento('Activo');

      expect(componente.form.controls.temperamento.value).toBe('Activo');
    });

    it('debería deseleccionar el temperamento si se pulsa de nuevo el mismo chip', async () => {
      await crear();
      componente.elegirTemperamento('Activo');

      componente.elegirTemperamento('Activo');

      expect(componente.form.controls.temperamento.value).toBe('');
    });

    it('debería fijar el nivel de sociabilidad con perros mediante el selector gráfico', async () => {
      await crear();

      componente.elegirNivel('sociabilidadPerros', 'alta');

      expect(componente.form.controls.sociabilidadPerros.value).toBe('alta');
    });

    it('debería mantener sociabilidad con perros y con personas de forma independiente', async () => {
      await crear();

      componente.elegirNivel('sociabilidadPerros', 'alta');
      componente.elegirNivel('sociabilidadPersonas', 'baja');

      expect(componente.form.controls.sociabilidadPerros.value).toBe('alta');
      expect(componente.form.controls.sociabilidadPersonas.value).toBe('baja');
    });
  });

  describe('ciudad, fotos y documentación (HU-8.1.1/8.2.2)', () => {
    it('debería enviar la ciudad y las fotos en el payload', async () => {
      await crear();
      componente.form.patchValue({ nombre: 'Maya', ciudad: 'Madrid', fotos: ['maya.jpg'] });

      await componente.submit();

      expect(payload().ciudad).toBe('Madrid');
      expect(payload().fotos).toEqual(['maya.jpg']);
    });

    it('debería enviar los documentos cuando se han subido', async () => {
      await crear();
      componente.form.patchValue({
        nombre: 'Maya',
        cartillaSanitariaUrl: 'cartilla.pdf',
        certificadosUrl: ['seguro.pdf'],
      });

      await componente.submit();

      expect(payload().cartillaSanitariaUrl).toBe('cartilla.pdf');
      expect(payload().certificadosUrl).toEqual(['seguro.pdf']);
    });

    it('debería cargar ciudad y documentos ya guardados al editar', async () => {
      await crear('p1', perro({
        ciudad: 'Barcelona', cartillaSanitariaUrl: 'cartilla.pdf', fotos: ['maya.jpg'],
      }));

      expect(componente.form.getRawValue()).toMatchObject({
        ciudad: 'Barcelona', cartillaSanitariaUrl: 'cartilla.pdf', fotos: ['maya.jpg'],
      });
    });
  });

  describe('resumen final de disponibilidad (HU-8.2.8)', () => {
    it('debería marcar veterinarios como listo solo con vacunas registradas', async () => {
      await crear();
      componente.alternarVacuna(Vacuna.ANTIRRABICA);

      const resumen = componente.disponibilidadPorVertical();

      expect(resumen.find((d) => d.label === 'Veterinarios')?.lista).toBe(true);
      expect(resumen.find((d) => d.label === 'Hoteles y residencias')?.lista).toBe(false);
    });

    it('adiestramiento debería estar siempre disponible', async () => {
      await crear();

      const resumen = componente.disponibilidadPorVertical();

      expect(resumen.find((d) => d.label === 'Adiestramiento')?.lista).toBe(true);
    });
  });
});
