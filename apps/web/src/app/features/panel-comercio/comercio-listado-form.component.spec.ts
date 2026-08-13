import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ServicioClinicoTipo, SERVICIO_CLINICO_LABELS, TipoSeguro, VerticalKey } from 'shared';
import { ComercioListadoFormComponent } from './comercio-listado-form.component';
import { ComercioApiService, ServicioPayload } from './comercio-api.service';

interface ApiDoble {
  obtenerServicioGestion: jest.Mock;
  crearServicio: jest.Mock;
  actualizarServicio: jest.Mock;
}

describe('ComercioListadoFormComponent', () => {
  let fixture: ComponentFixture<ComercioListadoFormComponent>;
  let componente: ComercioListadoFormComponent;
  let api: ApiDoble;
  let router: Router;

  const crear = async (id: string | null = null, servicio?: Record<string, unknown>): Promise<void> => {
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

      expect(componente.errorMsg()).toContain('servicio clínico');
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

    it('debería marcar en rojo solo los campos ya tocados', async () => {
      await crear();

      expect(componente.hasError('titulo')).toBe(false);
      componente.form.controls.titulo.markAsTouched();
      expect(componente.hasError('titulo')).toBe(true);
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

      await componente.submit();

      const espacios = payloadGuardado().extra?.['espacios'] as Record<string, unknown>[];
      expect(espacios[0]).toMatchObject({ tipo: 'suite', precioNoche: 60 });
      expect(espacios[0]['amenities']).toEqual(['cama', 'manta', 'música']);
    });

    it('debería omitir el tamaño máximo cuando el comercio no lo limita', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();

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

  describe('aptitud del servicio', () => {
    it('debería alternar tamaños y tipos de pelo admitidos', async () => {
      await crear();

      componente.toggleTamano('grande');
      componente.togglePelo('rizado');
      expect(componente.tieneTamano('grande')).toBe(true);
      expect(componente.tienePelo('rizado')).toBe(true);

      componente.toggleTamano('grande');
      expect(componente.tieneTamano('grande')).toBe(false);
    });

    it('debería enviar la aptitud declarada junto al listado', async () => {
      await crear();
      rellenarBase(VerticalKey.TRANSPORTE);
      componente.toggleTamano('mini');
      componente.togglePelo('corto');
      componente.temperamentosNoAdmitidos = ['Agresivo con perros', 'Muy nervioso'];

      await componente.submit();

      expect(payloadGuardado().aptitud).toEqual({
        tamanosAdmitidos: ['mini'],
        tipoPeloAdmitido: ['corto'],
        temperamentosNoAdmitidos: ['Agresivo con perros', 'Muy nervioso'],
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
      componente.agregarServicioClinico();
      componente.serviciosClinicos.at(0).patchValue({ tipo: ServicioClinicoTipo.CONSULTA_GENERAL });
      componente.veterinariaGroup.patchValue({
        especialidades: ['Traumatología', 'Dermatología'], especiesAtendidas: ['Perro', 'Gato'],
      });

      await componente.submit();

      expect(payloadGuardado().extra?.['especialidades']).toEqual(['Traumatología', 'Dermatología']);
      expect(payloadGuardado().extra?.['especiesAtendidas']).toEqual(['Perro', 'Gato']);
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
    it('debería omitir el programa cuando la modalidad es por sesión', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.adiestramientoGroup.patchValue({
        modalidad: 'sesion', precioPrograma: 300, sesionesPorPrograma: 8,
      });

      await componente.submit();

      // Guardar un precio de programa en modalidad sesión mostraría dos precios
      // distintos en la ficha pública.
      expect(payloadGuardado().extra?.['precioPrograma']).toBeUndefined();
      expect(payloadGuardado().extra?.['sesionesPorPrograma']).toBeUndefined();
    });

    it('debería guardar el programa completo cuando esa es la modalidad', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.adiestramientoGroup.patchValue({
        modalidad: 'programa', precioPrograma: 300, sesionesPorPrograma: 8,
      });

      await componente.submit();

      expect(payloadGuardado().extra?.['precioPrograma']).toBe(300);
      expect(payloadGuardado().extra?.['sesionesPorPrograma']).toBe(8);
    });

    it('debería omitir la valoración inicial si es gratuita', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);

      await componente.submit();

      expect(payloadGuardado().extra?.['valoracionInicial']).toBeUndefined();
    });

    it('debería anidar la valoración inicial cuando tiene precio', async () => {
      await crear();
      rellenarBase(VerticalKey.ADIESTRAMIENTO);
      componente.adiestramientoGroup.patchValue({
        valoracionInicialModalidad: 'online', valoracionInicialPrecio: 25,
      });

      await componente.submit();

      expect(payloadGuardado().extra?.['valoracionInicial']).toEqual({ modalidad: 'online', precio: 25 });
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

      await componente.submit();

      const extra = payloadGuardado().extra!;
      expect(extra['descuentoPagoAnualPct']).toBe(0.1);
      expect((extra['condicionesAdmision'] as Record<string, unknown>)['recargoRiesgoPct']).toBe(0.25);
    });

    it('debería tratar el cero de las condiciones como "sin límite"', async () => {
      await crear();
      rellenarBase(VerticalKey.SEGUROS);
      componente.alternarCobertura(TipoSeguro.RC_OBLIGATORIA);

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

  describe('guardado', () => {
    it('debería crear el listado y volver al panel', async () => {
      await crear();
      rellenarBase(VerticalKey.TRANSPORTE);
      jest.useFakeTimers();

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

      await componente.submit();

      expect(api.actualizarServicio).toHaveBeenCalledWith('s1', expect.any(Object));
      expect(componente.exitoMsg()).toContain('guardados');
    });

    it('debería informar del fallo sin dejar el botón bloqueado', async () => {
      await crear();
      api.crearServicio.mockReturnValue(throwError(() => new Error('500')));
      rellenarBase(VerticalKey.TRANSPORTE);

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

    it('debería precargar el adiestramiento con su valoración inicial', async () => {
      await crear('s1', {
        vertical: VerticalKey.ADIESTRAMIENTO, titulo: 'Escuela Canina', descripcion: 'Obediencia básica',
        ciudad: 'Madrid', precioBase: 50,
        extra: {
          tiposAdiestramiento: ['obediencia', 'conducta'],
          serviciosAdiestramiento: [{ nombre: 'Obediencia', tipo: 'individual', precio: 50 }],
          valoracionInicial: { modalidad: 'online', precio: 25 },
        },
      });

      expect(componente.adiestramientoGroup.value.tiposAdiestramiento).toEqual(['obediencia', 'conducta']);
      expect(componente.adiestramientoGroup.value).toMatchObject({
        valoracionInicialModalidad: 'online', valoracionInicialPrecio: 25,
      });
      expect(componente.serviciosAdiestramiento.length).toBe(1);
    });

    it('debería asumir valoración presencial gratuita si no la declararon', async () => {
      await crear('s1', {
        vertical: VerticalKey.ADIESTRAMIENTO, titulo: 'Escuela Canina', descripcion: 'Obediencia básica',
        ciudad: 'Madrid', precioBase: 50, extra: {},
      });

      expect(componente.adiestramientoGroup.value).toMatchObject({
        valoracionInicialModalidad: 'presencial', valoracionInicialPrecio: 0,
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
});
