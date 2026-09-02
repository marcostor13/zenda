import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import {
  FranjaHoraria, LugarRecogida, ModoPrecioRecogida, ServicioClinicoTipo, SERVICIO_CLINICO_LABELS,
  TipoSeguro, TipoServicioFunerario, VerticalKey,
} from 'shared';
import { ComercioListadoFormComponent } from './comercio-listado-form.component';
import { ComercioApiService, ServicioPayload } from './comercio-api.service';
import { GeoService } from '../../core/geo/geo.service';

interface ApiDoble {
  obtenerServicioGestion: jest.Mock;
  crearServicio: jest.Mock;
  actualizarServicio: jest.Mock;
}

/** Dirección que devuelve la geocodificación inversa al mover el pin. */
const DIRECCION_DEL_PUNTO = {
  calle: 'Paseo del Prado', numero: '1', codigoPostal: '28014',
  ciudad: 'Madrid', provincia: 'Madrid', pais: 'España',
  formateada: 'Paseo del Prado, 1', lat: 40.4165, lng: -3.6935,
};

describe('ComercioListadoFormComponent', () => {
  let fixture: ComponentFixture<ComercioListadoFormComponent>;
  let componente: ComercioListadoFormComponent;
  let api: ApiDoble;
  let geo: { direccionDePunto: jest.Mock };
  let router: Router;

  const crear = async (id: string | null = null, servicio?: Record<string, unknown>): Promise<void> => {
    // El alta guarda borrador en el dispositivo: sin limpiar, una prueba
    // empezaría con los campos que dejó escritos la anterior.
    localStorage.clear();
    geo = { direccionDePunto: jest.fn().mockResolvedValue(DIRECCION_DEL_PUNTO) };
    api = {
      obtenerServicioGestion: jest.fn().mockReturnValue(of(servicio ?? {})),
      crearServicio: jest.fn().mockReturnValue(of({ _id: 'nuevo' })),
      actualizarServicio: jest.fn().mockReturnValue(of({ _id: id })),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioListadoFormComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
        { provide: GeoService, useValue: geo },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ComercioListadoFormComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** Último payload enviado al API, sea alta o edición. */
  const ultimoPayload = (): ServicioPayload =>
    (api.crearServicio.mock.calls.at(-1)?.[0] ?? api.actualizarServicio.mock.calls.at(-1)?.[1]) as ServicioPayload;

  /** Monta el formulario tal como lo empotra el alta guiada. */
  const crearEnAlta = async (vertical: VerticalKey): Promise<void> => {
    await crear();
    fixture.componentRef.setInput('modoAlta', true);
    fixture.componentRef.setInput('verticalInicial', vertical);
    await componente.ngOnInit();
    fixture.detectChanges();
  };

  /** Rellena los campos comunes obligatorios para poder llegar al guardado. */
  const rellenarBase = (vertical: VerticalKey): void => {
    componente.form.patchValue({
      vertical,
      titulo: 'Residencia Royal',
      descripcion: 'Alojamiento canino con jardín y cámaras.',
      ciudad: 'Madrid',
      precioBase: 45,
    });
  };

  const FOTOS = ['/f1.jpg', '/f2.jpg', '/f3.jpg', '/f4.jpg', '/f5.jpg'];

  /**
   * Deja puesto lo que ahora hace falta para publicar —una unidad reservable y
   * las cinco fotos mínimas— para que cada prueba siga midiendo sólo lo suyo.
   * En residencias y hoteles las fotos van dentro de la unidad; en el resto, en
   * la galería del servicio.
   */
  const dejarListoParaPublicar = (): void => {
    if (!componente.fotosPorUnidad()) {
      componente.form.patchValue({ imagenes: FOTOS });
      return;
    }

    const esHotel = componente.form.controls.vertical.value === VerticalKey.HOTELES;
    const unidades = esHotel ? componente.habitacionesHotel : componente.espacios;
    if (!unidades.length) {
      if (esHotel) componente.agregarHabitacionHotel();
      else componente.agregarEspacio();
    }
    unidades.at(0).patchValue({ imagenes: FOTOS });
  };

  const payloadGuardado = (): ServicioPayload =>
    (api.crearServicio.mock.calls[0]?.[0] ?? api.actualizarServicio.mock.calls[0]?.[1]) as ServicioPayload;

  afterEach(() => jest.clearAllMocks());

  describe('alta frente a edición', () => {
    it('debería empezar en blanco cuando no hay id en la ruta', async () => {
      await crear();

      expect(componente.esEdicion()).toBe(false);
      expect(api.obtenerServicioGestion).not.toHaveBeenCalled();
    });

    it('debería cargar el listado y bloquear el cambio de categoría al editar', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Villa Perruna',
        descripcion: 'Casa con jardín', ciudad: 'Madrid', precioBase: 40, imagenes: ['/a.jpg'],
      });

      expect(componente.esEdicion()).toBe(true);
      expect(componente.form.getRawValue().titulo).toBe('Villa Perruna');
      // Cambiar de vertical rompería el discriminador del documento ya publicado.
      expect(componente.form.controls.vertical.disabled).toBe(true);
    });

    it('debería avisar si el listado no se puede cargar', async () => {
      api = {
        obtenerServicioGestion: jest.fn().mockReturnValue(throwError(() => new Error('404'))),
        crearServicio: jest.fn(),
        actualizarServicio: jest.fn(),
      };
      await TestBed.configureTestingModule({
        imports: [ComercioListadoFormComponent, RouterTestingModule],
        providers: [
          provideHttpClient(), provideHttpClientTesting(),
          { provide: ComercioApiService, useValue: api },
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 's1' }) } } },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ComercioListadoFormComponent);
      componente = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(componente.errorMsg()).toContain('No se pudo cargar');
      expect(componente.cargando()).toBe(false);
    });

    it('no debería reenviar el vertical al editar', async () => {
      await crear('s1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'DogVan', descripcion: 'Traslados con jaula',
        ciudad: 'Madrid', precioBase: 30, extra: {},
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(api.actualizarServicio).toHaveBeenCalled();
      expect(payloadGuardado()).not.toHaveProperty('vertical');
    });
  });

  describe('geolocalización del listado (búsqueda por mapa)', () => {
    it('debería enviar las coordenadas de la población elegida', async () => {
      await crear('s1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'DogVan', descripcion: 'Traslados con jaula',
        ciudad: 'Madrid', precioBase: 30, extra: {},
      });

      componente.guardarCoordenadas({ placeId: 'p1', ciudad: 'Madrid', lat: 40.4168, lng: -3.7038 });
      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado()).toMatchObject({ lat: 40.4168, lng: -3.7038 });
      expect(componente.tieneCoordenadas()).toBe(true);
    });

    it('no debería enviar coordenadas de una población sin resolver', async () => {
      await crear('s1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'DogVan', descripcion: 'Traslados con jaula',
        ciudad: 'Cuenca', precioBase: 30, extra: {},
      });

      // El catálogo local sugiere poblaciones sin coordenadas reales; guardar un
      // punto inventado colocaría el anuncio en el sitio equivocado del mapa.
      componente.guardarCoordenadas({ placeId: '', ciudad: 'Cuenca', lat: NaN, lng: NaN });
      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado()).not.toHaveProperty('lat');
      expect(componente.tieneCoordenadas()).toBe(false);
    });

    it('debería reconocer un listado que ya venía geolocalizado', async () => {
      await crear('s1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'DogVan', descripcion: 'Traslados con jaula',
        ciudad: 'Madrid', precioBase: 30, extra: {}, lat: 40.4168, lng: -3.7038,
      });

      // Sin esto la pista pediría reelegir la población en cada edición.
      expect(componente.tieneCoordenadas()).toBe(true);
    });
  });

  describe('validación previa al guardado', () => {
    it('debería marcar los campos y no llamar al API con el formulario vacío', async () => {
      await crear();

      await componente.submit();

      expect(api.crearServicio).not.toHaveBeenCalled();
      expect(componente.form.touched).toBe(true);
    });

    it('debería exigir al menos un espacio en alojamiento', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);

      await componente.submit();

      // Un alojamiento sin espacios no tiene nada que reservar.
      expect(componente.errorMsg()).toContain('al menos un tipo de espacio');
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería exigir al menos un servicio clínico en veterinaria', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);

      await componente.submit();

      expect(componente.errorMsg()).toContain('al menos un servicio veterinario');
    });

    it('debería exigir al menos un servicio de grooming en peluquería', async () => {
      await crear();
      rellenarBase(VerticalKey.PELUQUERIA);

      await componente.submit();

      expect(componente.errorMsg()).toContain('grooming');
    });

    it('debería exigir al menos una cobertura en seguros', async () => {
      await crear();
      rellenarBase(VerticalKey.SEGUROS);

      await componente.submit();

      expect(componente.errorMsg()).toContain('cobertura');
    });

    it('debería exigir cinco fotos antes de guardar', async () => {
      // En un marketplace de reservas la foto es el producto: una ficha con dos
      // no deja ver el sitio y no la reserva nadie.
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.agregarServicioClinico();
      componente.serviciosClinicos.at(0).patchValue({
        tipo: ServicioClinicoTipo.VACUNACION, precio: 30,
      });
      componente.form.patchValue({ imagenes: ['/f1.jpg', '/f2.jpg'] });

      await componente.submit();

      expect(componente.errorMsg()).toContain('al menos 5 fotos');
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería contar las fotos de los espacios en alojamiento', async () => {
      // La residencia no tiene galería aparte: sus fotos son las de las suites.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.agregarEspacio();
      componente.espacios.at(0).patchValue({ imagenes: ['/a.jpg', '/b.jpg', '/c.jpg'] });
      componente.espacios.at(1).patchValue({ imagenes: ['/d.jpg', '/e.jpg'] });

      await componente.submit();

      expect(componente.totalFotos()).toBe(5);
      expect(payloadGuardado().imagenes).toEqual(['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg']);
    });

    it('no debería contar dos veces la misma foto en dos espacios', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.agregarEspacio();
      componente.espacios.at(0).patchValue({ imagenes: ['/a.jpg', '/b.jpg', '/c.jpg'] });
      componente.espacios.at(1).patchValue({ imagenes: ['/a.jpg', '/b.jpg', '/c.jpg'] });

      await componente.submit();

      expect(componente.totalFotos()).toBe(3);
      expect(componente.errorMsg()).toContain('al menos 5 fotos');
    });

    it('debería exigir un tipo de habitación en hoteles', async () => {
      await crear();
      rellenarBase(VerticalKey.HOTELES);

      await componente.submit();

      expect(componente.errorMsg()).toContain('tipo de habitación');
    });

    it('debería marcar en rojo solo los campos ya tocados', async () => {
      await crear();

      expect(componente.hasError('titulo')).toBe(false);
      componente.form.controls.titulo.markAsTouched();
      expect(componente.hasError('titulo')).toBe(true);
    });
  });

  describe('fotos por unidad reservable', () => {
    /**
     * Una residencia no vende «el sitio»: vende una suite concreta, y el cliente
     * elige mirando esa foto. Con una galería común no se sabe cuál de las diez
     * es la suite que se está reservando.
     */
    it('debería fotografiar por unidad en alojamiento y en hoteles', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      expect(componente.fotosPorUnidad()).toBe(true);

      componente.form.patchValue({ vertical: VerticalKey.HOTELES });
      expect(componente.fotosPorUnidad()).toBe(true);
    });

    it('debería fotografiar el servicio entero en el resto de categorías', async () => {
      await crear();
      rellenarBase(VerticalKey.PELUQUERIA);

      expect(componente.fotosPorUnidad()).toBe(false);
    });

    it('debería contar la galería suelta en las categorías sin unidad', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.form.patchValue({ imagenes: ['/a.jpg', '/b.jpg'] });

      expect(componente.totalFotos()).toBe(2);
      expect(componente.fotosSuficientes()).toBe(false);
    });

    it('debería decir cuántas fotos faltan', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.form.patchValue({ imagenes: ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg'] });

      expect(componente.mensajeFotos()).toContain('falta 1');
    });

    /**
     * Las fichas publicadas antes de esto tienen la galería en el servicio y las
     * unidades vacías: sin heredarla, guardar sin tocar nada las dejaría sin
     * ninguna foto.
     */
    it('debería pasar la galería antigua a la primera suite al editar', async () => {
      await crear('serv-1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'X', descripcion: 'Y',
        imagenes: ['/vieja-1.jpg', '/vieja-2.jpg'],
        extra: { espacios: [{ tipo: 'suite', precioNoche: 60 }] },
      });

      expect(componente.espacios.at(0).getRawValue().imagenes)
        .toEqual(['/vieja-1.jpg', '/vieja-2.jpg']);
    });

    it('no debería pisar las fotos que la unidad ya trae', async () => {
      await crear('serv-1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'X', descripcion: 'Y',
        imagenes: ['/vieja.jpg'],
        extra: { espacios: [{ tipo: 'suite', precioNoche: 60, imagenes: ['/suya.jpg'] }] },
      });

      expect(componente.espacios.at(0).getRawValue().imagenes).toEqual(['/suya.jpg']);
    });
  });

  describe('habitaciones del hotel', () => {
    it('debería añadir y quitar tipos de habitación', async () => {
      await crear();
      rellenarBase(VerticalKey.HOTELES);

      componente.agregarHabitacionHotel();
      componente.agregarHabitacionHotel();
      expect(componente.habitacionesHotel.length).toBe(2);

      componente.quitarHabitacionHotel(0);
      expect(componente.habitacionesHotel.length).toBe(1);
    });

    it('debería guardar las habitaciones con sus fotos', async () => {
      await crear();
      rellenarBase(VerticalKey.HOTELES);
      componente.agregarHabitacionHotel();
      componente.habitacionesHotel.at(0).patchValue({
        tipo: 'Doble pet-friendly', precioNoche: 90, cantidad: 4, imagenes: FOTOS,
      });

      await componente.submit();

      const habitaciones = payloadGuardado().extra?.['espacios'] as Record<string, unknown>[];
      expect(habitaciones[0]).toMatchObject({ tipo: 'Doble pet-friendly', precioNoche: 90, cantidad: 4 });
      expect(habitaciones[0]['imagenes']).toEqual(FOTOS);
    });

    /**
     * Las plazas del hotel salen de la suma de sus habitaciones
     * (`CONTADOR_DISPONIBILIDAD` en el API): mandarlas a mano las duplicaría.
     */
    it('no debería mandar el contador de habitaciones a mano', async () => {
      await crear();
      rellenarBase(VerticalKey.HOTELES);
      dejarListoParaPublicar();

      await componente.submit();

      expect(payloadGuardado().extra?.['unidadesDisponibles']).toBeUndefined();
    });

    it('debería convertir el contador antiguo en un tipo de habitación al editar', async () => {
      // Un hotel de antes sólo declaraba cuántas habitaciones admitían mascota.
      await crear('serv-1', {
        vertical: VerticalKey.HOTELES, titulo: 'X', descripcion: 'Y', precioBase: 90,
        imagenes: ['/hab.jpg'],
        extra: { unidadesDisponibles: 6 },
      });

      const habitacion = componente.habitacionesHotel.at(0).getRawValue();
      expect(habitacion.cantidad).toBe(6);
      expect(habitacion.precioNoche).toBe(90);
      expect(habitacion.imagenes).toEqual(['/hab.jpg']);
    });
  });

  describe('espacios de alojamiento', () => {
    it('debería añadir y quitar espacios', async () => {
      await crear();

      componente.agregarEspacio();
      componente.agregarEspacio();
      expect(componente.espacios.length).toBe(2);

      componente.quitarEspacio(0);
      expect(componente.espacios.length).toBe(1);
    });

    it('debería guardar los espacios con sus amenities como lista', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.espacios.at(0).patchValue({
        tipo: 'suite', precioNoche: 60, cantidad: 2, amenities: ['cama', 'manta', 'música'],
      });

      dejarListoParaPublicar();
      await componente.submit();

      const espacios = payloadGuardado().extra?.['espacios'] as Record<string, unknown>[];
      expect(espacios[0]).toMatchObject({ tipo: 'suite', precioNoche: 60 });
      expect(espacios[0]['amenities']).toEqual(['cama', 'manta', 'música']);
    });

    it('debería omitir el tamaño máximo cuando el comercio no lo limita', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

      dejarListoParaPublicar();
      await componente.submit();

      const espacios = payloadGuardado().extra?.['espacios'] as Record<string, unknown>[];
      expect(espacios[0]['tamanoMaxPerro']).toBeUndefined();
    });

    it('debería precargar los espacios existentes al editar', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Villa', descripcion: 'Casa con jardín',
        ciudad: 'Madrid', precioBase: 40,
        extra: {
          espacios: [{ tipo: 'suite', precioNoche: 60, amenities: ['cama'] }],
          amenities: ['jardín', 'piscina'],
          compatibilidadSocialAdmitida: ['solo_hembras'],
        },
      });

      expect(componente.espacios.length).toBe(1);
      expect(componente.espacios.at(0).value.amenities).toEqual(['cama']);
      expect(componente.alojamientoGroup.value.amenities).toEqual(['jardín', 'piscina']);
      expect(componente.tieneCompatibilidad('solo_hembras')).toBe(true);
    });
  });

  describe('recorrido paso a paso', () => {
    beforeAll(() => {
      // jsdom no implementa el scroll suave que dispara cada cambio de paso.
      window.scrollTo = jest.fn();
    });

    it('debería empezar en el primer paso', async () => {
      await crear();

      expect(componente.paso()).toBe('categoria');
      expect(componente.esPrimerPaso()).toBe(true);
      expect(componente.esUltimoPaso()).toBe(false);
    });

    it('NO debería avanzar sin lo obligatorio del paso, y debería señalarlo', async () => {
      // Sin esto el fallo aparecía al pulsar "Crear", tres pantallas más abajo.
      await crear();

      componente.siguientePaso();

      expect(componente.paso()).toBe('categoria');
      expect(componente.hasError('titulo')).toBe(true);
    });

    it('debería avanzar cuando el paso está completo', async () => {
      await crear();
      componente.form.patchValue({
        vertical: VerticalKey.ALOJAMIENTO,
        titulo: 'Residencia Royal',
        descripcion: 'Alojamiento canino con jardín y cámaras.',
      });

      componente.siguientePaso();

      expect(componente.paso()).toBe('ubicacion');
    });

    it('debería poder retroceder', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.siguientePaso();

      componente.pasoAnterior();

      expect(componente.paso()).toBe('categoria');
    });

    it('no debería dejar saltar a un paso que aún no se ha alcanzado', async () => {
      await crear();

      componente.irAlPaso('fotos');

      expect(componente.paso()).toBe('categoria');
    });

    it('debería dejar volver a un paso ya cerrado', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.siguientePaso();
      componente.siguientePaso();

      componente.irAlPaso('categoria');

      expect(componente.paso()).toBe('categoria');
    });

    it('debería dejar ir a cualquier paso al editar, que ya está todo puesto', async () => {
      await crear('serv-1', { vertical: VerticalKey.ALOJAMIENTO, titulo: 'X', descripcion: 'Y' });

      componente.irAlPaso('aptitud');

      expect(componente.paso()).toBe('aptitud');
    });

    it('debería frenar en detalles si la categoría no cumple su regla propia', async () => {
      // Un alojamiento sin ningún espacio no se puede reservar.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.irAlPaso('categoria');
      // categoría → ubicación → horarios → detalles.
      componente.siguientePaso();
      componente.siguientePaso();
      componente.siguientePaso();
      expect(componente.paso()).toBe('detalles');

      componente.siguientePaso();

      expect(componente.paso()).toBe('detalles');
      expect(componente.errorMsg()).toBeTruthy();
    });

    it('Enter a mitad del recorrido debería avanzar, nunca crear el servicio', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);

      await componente.enviarFormulario();

      expect(componente.paso()).toBe('ubicacion');
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería nombrar el paso de detalles con la categoría elegida', async () => {
      await crear();
      componente.form.patchValue({ vertical: VerticalKey.PELUQUERIA });
      componente.paso.set('detalles');

      expect(componente.tituloPaso().toLowerCase()).toContain('peluquer');
    });
  });

  describe('política de cancelación', () => {
    const politicas = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.politica'));

    it('debería explicar cada opción, no sólo nombrarla', async () => {
      // Elegir entre "flexible", "moderada" y "estricta" sin saber qué implica
      // cada una lleva a marcar la primera.
      await crear();
      componente.form.patchValue({ vertical: VerticalKey.ALOJAMIENTO });
      // Los datos propios de la categoría viven en el paso de detalles.
      componente.paso.set('detalles');
      fixture.detectChanges();

      const descripciones = politicas().map((p) => p.querySelector('.politica__desc')?.textContent?.trim());

      expect(descripciones.length).toBe(componente.politicasCancelacion.length + 1);
      expect(descripciones.every((d) => !!d && d.length > 20)).toBe(true);
    });

    it('debería marcar "sin especificar" mientras no se elige nada', async () => {
      await crear();

      expect(componente.politicaElegida()).toBe('');
    });

    it('debería reflejar la opción elegida', async () => {
      await crear();

      componente.alojamientoGroup.patchValue({ politicaCancelacion: 'moderada' });

      expect(componente.politicaElegida()).toBe('moderada');
    });

    it('debería enviar la política elegida', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.alojamientoGroup.patchValue({ politicaCancelacion: 'estricta' });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().extra?.['politicaCancelacion']).toBe('estricta');
    });
  });

  describe('aptitud del servicio', () => {
    it('debería alternar los tamaños admitidos', async () => {
      await crear();

      componente.toggleTamano('grande');
      expect(componente.tieneTamano('grande')).toBe(true);

      componente.toggleTamano('grande');
      expect(componente.tieneTamano('grande')).toBe(false);
    });

    it('debería ofrecer sólo pequeño, mediano y grande', async () => {
      // Cinco tramos se dejaban a medias; con tres se marca de un vistazo.
      await crear();

      expect(componente.tamanosAdmitidos.map((t) => t.valor)).toEqual([
        'pequeno', 'mediano', 'grande',
      ]);
    });

    it('debería enviar la aptitud declarada junto al listado', async () => {
      await crear();
      rellenarBase(VerticalKey.TRANSPORTE);
      componente.toggleTamano('mediano');
      componente.temperamentosNoAdmitidos = ['Agresivo con perros', 'Muy nervioso'];

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().aptitud).toEqual({
        tamanosAdmitidos: ['mediano'],
        tipoPeloAdmitido: [],
        temperamentosNoAdmitidos: ['Agresivo con perros', 'Muy nervioso'],
      });
    });

    it('debería conservar el tipo de pelo guardado aunque ya no se edite', async () => {
      // El campo salió del formulario; editar la ficha no debe borrar de la BD
      // lo que el comercio dejara puesto antes.
      await crear('s1', {
        _id: 's1',
        vertical: VerticalKey.TRANSPORTE,
        titulo: 'Traslado veterinario',
        descripcion: 'Traslados con vehículo climatizado.',
        ciudad: 'Valencia',
        precioBase: 30,
        aptitud: { tipoPeloAdmitido: ['rizado', 'largo'], tamanosAdmitidos: ['mediano'] },
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().aptitud).toMatchObject({
        tipoPeloAdmitido: ['rizado', 'largo'],
      });
    });
  });

  describe('veterinaria', () => {
    it('debería rellenar el nombre desde el catálogo cerrado', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.agregarServicioClinico();
      componente.serviciosClinicos.at(0).patchValue({
        tipo: ServicioClinicoTipo.VACUNACION, precio: 35,
      });

      dejarListoParaPublicar();
      await componente.submit();

      const servicios = payloadGuardado().extra?.['serviciosClinicos'] as Record<string, unknown>[];
      // El comercio ya no escribe el nombre: se deriva del tipo elegido.
      expect(servicios[0]['nombre']).toBe(SERVICIO_CLINICO_LABELS[ServicioClinicoTipo.VACUNACION]);
    });

    it('debería reconocer servicios antiguos escritos a mano', async () => {
      await crear('s1', {
        vertical: VerticalKey.VETERINARIA, titulo: 'Clínica', descripcion: 'Consulta general',
        ciudad: 'Madrid', precioBase: 40,
        extra: {
          serviciosClinicos: [{ nombre: SERVICIO_CLINICO_LABELS[ServicioClinicoTipo.VACUNACION], precio: 35 }],
        },
      });

      // Sin este reconocimiento, editar un listado antiguo vaciaría su catálogo.
      expect(componente.serviciosClinicos.at(0).value.tipo).toBe(ServicioClinicoTipo.VACUNACION);
    });

    it('debería guardar especialidades y especies como listas de etiquetas', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.alternarServicioClinico(ServicioClinicoTipo.CONSULTA_GENERAL);
      componente.serviciosClinicos.at(0).patchValue({ precio: 35 });
      componente.veterinariaGroup.patchValue({
        especialidades: ['Traumatología', 'Dermatología'], especiesAtendidas: ['Perro', 'Gato'],
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().extra?.['especialidades']).toEqual(['Traumatología', 'Dermatología']);
      expect(payloadGuardado().extra?.['especiesAtendidas']).toEqual(['Perro', 'Gato']);
    });

    /**
     * `veterinarios.md`: la pantalla deja de pedir «especialidades» y pide actos
     * concretos, porque una especialidad describe a quién ves, no lo que cuesta.
     */
    it('debería ofrecer el catálogo de servicios con su forma de cobrar', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);

      const catalogo = componente.catalogoClinico();
      const vacunacion = catalogo.find((c) => c.tipo === ServicioClinicoTipo.VACUNACION);
      expect(vacunacion?.label).toBe('Vacunación');
      expect(vacunacion?.base).toBe('Por tipo de vacuna');
      expect(catalogo.some((c) => c.tipo === ServicioClinicoTipo.CHEQUEO_PREVENTIVO)).toBe(true);
    });

    it('debería marcar y desmarcar un servicio desde su tarjeta', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);

      componente.alternarServicioClinico(ServicioClinicoTipo.MICROCHIP);
      expect(componente.tieneServicioClinico(ServicioClinicoTipo.MICROCHIP)).toBe(true);
      expect(componente.serviciosClinicos.length).toBe(1);

      componente.alternarServicioClinico(ServicioClinicoTipo.MICROCHIP);
      expect(componente.tieneServicioClinico(ServicioClinicoTipo.MICROCHIP)).toBe(false);
      expect(componente.serviciosClinicos.length).toBe(0);
    });

    /**
     * El cliente no reserva «vacunación»: reserva «vacuna de la rabia — 32 €»,
     * y eso sí lo puede pagar por adelantado.
     */
    it('debería proponer las vacunas habituales al marcar vacunación', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);

      componente.alternarServicioClinico(ServicioClinicoTipo.VACUNACION);

      expect(componente.cobraPorVariantes(0)).toBe(true);
      const nombres = componente.variantesDe(0).controls.map((c) => c.getRawValue().nombre);
      expect(nombres).toEqual(['Rabia', 'Polivalente', 'Tos de las perreras', 'Leishmania']);
    });

    it('debería proponer los tramos de peso en una castración', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);

      componente.alternarServicioClinico(ServicioClinicoTipo.CASTRACION);

      expect(componente.cobraPorVariantes(0)).toBe(true);
      expect(componente.detallaAlcance(0)).toBe(true);
      const tramos = componente.variantesDe(0).controls.map((c) => c.getRawValue().nombre);
      expect(tramos).toEqual(['Hasta 10 kg', '10–20 kg', '20–30 kg', 'Más de 30 kg']);
    });

    it('debería guardar cada vacuna con su precio y tomar la más barata como «desde»', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.alternarServicioClinico(ServicioClinicoTipo.VACUNACION);
      componente.variantesDe(0).at(0).patchValue({ precio: 32 });
      componente.variantesDe(0).at(1).patchValue({ precio: 45 });

      dejarListoParaPublicar();
      await componente.submit();

      const servicios = payloadGuardado().extra?.['serviciosClinicos'] as Record<string, unknown>[];
      // Las vacunas que la clínica no puso a precio no salen: publicarlas a 0 €
      // pondría en el buscador algo que no ofrece.
      expect(servicios[0]['variantes']).toEqual([
        { nombre: 'Rabia', precio: 32 },
        { nombre: 'Polivalente', precio: 45 },
      ]);
      expect(servicios[0]['precio']).toBe(32);
    });

    it('debería guardar qué incluye y qué no una cirugía, con sus extras', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.alternarServicioClinico(ServicioClinicoTipo.CASTRACION);
      componente.variantesDe(0).at(0).patchValue({ precio: 120 });
      componente.serviciosClinicos.at(0).patchValue({
        incluye: 'anestesia, intervención y revisión',
        noIncluye: 'analítica preoperatoria',
      });
      componente.agregarComplemento(0);
      componente.complementosDe(0).at(0).patchValue({ nombre: 'Analítica preoperatoria', precio: 45 });

      dejarListoParaPublicar();
      await componente.submit();

      const servicios = payloadGuardado().extra?.['serviciosClinicos'] as Record<string, unknown>[];
      expect(servicios[0]['incluye']).toBe('anestesia, intervención y revisión');
      expect(servicios[0]['noIncluye']).toBe('analítica preoperatoria');
      expect(servicios[0]['complementos']).toEqual([{ nombre: 'Analítica preoperatoria', precio: 45 }]);
    });

    it('debería dejar añadir un servicio que el catálogo no contempla', async () => {
      // Una clínica puede tener un procedimiento perfectamente tarifado que no
      // esté en la lista; lo que se compra es el acto, no la especialidad.
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.agregarServicioLibre();
      componente.serviciosClinicos.at(0).patchValue({
        nombre: 'Primera consulta de cardiología', precio: 70,
      });

      dejarListoParaPublicar();
      await componente.submit();

      const servicios = payloadGuardado().extra?.['serviciosClinicos'] as Record<string, unknown>[];
      expect(servicios[0]).toMatchObject({
        tipo: ServicioClinicoTipo.OTRO, nombre: 'Primera consulta de cardiología', precio: 70,
      });
    });

    it('debería exigir precio a cada servicio marcado', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.alternarServicioClinico(ServicioClinicoTipo.MICROCHIP);

      await componente.submit();

      expect(componente.errorMsg()).toContain('Ponle precio');
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería exigir al menos un tipo con precio cuando se cobra por variantes', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.alternarServicioClinico(ServicioClinicoTipo.VACUNACION);

      await componente.submit();

      expect(componente.errorMsg()).toContain('al menos un tipo con su precio');
    });

    it('debería exigir nombre al servicio añadido a mano', async () => {
      await crear();
      rellenarBase(VerticalKey.VETERINARIA);
      componente.agregarServicioLibre();

      await componente.submit();

      expect(componente.errorMsg()).toContain('nombre');
    });

    /**
     * Un listado de antes del catálogo puede traer un servicio que ya no se
     * ofrece; si desapareciera de la rejilla, el comercio lo perdería al
     * guardar sin haberlo tocado.
     */
    it('debería seguir enseñando un servicio heredado que ya no está en el catálogo', async () => {
      await crear('serv-1', {
        vertical: VerticalKey.VETERINARIA, titulo: 'X', descripcion: 'Y',
        extra: { serviciosClinicos: [{ tipo: ServicioClinicoTipo.TELECONSULTA, precio: 25 }] },
      });

      const catalogo = componente.catalogoClinico();
      expect(catalogo.some((c) => c.tipo === ServicioClinicoTipo.TELECONSULTA)).toBe(true);
      expect(componente.tieneServicioClinico(ServicioClinicoTipo.TELECONSULTA)).toBe(true);
    });

    it('debería empezar atendiendo perros, que es el caso habitual', async () => {
      await crear();

      expect(componente.veterinariaGroup.value.especiesAtendidas).toEqual(['Perro']);
    });
  });

  describe('peluquería', () => {
    it('debería alternar los tipos de pelo compatibles de cada servicio', async () => {
      await crear();
      componente.agregarServicioGrooming();

      componente.togglePeloCompatible(0, 'largo');
      componente.togglePeloCompatible(0, 'rizado');
      expect(componente.tienePeloCompatible(0, 'largo')).toBe(true);

      componente.togglePeloCompatible(0, 'largo');
      expect(componente.pelosCompatibles(0)).toEqual(['rizado']);
    });

    it('debería gestionar los precios por tamaño de cada servicio', async () => {
      await crear();
      componente.agregarServicioGrooming();

      componente.agregarPrecioPorTamano(0);
      componente.agregarPrecioPorTamano(0);
      expect(componente.preciosPorTamano(0).length).toBe(2);

      componente.quitarPrecioPorTamano(0, 1);
      expect(componente.preciosPorTamano(0).length).toBe(1);
    });

    it('debería guardar el grooming con sus pelos compatibles como lista', async () => {
      await crear();
      rellenarBase(VerticalKey.PELUQUERIA);
      componente.agregarServicioGrooming();
      componente.serviciosGrooming.at(0).patchValue({ nombre: 'Deslanado', precio: 40 });
      componente.togglePeloCompatible(0, 'largo');

      dejarListoParaPublicar();
      await componente.submit();

      const servicios = payloadGuardado().extra?.['serviciosGrooming'] as Record<string, unknown>[];
      expect(servicios[0]['tipoPeloCompatible']).toEqual(['largo']);
    });

    it('debería añadir y quitar servicios adicionales', async () => {
      await crear();

      componente.agregarServicioAdicionalPeluqueria();
      expect(componente.serviciosAdicionalesPeluqueria.length).toBe(1);
      componente.quitarServicioAdicionalPeluqueria(0);
      expect(componente.serviciosAdicionalesPeluqueria.length).toBe(0);

      componente.agregarServicioAdicionalAlojamiento();
      expect(componente.serviciosAdicionalesAlojamiento.length).toBe(1);
      componente.quitarServicioAdicionalAlojamiento(0);
      expect(componente.serviciosAdicionalesAlojamiento.length).toBe(0);
    });
  });

  describe('adiestramiento', () => {
    /* El centro ya no declara la modalidad a mano: se deduce del catálogo. */
    it('debería reservar por sesión cuando el catálogo no tiene ningún curso', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.agregarServicioAdiestramiento();
      componente.serviciosAdiestramiento.at(0).patchValue({
        nombre: 'Obediencia básica', tipo: 'individual', precio: 40,
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().extra?.['modalidad']).toBe('sesion');
      expect(payloadGuardado().extra?.['precioSesion']).toBe(40);
    });

    it('debería reservar por programa en cuanto el catálogo ofrece un curso', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.agregarServicioAdiestramiento();
      componente.serviciosAdiestramiento.at(0).patchValue({
        nombre: 'Curso de cachorros', tipo: 'curso', precio: 300,
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().extra?.['modalidad']).toBe('programa');
    });

    it('debería tomar como precio de sesión el más barato del catálogo', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.agregarServicioAdiestramiento();
      componente.agregarServicioAdiestramiento();
      componente.serviciosAdiestramiento.at(0).patchValue({ nombre: 'Intensivo', precio: 90 });
      componente.serviciosAdiestramiento.at(1).patchValue({ nombre: 'Paseo educativo', precio: 35 });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().extra?.['precioSesion']).toBe(35);
    });

    it('debería omitir las valoraciones iniciales que son gratuitas', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);

      dejarListoParaPublicar();
      await componente.submit();

      // Un cero no es un precio: es "no la cobro". Guardarlo llenaría la ficha
      // pública de líneas a 0 €.
      expect(payloadGuardado().extra?.['valoracionesIniciales']).toEqual([]);
    });

    it('debería guardar solo las valoraciones iniciales que tienen precio', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.adiestramientoGroup.patchValue({
        valoracionOnlinePrecio: 25, valoracionDomicilioPrecio: 40,
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(payloadGuardado().extra?.['valoracionesIniciales']).toEqual([
        { modalidad: 'online', precio: 25 },
        { modalidad: 'domicilio', precio: 40 },
      ]);
    });

    it('debería añadir y quitar servicios del catálogo', async () => {
      await crear();

      componente.agregarServicioAdiestramiento();
      expect(componente.serviciosAdiestramiento.length).toBe(1);
      componente.quitarServicioAdiestramiento(0);
      expect(componente.serviciosAdiestramiento.length).toBe(0);
    });
  });

  describe('hoteles', () => {
    it('debería omitir los límites puestos a cero', async () => {
      await crear();
      rellenarBase(VerticalKey.HOTELES);

      dejarListoParaPublicar();
      await componente.submit();

      // Un cero significa "sin límite": enviarlo prohibiría toda mascota.
      const extra = payloadGuardado().extra!;
      expect(extra['maxMascotasPorReserva']).toBeUndefined();
      expect(extra['pesoMaximoMascotaKg']).toBeUndefined();
      expect(extra['fianza']).toBeUndefined();
    });

    it('debería conservar los límites declarados', async () => {
      await crear();
      rellenarBase(VerticalKey.HOTELES);
      componente.hotelesGroup.patchValue({
        maxMascotasPorReserva: 2, pesoMaximoMascotaKg: 25, fianza: 100,
        especiesPermitidas: ['Perro', 'Gato'],
      });

      dejarListoParaPublicar();
      await componente.submit();

      const extra = payloadGuardado().extra!;
      expect(extra['maxMascotasPorReserva']).toBe(2);
      expect(extra['fianza']).toBe(100);
      expect(extra['especiesPermitidas']).toEqual(['Perro', 'Gato']);
    });

    it('debería gestionar los suplementos por tamaño', async () => {
      await crear();

      componente.agregarSuplementoPorTamanoMascota();
      expect(componente.suplementoPorTamanoMascota.length).toBe(1);
      componente.quitarSuplementoPorTamanoMascota(0);
      expect(componente.suplementoPorTamanoMascota.length).toBe(0);
    });
  });

  describe('seguros', () => {
    it('debería convertir los porcentajes del formulario a fracciones', async () => {
      await crear();
      rellenarBase(VerticalKey.SEGUROS);
      componente.alternarCobertura(TipoSeguro.RC_OBLIGATORIA);
      componente.segurosGroup.patchValue({ descuentoPagoAnualPct: 10, recargoRiesgoPct: 25 });

      dejarListoParaPublicar();
      await componente.submit();

      const extra = payloadGuardado().extra!;
      expect(extra['descuentoPagoAnualPct']).toBe(0.1);
      expect((extra['condicionesAdmision'] as Record<string, unknown>)['recargoRiesgoPct']).toBe(0.25);
    });

    it('debería tratar el cero de las condiciones como "sin límite"', async () => {
      await crear();
      rellenarBase(VerticalKey.SEGUROS);
      componente.alternarCobertura(TipoSeguro.RC_OBLIGATORIA);

      dejarListoParaPublicar();
      await componente.submit();

      const admision = payloadGuardado().extra!['condicionesAdmision'] as Record<string, unknown>;
      expect(admision['edadMinimaMeses']).toBeUndefined();
      expect(admision['pesoMaximoKg']).toBeUndefined();
      expect(admision['recargoRiesgoPct']).toBeUndefined();
    });

    it('debería alternar las coberturas marcadas', async () => {
      await crear();

      componente.alternarCobertura(TipoSeguro.RC_OBLIGATORIA);
      expect(componente.tieneCobertura(TipoSeguro.RC_OBLIGATORIA)).toBe(true);

      componente.alternarCobertura(TipoSeguro.RC_OBLIGATORIA);
      expect(componente.tieneCobertura(TipoSeguro.RC_OBLIGATORIA)).toBe(false);
    });

    it('debería devolver los porcentajes al formulario al editar', async () => {
      await crear('s1', {
        vertical: VerticalKey.SEGUROS, titulo: 'Póliza Royal', descripcion: 'Cobertura completa',
        ciudad: 'Madrid', precioBase: 200,
        extra: {
          descuentoPagoAnualPct: 0.1,
          tiposSeguro: [TipoSeguro.RC_OBLIGATORIA],
          condicionesAdmision: { recargoRiesgoPct: 0.25, pesoMaximoKg: 40 },
        },
      });

      expect(componente.segurosGroup.value.descuentoPagoAnualPct).toBe(10);
      expect(componente.segurosGroup.value.recargoRiesgoPct).toBe(25);
      expect(componente.segurosGroup.value.pesoMaximoKg).toBe(40);
      expect(componente.tieneCobertura(TipoSeguro.RC_OBLIGATORIA)).toBe(true);
    });
  });

  /**
   * Funerarios sustituyó a «cuidadores» en el catálogo (2026-09-01) y llegó sin
   * ninguna prueba de formulario, pese a ser el vertical con más reglas de alta:
   * catálogo obligatorio, tramos de peso ordenados, declaración de
   * autorizaciones y crematorio de un tercero.
   */
  describe('funerarios', () => {
    const conServicio = (nombre = 'Cremación individual', precioBase = 180): void => {
      componente.agregarServicioFunerario();
      componente.serviciosFunerarios.at(componente.serviciosFunerarios.length - 1)
        .patchValue({ nombre, precioBase });
    };

    /** Deja el alta en condiciones de publicar, salvo lo que pruebe cada test. */
    const listoParaPublicar = (): void => {
      rellenarBase(VerticalKey.FUNERARIOS);
      conServicio();
      componente.funerariosGroup.patchValue({ declaraAutorizaciones: true });
      dejarListoParaPublicar();
    };

    describe('validación previa a publicar', () => {
      it('debería exigir al menos un servicio en el catálogo', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        dejarListoParaPublicar();

        await componente.submit();

        expect(componente.errorMsg()).toContain('Añade al menos un servicio');
        expect(api.crearServicio).not.toHaveBeenCalled();
      });

      it('debería exigir nombre en cada servicio', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        conServicio('   ');
        componente.funerariosGroup.patchValue({ declaraAutorizaciones: true });
        dejarListoParaPublicar();

        await componente.submit();

        expect(componente.errorMsg()).toContain('necesitan un nombre');
      });

      it('debería exigir un precio, base o por tramo', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        conServicio('Cremación individual', 0);
        componente.funerariosGroup.patchValue({ declaraAutorizaciones: true });
        dejarListoParaPublicar();

        await componente.submit();

        expect(componente.errorMsg()).toContain('Pon precio a cada servicio');
      });

      it('debería dar por bueno un servicio sin precio base pero con tramos', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        conServicio('Cremación individual', 0);
        componente.agregarTramoPeso(0);
        componente.tramosPeso(0).at(0).patchValue({ hastaKg: 10, precio: 120 });
        componente.funerariosGroup.patchValue({ declaraAutorizaciones: true });
        dejarListoParaPublicar();

        await componente.submit();

        expect(componente.errorMsg()).toBe('');
        expect(api.crearServicio).toHaveBeenCalled();
      });

      /* §10 del brief: la declaración es la prueba del consentimiento. */
      it('no debería publicar sin declarar las autorizaciones', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        conServicio();
        dejarListoParaPublicar();

        await componente.submit();

        expect(componente.errorMsg()).toContain('autorizaciones necesarias');
      });

      it('debería exigir el nombre del crematorio cuando la cremación no es propia', async () => {
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({ cremacionPropia: false, terceroCrematorio: '  ' });

        await componente.submit();

        expect(componente.errorMsg()).toContain('con qué empresa trabajas');
      });

      it('debería publicar nombrando al tercero que crema', async () => {
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({
          cremacionPropia: false, terceroCrematorio: 'Crematorio Norte',
        });

        await componente.submit();

        expect(payloadGuardado().extra?.['terceroCrematorio']).toBe('Crematorio Norte');
      });

      it('no debería guardar un crematorio ajeno si crema ella misma', async () => {
        // Dejarlo publicaría en la ficha a una empresa que no interviene.
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({
          cremacionPropia: true, terceroCrematorio: 'Crematorio Norte',
        });

        await componente.submit();

        expect(payloadGuardado().extra?.['terceroCrematorio']).toBeUndefined();
      });
    });

    describe('catálogo de servicios', () => {
      it('debería deducir el tipo del nombre, que es por lo que filtra el buscador', async () => {
        await crear();
        listoParaPublicar();

        await componente.submit();

        const servicios = payloadGuardado().extra?.['serviciosFunerarios'] as Record<string, unknown>[];
        expect(servicios[0]['tipo']).toBe(TipoServicioFunerario.CREMACION_INDIVIDUAL);
      });

      it('debería marcar como «otros» un nombre que no está en el catálogo del dominio', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        conServicio('Despedida en el mar');
        componente.funerariosGroup.patchValue({ declaraAutorizaciones: true });
        dejarListoParaPublicar();

        await componente.submit();

        const servicios = payloadGuardado().extra?.['serviciosFunerarios'] as Record<string, unknown>[];
        expect(servicios[0]['tipo']).toBe(TipoServicioFunerario.OTROS);
      });

      it('debería derivar los tipos filtrables del catálogo, sin repetirlos', async () => {
        await crear();
        rellenarBase(VerticalKey.FUNERARIOS);
        conServicio('Cremación individual');
        conServicio('Cremación individual', 200);
        conServicio('Entierro / cementerio', 300);
        componente.funerariosGroup.patchValue({ declaraAutorizaciones: true });
        dejarListoParaPublicar();

        await componente.submit();

        expect(payloadGuardado().extra?.['tiposServicioFunerario']).toEqual([
          TipoServicioFunerario.CREMACION_INDIVIDUAL,
          TipoServicioFunerario.ENTIERRO,
        ]);
      });

      /* La estrategia de precio busca el primer tramo que cubre el peso. */
      it('debería guardar los tramos de peso ordenados de menor a mayor', async () => {
        await crear();
        listoParaPublicar();
        componente.agregarTramoPeso(0);
        componente.agregarTramoPeso(0);
        componente.tramosPeso(0).at(0).patchValue({ hastaKg: 30, precio: 260 });
        componente.tramosPeso(0).at(1).patchValue({ hastaKg: 10, precio: 150 });

        await componente.submit();

        const servicios = payloadGuardado().extra?.['serviciosFunerarios'] as Record<string, unknown>[];
        expect(servicios[0]['tramosPeso']).toEqual([
          { hastaKg: 10, precio: 150 },
          { hastaKg: 30, precio: 260 },
        ]);
      });

      it('debería descartar un tramo sin límite de peso', async () => {
        // Un tramo «hasta 0 kg» no cubre a ningún animal: guardarlo dejaría en
        // el catálogo una fila que nunca se aplica.
        await crear();
        listoParaPublicar();
        componente.agregarTramoPeso(0);
        componente.agregarTramoPeso(0);
        componente.tramosPeso(0).at(0).patchValue({ hastaKg: 0, precio: 90 });
        componente.tramosPeso(0).at(1).patchValue({ hastaKg: 10, precio: 150 });

        await componente.submit();

        const servicios = payloadGuardado().extra?.['serviciosFunerarios'] as Record<string, unknown>[];
        expect(servicios[0]['tramosPeso']).toEqual([{ hastaKg: 10, precio: 150 }]);
      });

      it('debería poder quitar un servicio del catálogo', async () => {
        await crear();
        conServicio();
        conServicio('Entierro / cementerio', 300);

        componente.quitarServicioFunerario(0);

        expect(componente.serviciosFunerarios.length).toBe(1);
        expect(componente.serviciosFunerarios.at(0).value.nombre).toBe('Entierro / cementerio');
      });
    });

    describe('recogida', () => {
      it('debería guardar la recogida con sus lugares y su radio', async () => {
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({ ofreceRecogida: true, radioRecogidaKm: 40 });

        await componente.submit();

        const extra = payloadGuardado().extra!;
        expect(extra['ofreceRecogida']).toBe(true);
        expect(extra['radioRecogidaKm']).toBe(40);
        expect(extra['lugaresRecogida']).toEqual([LugarRecogida.DOMICILIO, LugarRecogida.VETERINARIO]);
      });

      it('no debería guardar lugares de recogida si no la ofrece', async () => {
        // Publicarlos anunciaría una recogida que la empresa no hace.
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({ ofreceRecogida: false });

        await componente.submit();

        expect(payloadGuardado().extra?.['lugaresRecogida']).toEqual([]);
      });

      it('debería alternar los lugares de recogida marcados', async () => {
        await crear();

        expect(componente.tieneLugarRecogida(LugarRecogida.DOMICILIO)).toBe(true);

        componente.toggleLugarRecogida(LugarRecogida.DOMICILIO);
        expect(componente.tieneLugarRecogida(LugarRecogida.DOMICILIO)).toBe(false);

        componente.toggleLugarRecogida(LugarRecogida.RESIDENCIA);
        expect(componente.tieneLugarRecogida(LugarRecogida.RESIDENCIA)).toBe(true);
      });

      it('debería guardar las zonas con su precio cuando tarifica por zona', async () => {
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({ modoPrecioRecogida: ModoPrecioRecogida.POR_ZONA });
        componente.agregarZonaRecogida();
        componente.zonasRecogida.at(0).patchValue({ nombre: 'Norte', precio: 30 });

        await componente.submit();

        expect(payloadGuardado().extra?.['modoPrecioRecogida']).toBe(ModoPrecioRecogida.POR_ZONA);
        expect(payloadGuardado().extra?.['zonasRecogida']).toEqual([{ nombre: 'Norte', precio: 30 }]);
      });

      it('debería poder quitar una zona de recogida', async () => {
        await crear();
        componente.agregarZonaRecogida();

        componente.quitarZonaRecogida(0);

        expect(componente.zonasRecogida.length).toBe(0);
      });
    });

    describe('urgencia y franjas', () => {
      it('debería alternar las franjas en las que atiende', async () => {
        await crear();

        expect(componente.tieneFranja(FranjaHoraria.MANANA)).toBe(true);

        componente.toggleFranja(FranjaHoraria.MANANA);
        expect(componente.tieneFranja(FranjaHoraria.MANANA)).toBe(false);

        componente.toggleFranja(FranjaHoraria.NOCHE);
        expect(componente.tieneFranja(FranjaHoraria.NOCHE)).toBe(true);
      });

      it('debería guardar el suplemento de urgencia declarado', async () => {
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({
          servicioUrgente: true, atiende24h: true, suplementoUrgencia: 60,
        });

        await componente.submit();

        const extra = payloadGuardado().extra!;
        expect(extra['servicioUrgente']).toBe(true);
        expect(extra['atiende24h']).toBe(true);
        expect(extra['suplementoUrgencia']).toBe(60);
      });
    });

    describe('extras y cancelación', () => {
      it('debería guardar los extras del catálogo', async () => {
        await crear();
        listoParaPublicar();
        componente.agregarExtraFunerario();
        componente.extrasFunerarios.at(0).patchValue({ nombre: 'Urna de madera', precio: 45 });

        await componente.submit();

        const extras = payloadGuardado().extra?.['extras'] as Record<string, unknown>[];
        expect(extras[0]).toMatchObject({ nombre: 'Urna de madera', precio: 45 });
      });

      it('debería poder quitar un extra', async () => {
        await crear();
        componente.agregarExtraFunerario();

        componente.quitarExtraFunerario(0);

        expect(componente.extrasFunerarios.length).toBe(0);
      });

      /* §11: antes de la recogida todo es reversible; después, ya no. */
      it('debería guardar los dos momentos de la política de cancelación', async () => {
        await crear();
        listoParaPublicar();
        componente.funerariosGroup.patchValue({
          reembolsoAntesRecogidaPct: 80,
          reembolsoIniciadoPct: 0,
          notasCancelacion: 'Una vez iniciada la cremación no hay devolución.',
        });

        await componente.submit();

        expect(payloadGuardado().extra?.['politicaCancelacionFunerario']).toEqual({
          reembolsoAntesRecogidaPct: 80,
          reembolsoIniciadoPct: 0,
          notas: 'Una vez iniciada la cremación no hay devolución.',
        });
      });

      it('debería omitir las notas de cancelación cuando se dejan en blanco', async () => {
        await crear();
        listoParaPublicar();

        await componente.submit();

        const politica = payloadGuardado().extra?.['politicaCancelacionFunerario'] as Record<string, unknown>;
        expect(politica['notas']).toBeUndefined();
      });
    });

    describe('precarga al editar', () => {
      it('debería devolver al formulario el catálogo, los extras y las zonas', async () => {
        await crear('s1', {
          vertical: VerticalKey.FUNERARIOS, titulo: 'Descanso Animal',
          descripcion: 'Servicios funerarios para mascotas', ciudad: 'Madrid', precioBase: 180,
          extra: {
            serviciosFunerarios: [{ nombre: 'Cremación individual', precioBase: 180 }],
            extras: [{ nombre: 'Urna de madera', precio: 45 }],
            zonasRecogida: [{ nombre: 'Norte', precio: 30 }],
            lugaresRecogida: [LugarRecogida.DOMICILIO],
            franjasDisponibles: [FranjaHoraria.MANANA],
            radioRecogidaKm: 40,
          },
        });

        expect(componente.serviciosFunerarios.length).toBe(1);
        expect(componente.extrasFunerarios.length).toBe(1);
        expect(componente.zonasRecogida.length).toBe(1);
        expect(componente.funerariosGroup.value.radioRecogidaKm).toBe(40);
        expect(componente.tieneLugarRecogida(LugarRecogida.DOMICILIO)).toBe(true);
        expect(componente.tieneFranja(FranjaHoraria.TARDE)).toBe(false);
      });

      it('debería asumir reembolso íntegro antes de la recogida si no lo declararon', async () => {
        await crear('s1', {
          vertical: VerticalKey.FUNERARIOS, titulo: 'Descanso Animal',
          descripcion: 'Servicios funerarios para mascotas', ciudad: 'Madrid', precioBase: 180,
          extra: {},
        });

        expect(componente.funerariosGroup.value).toMatchObject({
          reembolsoAntesRecogidaPct: 100, reembolsoIniciadoPct: 0, notasCancelacion: '',
        });
      });

      it('debería devolver la política de cancelación guardada', async () => {
        await crear('s1', {
          vertical: VerticalKey.FUNERARIOS, titulo: 'Descanso Animal',
          descripcion: 'Servicios funerarios para mascotas', ciudad: 'Madrid', precioBase: 180,
          extra: {
            politicaCancelacionFunerario: {
              reembolsoAntesRecogidaPct: 80, reembolsoIniciadoPct: 10, notas: 'Consultar casos.',
            },
          },
        });

        expect(componente.funerariosGroup.value).toMatchObject({
          reembolsoAntesRecogidaPct: 80, reembolsoIniciadoPct: 10, notasCancelacion: 'Consultar casos.',
        });
      });
    });
  });

  describe('guardado', () => {
    it('debería crear el listado y volver al panel', async () => {
      await crear();
      rellenarBase(VerticalKey.TRANSPORTE);
      jest.useFakeTimers();

      dejarListoParaPublicar();
      await componente.submit();
      jest.runAllTimers();

      expect(api.crearServicio).toHaveBeenCalled();
      expect(componente.exitoMsg()).toContain('borrador');
      expect(router.navigate).toHaveBeenCalledWith(['/comercio/listados']);
      jest.useRealTimers();
    });

    it('debería actualizar el listado existente', async () => {
      await crear('s1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'DogVan', descripcion: 'Traslados con jaula',
        ciudad: 'Madrid', precioBase: 30, extra: {},
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(api.actualizarServicio).toHaveBeenCalledWith('s1', expect.any(Object));
      expect(componente.exitoMsg()).toContain('guardados');
    });

    it('debería informar del fallo sin dejar el botón bloqueado', async () => {
      await crear();
      api.crearServicio.mockReturnValue(throwError(() => new Error('500')));
      rellenarBase(VerticalKey.TRANSPORTE);

      dejarListoParaPublicar();
      await componente.submit();

      expect(componente.errorMsg()).toContain('Error al guardar');
      expect(componente.guardando()).toBe(false);
    });
  });

  describe('precarga por vertical al editar', () => {
    it('debería precargar el transporte con su zona de cobertura', async () => {
      await crear('s1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'DogVan', descripcion: 'Traslados con jaula',
        ciudad: 'Madrid', precioBase: 30,
        extra: { tipoVehiculo: 'coche', tarifaBase: 20, tarifaKm: 1.2, zonaCobertura: ['Madrid', 'Toledo'] },
      });

      expect(componente.transporteGroup.value).toMatchObject({ tipoVehiculo: 'coche', tarifaKm: 1.2 });
      expect(componente.transporteGroup.value.zonaCobertura).toEqual(['Madrid', 'Toledo']);
    });

    it('debería precargar la peluquería con sus servicios y adicionales', async () => {
      await crear('s1', {
        vertical: VerticalKey.PELUQUERIA, titulo: 'Real Grooming', descripcion: 'Baño y corte',
        ciudad: 'Madrid', precioBase: 30,
        extra: {
          serviciosGrooming: [{ nombre: 'Baño', precio: 20, tipoPeloCompatible: ['corto'] }],
          serviciosAdicionales: [{ nombre: 'Corte de uñas', precio: 5 }],
          razasEspecificas: ['Caniche'],
          politicaTemperamentoDificil: 'condicionado',
        },
      });

      expect(componente.serviciosGrooming.length).toBe(1);
      expect(componente.pelosCompatibles(0)).toEqual(['corto']);
      expect(componente.serviciosAdicionalesPeluqueria.length).toBe(1);
      expect(componente.peluqueriaGroup.value.razasEspecificas).toEqual(['Caniche']);
    });

    it('debería precargar el adiestramiento con el precio de cada valoración', async () => {
      await crear('s1', {
        vertical: VerticalKey.ADIESTRAMIENTO, titulo: 'Escuela Canina', descripcion: 'Obediencia básica',
        ciudad: 'Madrid', precioBase: 50,
        extra: {
          serviciosAdiestramiento: [{ nombre: 'Obediencia', tipo: 'individual', precio: 50 }],
          valoracionesIniciales: [
            { modalidad: 'online', precio: 25 },
            { modalidad: 'domicilio', precio: 40 },
          ],
        },
      });

      expect(componente.adiestramientoGroup.value).toMatchObject({
        valoracionPresencialPrecio: 0, valoracionOnlinePrecio: 25, valoracionDomicilioPrecio: 40,
      });
      expect(componente.serviciosAdiestramiento.length).toBe(1);
    });

    it('debería leer las fichas antiguas con una única valoración', async () => {
      // Antes de los precios por modalidad se guardaba `valoracionInicial`
      // suelta; esas fichas siguen vivas y tienen que abrirse igual.
      await crear('s1', {
        vertical: VerticalKey.ADIESTRAMIENTO, titulo: 'Escuela Canina', descripcion: 'Obediencia básica',
        ciudad: 'Madrid', precioBase: 50,
        extra: { valoracionInicial: { modalidad: 'online', precio: 25 } },
      });

      expect(componente.adiestramientoGroup.value).toMatchObject({
        valoracionOnlinePrecio: 25, valoracionPresencialPrecio: 0, valoracionDomicilioPrecio: 0,
      });
    });

    it('debería asumir todas las valoraciones gratuitas si no las declararon', async () => {
      await crear('s1', {
        vertical: VerticalKey.ADIESTRAMIENTO, titulo: 'Escuela Canina', descripcion: 'Obediencia básica',
        ciudad: 'Madrid', precioBase: 50, extra: {},
      });

      expect(componente.adiestramientoGroup.value).toMatchObject({
        valoracionPresencialPrecio: 0, valoracionOnlinePrecio: 0, valoracionDomicilioPrecio: 0,
      });
    });

    it('debería precargar el hotel con sus suplementos por tamaño', async () => {
      await crear('s1', {
        vertical: VerticalKey.HOTELES, titulo: 'Gran Hotel', descripcion: 'Pet friendly con jardín',
        ciudad: 'Madrid', precioBase: 90,
        extra: {
          especiesPermitidas: ['perro', 'gato'],
          serviciosPetfriendly: ['Cama', 'Comedero'],
          razasEspecificasRestringidas: ['Pitbull'],
          suplementoPorTamanoMascota: [{ tamano: 'grande', precioPorNoche: 15 }],
        },
      });

      expect(componente.hotelesGroup.value.especiesPermitidas).toEqual(['perro', 'gato']);
      expect(componente.hotelesGroup.value.serviciosPetfriendly).toEqual(['Cama', 'Comedero']);
      expect(componente.suplementoPorTamanoMascota.length).toBe(1);
    });

    it('debería quedarse con los valores por defecto si el listado no trae extra', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Villa', descripcion: 'Casa con jardín',
        ciudad: 'Madrid', precioBase: 40,
      });

      expect(componente.espacios.length).toBe(0);
      expect(componente.alojamientoGroup.value.requisitoVacunas).toBe(true);
    });

    it('debería guardar los servicios de peluquería con sus precios por tamaño', async () => {
      await crear();
      rellenarBase(VerticalKey.PELUQUERIA);
      componente.agregarServicioGrooming();
      componente.agregarPrecioPorTamano(0);
      componente.preciosPorTamano(0).at(0).patchValue({ tamano: 'grande', precio: 35 });

      dejarListoParaPublicar();
      await componente.submit();

      const servicios = payloadGuardado().extra?.['serviciosGrooming'] as Record<string, unknown>[];
      expect((servicios[0]['preciosPorTamano'] as unknown[])).toHaveLength(1);
    });
  });

  describe('ayudas de la interfaz', () => {
    it('debería adaptar el ejemplo del título a la categoría elegida', async () => {
      await crear();

      componente.form.controls.vertical.setValue(VerticalKey.PELUQUERIA);
      expect(componente.placeholderTitulo()).toContain('Peluquería');

      componente.form.controls.vertical.setValue(VerticalKey.SEGUROS);
      expect(componente.placeholderTitulo()).toContain('Residencia Canina');
    });
  });
  /**
   * Los selectores multiples del formulario (conductas, modalidades, tamanos,
   * compatibilidad, tipos de pelo) siguen todos el mismo patron de alternar.
   * Cada uno decide que perros acepta el negocio, asi que un fallo aqui no da
   * error: simplemente el comercio recibe reservas que no puede atender.
   */
  describe('selectores multiples de aptitud', () => {
    it('deberia alternar las conductas de riesgo no admitidas', async () => {
      await crear();

      expect(componente.tieneConductaNoAdmitida('agresividad')).toBe(false);

      componente.toggleConductaNoAdmitida('agresividad');
      expect(componente.tieneConductaNoAdmitida('agresividad')).toBe(true);

      componente.toggleConductaNoAdmitida('agresividad');
      expect(componente.tieneConductaNoAdmitida('agresividad')).toBe(false);
    });

    it('deberia acumular varias conductas', async () => {
      await crear();

      componente.toggleConductaNoAdmitida('agresividad');
      componente.toggleConductaNoAdmitida('destructivo');

      expect(componente.tieneConductaNoAdmitida('agresividad')).toBe(true);
      expect(componente.tieneConductaNoAdmitida('destructivo')).toBe(true);
    });

    it('deberia alternar la compatibilidad social', async () => {
      await crear();

      componente.toggleCompatibilidad('sociable');
      expect(componente.tieneCompatibilidad('sociable')).toBe(true);

      componente.toggleCompatibilidad('sociable');
      expect(componente.tieneCompatibilidad('sociable')).toBe(false);
    });
  });

  describe('servicios clinicos y de grooming', () => {
    it('deberia agregar y quitar filas de servicio clinico', async () => {
      await crear();
      const antes = componente.serviciosClinicos.length;

      componente.agregarServicioClinico();
      expect(componente.serviciosClinicos.length).toBe(antes + 1);

      componente.quitarServicioClinico(antes);
      expect(componente.serviciosClinicos.length).toBe(antes);
    });

    it('deberia agregar y quitar filas de grooming', async () => {
      await crear();
      const antes = componente.serviciosGrooming.length;

      componente.agregarServicioGrooming();
      expect(componente.serviciosGrooming.length).toBe(antes + 1);

      componente.quitarServicioGrooming(antes);
      expect(componente.serviciosGrooming.length).toBe(antes);
    });

    it('deberia agregar una fila de grooming con la duracion por defecto', async () => {
      await crear();

      componente.agregarServicioGrooming();

      expect(componente.serviciosGrooming.at(0).getRawValue().duracionMin).toBe(45);
    });
  });

  describe('precios por tamano de perro', () => {
    it('deberia agregar y quitar tramos de precio dentro de un servicio', async () => {
      await crear();
      componente.agregarServicioGrooming();

      componente.agregarPrecioPorTamano(0);
      expect(componente.preciosPorTamano(0).length).toBe(1);

      componente.agregarPrecioPorTamano(0);
      expect(componente.preciosPorTamano(0).length).toBe(2);

      componente.quitarPrecioPorTamano(0, 0);
      expect(componente.preciosPorTamano(0).length).toBe(1);
    });

    it('deberia crear el tramo con tamano mediano por defecto', async () => {
      await crear();
      componente.agregarServicioGrooming();

      componente.agregarPrecioPorTamano(0);

      expect(componente.preciosPorTamano(0).at(0).getRawValue()).toMatchObject({
        tamano: 'mediano', precio: 0, duracionMin: 45,
      });
    });
  });

  describe('tipos de pelo compatibles', () => {
    it('deberia empezar sin ninguno marcado', async () => {
      await crear();
      componente.agregarServicioGrooming();

      expect(componente.pelosCompatibles(0)).toEqual([]);
      expect(componente.tienePeloCompatible(0, 'corto')).toBe(false);
    });

    it('deberia marcar y desmarcar un tipo de pelo', async () => {
      await crear();
      componente.agregarServicioGrooming();

      componente.togglePeloCompatible(0, 'corto');
      expect(componente.tienePeloCompatible(0, 'corto')).toBe(true);

      componente.togglePeloCompatible(0, 'corto');
      expect(componente.tienePeloCompatible(0, 'corto')).toBe(false);
    });

    it('deberia acumular varios tipos de pelo en el mismo servicio', async () => {
      await crear();
      componente.agregarServicioGrooming();

      componente.togglePeloCompatible(0, 'corto');
      componente.togglePeloCompatible(0, 'rizado');

      expect(componente.pelosCompatibles(0)).toEqual(['corto', 'rizado']);
    });

    it('no deberia mezclar los pelos de dos servicios distintos', async () => {
      await crear();
      componente.agregarServicioGrooming();
      componente.agregarServicioGrooming();

      componente.togglePeloCompatible(0, 'corto');

      expect(componente.tienePeloCompatible(1, 'corto')).toBe(false);
    });
  });
  /**
   * La dirección y el horario cuelgan del servicio, no del negocio: un mismo
   * comercio puede tener la peluquería en el centro abriendo de tarde y la
   * residencia a las afueras con entradas sólo por la mañana.
   */
  describe('dirección y horario del servicio', () => {
    it('debería enviar la dirección completa, no sólo la ciudad', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.form.patchValue({
        calle: 'Calle Mayor', numero: '24', provincia: 'Madrid',
        codigoPostal: '28013', pais: 'España',
      });

      dejarListoParaPublicar();
      await componente.submit();

      expect(ultimoPayload()).toMatchObject({
        calle: 'Calle Mayor', numero: '24', provincia: 'Madrid',
        codigoPostal: '28013', pais: 'España',
      });
    });

    it('debería enviar la semana entera aunque no se toque', async () => {
      // Un día ausente y un día cerrado no significan lo mismo para quien lee
      // la ficha, así que el horario viaja siempre con sus siete días.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

      dejarListoParaPublicar();
      await componente.submit();

      expect(ultimoPayload().horario).toHaveLength(7);
    });

    it('debería enviar los días especiales marcados', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.excepciones.set([{ fecha: '2026-12-25', cerrado: true, motivo: 'Navidad' }]);

      dejarListoParaPublicar();
      await componente.submit();

      expect(ultimoPayload().excepcionesHorario)
        .toEqual([{ fecha: '2026-12-25', cerrado: true, motivo: 'Navidad' }]);
    });

    it('debería recuperar el horario guardado al editar', async () => {
      await crear('serv-1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'X', descripcion: 'Y',
        calle: 'Gran Vía', codigoPostal: '46001',
        horario: [{ dia: 'lunes', abre: '08:00', cierra: '20:00', cerrado: false }],
        excepcionesHorario: [{ fecha: '2026-08-15', cerrado: true }],
      });

      expect(componente.form.getRawValue().calle).toBe('Gran Vía');
      expect(componente.horario()[0]).toMatchObject({ abre: '08:00' });
      expect(componente.excepciones()).toHaveLength(1);
    });

    it('debería dar una semana en blanco a un servicio antiguo sin horario', async () => {
      // Los listados creados antes de que el horario colgara del servicio llegan
      // sin él; el editor necesita sus siete días igualmente.
      await crear('serv-1', { vertical: VerticalKey.ALOJAMIENTO, titulo: 'X', descripcion: 'Y' });

      expect(componente.horario()).toHaveLength(7);
    });

    it('debería rellenar la dirección al elegirla del desplegable', async () => {
      await crear();

      componente.usarDireccionSugerida({
        placeId: 'p1', ciudad: 'Madrid', lat: 40.4169, lng: -3.7035,
        direccion: {
          calle: 'Calle Mayor', numero: '24', codigoPostal: '28013',
          ciudad: 'Madrid', provincia: 'Madrid', pais: 'España',
          formateada: 'C. Mayor, 24, 28013 Madrid', lat: 40.4169, lng: -3.7035,
        },
      });

      expect(componente.form.getRawValue()).toMatchObject({
        calle: 'Calle Mayor', numero: '24', codigoPostal: '28013',
      });
      expect(componente.tieneCoordenadas()).toBe(true);
    });

    it('debería recolocar el pin y reescribir la dirección al tocar el mapa', async () => {
      await crear();
      componente.form.patchValue({ calle: 'Calle de Alcalá', codigoPostal: '28009' });

      await componente.moverPin({ lat: 40.4165, lng: -3.6935 });

      expect(geo.direccionDePunto).toHaveBeenCalledWith(40.4165, -3.6935);
      expect(componente.form.getRawValue()).toMatchObject({
        calle: 'Paseo del Prado', codigoPostal: '28014',
      });
      expect(componente.tieneCoordenadas()).toBe(true);
    });

    it('no debería reescribir la dirección con la casilla desmarcada', async () => {
      // Un negocio en un polígono clava el pin donde de verdad se entra y no
      // quiere que el geocodificador le ponga la nave de al lado.
      await crear();
      componente.form.patchValue({ calle: 'Camino del Monte' });
      componente.sincronizarPin.set(false);

      await componente.moverPin({ lat: 40.4165, lng: -3.6935 });

      expect(geo.direccionDePunto).not.toHaveBeenCalled();
      expect(componente.form.getRawValue().calle).toBe('Camino del Monte');
      // El punto sí se mueve: es lo que se acaba de pedir.
      expect(componente.tieneCoordenadas()).toBe(true);
    });

    it('no debería recentrar el mapa al tocarlo', async () => {
      // Recentrar en cada toque hace saltar el mapa bajo el dedo justo cuando
      // se está afinando el sitio.
      await crear();
      componente.guardarCoordenadas({ placeId: 'p1', ciudad: 'Madrid', lat: 40.4, lng: -3.7 });
      const centroInicial = componente.centroMapa();

      await componente.moverPin({ lat: 40.4165, lng: -3.6935 });

      expect(componente.centroMapa()).toBe(centroInicial);
    });

    it('debería dejar el pin puesto aunque la dirección no se resuelva', async () => {
      await crear();
      geo.direccionDePunto.mockResolvedValue(null);

      await componente.moverPin({ lat: 40.4165, lng: -3.6935 });

      expect(componente.tieneCoordenadas()).toBe(true);
      expect(componente.buscandoDireccion()).toBe(false);
    });

    it('no debería borrar lo tecleado si la sugerencia viene sin desglose', async () => {
      await crear();
      componente.form.patchValue({ calle: 'Camino del Monte' });

      componente.usarDireccionSugerida({ placeId: 'p2', ciudad: 'Soria', lat: 41.76, lng: -2.46 });

      expect(componente.form.getRawValue().calle).toBe('Camino del Monte');
    });
  });

  /**
   * Rellenar la ficha lleva veinte campos y varias fotos: una recarga, un móvil
   * que descarta la pestaña o un «atrás» del navegador tiraban todo el trabajo.
   */
  describe('borrador en el dispositivo', () => {
    /** Vuelve a montar el componente como si se recargara la página. */
    const recargar = async (): Promise<void> => {
      fixture.destroy();
      fixture = TestBed.createComponent(ComercioListadoFormComponent);
      componente = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('debería recuperar lo escrito tras recargar', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.form.patchValue({ calle: 'Calle Mayor', codigoPostal: '28013' });

      await recargar();

      expect(componente.form.getRawValue()).toMatchObject({
        titulo: 'Residencia Royal', calle: 'Calle Mayor', codigoPostal: '28013',
      });
      expect(componente.borradorRestaurado()).toBe(true);
    });

    it('debería recuperar el horario y los días especiales', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.excepciones.set([{ fecha: '2026-12-25', cerrado: true, motivo: 'Navidad' }]);
      componente.guardarCambioSuelto();

      await recargar();

      expect(componente.excepciones()).toEqual([{ fecha: '2026-12-25', cerrado: true, motivo: 'Navidad' }]);
    });

    it('debería recuperar el pin del mapa', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.guardarCoordenadas({ placeId: 'p1', ciudad: 'Madrid', lat: 40.4, lng: -3.7 });

      await recargar();

      expect(componente.tieneCoordenadas()).toBe(true);
    });

    it('debería devolver al paso donde se quedó', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.irAlPaso('categoria');
      componente.siguientePaso();

      await recargar();

      expect(componente.paso()).toBe('ubicacion');
    });

    it('debería reconstruir los espacios del alojamiento', async () => {
      // Los FormArray no se restauran con un patchValue: se rehacen desde el
      // payload, el mismo camino que usa la edición.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

      await recargar();

      expect(componente.espacios.length).toBe(1);
    });

    it('debería tirar el borrador al crear el servicio', async () => {
      // Si sobreviviera, el siguiente alta arrancaría con la ficha ya publicada.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

      dejarListoParaPublicar();
      await componente.submit();
      await recargar();

      expect(componente.form.getRawValue().titulo).toBe('');
      expect(componente.borradorRestaurado()).toBe(false);
    });

    it('NO debería restaurar nada al editar un servicio existente', async () => {
      // Al editar manda lo guardado en el servidor; un borrador encima
      // resucitaría cambios que se descartaron.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);

      fixture.destroy();
      TestBed.resetTestingModule();
      await crear('serv-1', { vertical: VerticalKey.PELUQUERIA, titulo: 'Del servidor', descripcion: 'X' });

      expect(componente.form.getRawValue().titulo).toBe('Del servidor');
      expect(componente.borradorRestaurado()).toBe(false);
    });
  });

  /** Empotrado en el alta guiada (`/comercio/alta`). */
  describe('modo alta', () => {
    it('debería arrancar con la categoría que llega del paso anterior, ya fijada', async () => {
      await crearEnAlta(VerticalKey.PELUQUERIA);

      expect(componente.form.getRawValue().vertical).toBe(VerticalKey.PELUQUERIA);
      expect(componente.form.controls.vertical.disabled).toBe(true);
    });

    it('debería avisar al asistente en vez de navegar al listado', async () => {
      await crearEnAlta(VerticalKey.ALOJAMIENTO);
      const creado = jest.fn();
      componente.creado.subscribe(creado);
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

      dejarListoParaPublicar();
      await componente.submit();

      expect(creado).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('fuera del alta debería seguir llevando a «Mis servicios»', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

      dejarListoParaPublicar();
      await componente.submit();

      expect(componente.exitoMsg()).toContain('borrador');
    });
  });
});
