import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ModalidadAlojamiento, VerticalKey } from 'shared';
import { ComercioListadoFormComponent } from './comercio-listado-form.component';
import { ComercioApiService, ServicioPayload } from './comercio-api.service';
import { GeoService, type DireccionLugar } from '../../core/geo/geo.service';

type ApiDoble = jest.Mocked<Pick<ComercioApiService, 'obtenerServicioGestion' | 'crearServicio' | 'actualizarServicio'>>;
type GeoDoble = jest.Mocked<Pick<GeoService, 'direccionDePunto'>>;

const FOTOS = ['/f1.jpg', '/f2.jpg', '/f3.jpg', '/f4.jpg', '/f5.jpg'];

/** Clave del borrador para un comercio sin sesión (la que usa el alta en pruebas). */
const CLAVE_BORRADOR = 'dk_borrador_servicio_anon';

/**
 * Modalidades del alojamiento (residencia / guardería de día), su validación,
 * la dirección, los perfiles sociales no admitidos y la rehidratación de fichas
 * antiguas a las que les faltan campos.
 */
describe('ComercioListadoFormComponent — modalidades de alojamiento y fichas incompletas', () => {
  let fixture: ComponentFixture<ComercioListadoFormComponent>;
  let componente: ComercioListadoFormComponent;
  let api: ApiDoble;
  let geo: GeoDoble;

  const crear = async (id: string | null = null, servicio?: Record<string, unknown>): Promise<void> => {
    localStorage.clear();
    geo = { direccionDePunto: jest.fn().mockResolvedValue(null) } as GeoDoble;
    api = {
      obtenerServicioGestion: jest.fn().mockReturnValue(of(servicio ?? {})),
      crearServicio: jest.fn().mockReturnValue(of({ _id: 'nuevo' })),
      actualizarServicio: jest.fn().mockReturnValue(of({ _id: id })),
    } as unknown as ApiDoble;

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

    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ComercioListadoFormComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const rellenarBase = (vertical: VerticalKey, precioBase = 45): void => {
    componente.form.patchValue({
      vertical,
      titulo: 'Residencia Royal',
      descripcion: 'Alojamiento canino con jardín y cámaras.',
      ciudad: 'Madrid',
      precioBase,
    });
  };

  const guarderia = (): FormGroup =>
    componente.form.get(['alojamiento', 'guarderia']) as FormGroup;

  /** Deja la ficha como una guardería de día pura, con todo lo necesario para publicar. */
  const soloGuarderiaLista = (): void => {
    rellenarBase(VerticalKey.ALOJAMIENTO);
    componente.alternarModalidad(ModalidadAlojamiento.GUARDERIA);
    componente.alternarModalidad(ModalidadAlojamiento.RESIDENCIA);
    componente.form.patchValue({ imagenes: FOTOS });
    guarderia().patchValue({ precioDiaCompleto: 25, plazasPorDia: 8 });
  };

  const payload = (): ServicioPayload =>
    (api.crearServicio.mock.calls.at(-1)?.[0] ?? api.actualizarServicio.mock.calls.at(-1)?.[1]) as ServicioPayload;

  afterEach(() => jest.clearAllMocks());

  describe('selección de modalidades', () => {
    it('debería arrancar sólo con residencia y permitir añadir y quitar la guardería', async () => {
      await crear();
      expect(componente.modalidadesForm()).toEqual([ModalidadAlojamiento.RESIDENCIA]);

      componente.alternarModalidad(ModalidadAlojamiento.GUARDERIA);
      expect(componente.ofreceGuarderiaForm()).toBe(true);
      expect(componente.ofreceResidenciaForm()).toBe(true);

      componente.alternarModalidad(ModalidadAlojamiento.GUARDERIA);
      expect(componente.ofreceGuarderiaForm()).toBe(false);
    });

    it('debería limpiar el error al cambiar de modalidad', async () => {
      await crear();
      componente.errorMsg.set('Elige al menos una modalidad');

      componente.alternarModalidad(ModalidadAlojamiento.GUARDERIA);

      expect(componente.errorMsg()).toBe('');
    });

    it('debería tratar una lista de modalidades nula como ninguna', async () => {
      await crear();
      componente.form.get(['alojamiento', 'modalidades'])?.setValue(null);

      expect(componente.modalidadesForm()).toEqual([]);
    });

    it('debería dejar de pedir fotos por unidad en una guardería sin residencia', async () => {
      // Una guardería de día no tiene suites que fotografiar: sus fotos van en la galería.
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      expect(componente.fotosPorUnidad()).toBe(true);

      componente.alternarModalidad(ModalidadAlojamiento.GUARDERIA);
      componente.alternarModalidad(ModalidadAlojamiento.RESIDENCIA);

      expect(componente.fotosPorUnidad()).toBe(false);
    });
  });

  describe('días de apertura de la guardería', () => {
    it('debería abrir de lunes a viernes por defecto', async () => {
      await crear();

      expect(componente.abreGuarderia(1)).toBe(true);
      expect(componente.abreGuarderia(6)).toBe(false);
    });

    it('debería marcar y desmarcar un día manteniendo el orden', async () => {
      await crear();

      componente.alternarDiaGuarderia(6);
      expect(guarderia().get('diasSemana')?.value).toEqual([1, 2, 3, 4, 5, 6]);

      componente.alternarDiaGuarderia(1);
      expect(guarderia().get('diasSemana')?.value).toEqual([2, 3, 4, 5, 6]);
    });

    it('debería empezar desde cero si los días vienen vacíos (null)', async () => {
      await crear();
      guarderia().get('diasSemana')?.setValue(null);

      expect(componente.abreGuarderia(1)).toBe(false);
      componente.alternarDiaGuarderia(3);

      expect(guarderia().get('diasSemana')?.value).toEqual([3]);
    });
  });

  describe('validación de la guardería al guardar', () => {
    it('debería exigir al menos una modalidad', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.alternarModalidad(ModalidadAlojamiento.RESIDENCIA);

      await componente.submit();

      expect(componente.errorMsg()).toContain('al menos una modalidad');
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería exigir plazas por día', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ plazasPorDia: 0 });

      await componente.submit();

      expect(componente.errorMsg()).toContain('cuántos perros admites cada día');
    });

    it('debería tratar unas plazas no numéricas como cero', async () => {
      // Un input de texto puede devolver basura: no debe colarse como «NaN plazas».
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ plazasPorDia: 'muchas' });

      await componente.submit();

      expect(componente.errorMsg()).toContain('cuántos perros admites cada día');
    });

    it('debería exigir precio en alguno de los tramos', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ precioDiaCompleto: 0 });

      await componente.submit();

      expect(componente.errorMsg()).toContain('Pon precio al menos a una modalidad de guardería');
    });

    it('debería exigir al menos un día de apertura', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ diasSemana: [] });

      await componente.submit();

      expect(componente.errorMsg()).toContain('al menos un día de apertura');
    });

    it('debería exigir días de apertura aunque el control llegue a null', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().get('diasSemana')?.setValue(null);

      await componente.submit();

      expect(componente.errorMsg()).toContain('al menos un día de apertura');
    });

    it('debería rechazar un cierre igual o anterior a la apertura', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ apertura: '18:00', cierre: '09:00' });

      await componente.submit();

      expect(componente.errorMsg()).toContain('cierre de la guardería tiene que ser posterior');
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería admitir una guardería sin horario declarado', async () => {
      // Sin horas no hay nada que comparar: no es un error, es «consultar».
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ apertura: '', cierre: '' });

      await componente.submit();

      expect(api.crearServicio).toHaveBeenCalled();
      const extra = payload().extra as Record<string, Record<string, unknown>>;
      expect(extra['guarderia']['apertura']).toBeUndefined();
      expect(extra['guarderia']['cierre']).toBeUndefined();
    });

    it('debería guardar sólo la apertura cuando falta el cierre', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ apertura: '08:00', cierre: '' });

      await componente.submit();

      const extra = payload().extra as Record<string, Record<string, unknown>>;
      expect(extra['guarderia']).toMatchObject({ apertura: '08:00' });
      expect(extra['guarderia']['cierre']).toBeUndefined();
    });

    it('debería guardar una guardería válida con números de verdad y días vacíos si faltan', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ precioHora: '6', precioMediaJornada: '', plazasPorDia: '7.6' });

      await componente.submit();

      const extra = payload().extra as Record<string, unknown>;
      expect(extra['modalidades']).toEqual([ModalidadAlojamiento.GUARDERIA]);
      expect(extra['guarderia']).toMatchObject({
        precioHora: 6, precioMediaJornada: 0, precioDiaCompleto: 25, plazasPorDia: 8,
        apertura: '08:00', cierre: '19:00', diasSemana: [1, 2, 3, 4, 5],
      });
    });

    it('no debería enviar la configuración de guardería si sólo hay residencia', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.agregarEspacio();
      componente.espacios.at(0).patchValue({ imagenes: FOTOS });

      await componente.submit();

      const extra = payload().extra as Record<string, unknown>;
      expect(extra['modalidades']).toEqual([ModalidadAlojamiento.RESIDENCIA]);
      expect(extra['guarderia']).toBeUndefined();
    });
  });

  describe('precio «desde»', () => {
    it('debería usar el precio base mientras haya residencia', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO, 40);
      componente.alternarModalidad(ModalidadAlojamiento.GUARDERIA);
      guarderia().patchValue({ precioHora: 5 });

      expect(componente.precioDesdeRepaso()).toBe(40);
    });

    it('debería usar el tramo más barato de la guardería si no hay residencia', async () => {
      // Sin noches que cobrar, el «desde» orientativo no coincidiría con lo que se paga.
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ precioMediaJornada: 15 });

      expect(componente.precioDesdeRepaso()).toBe(15);

      await componente.submit();
      expect(payload().precioBase).toBe(15);
    });

    it('debería volver al precio base si la guardería no tiene ningún precio', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ precioDiaCompleto: 0 });

      expect(componente.precioDesdeRepaso()).toBe(45);
    });

    it('debería devolver cero con un precio base vacío fuera de alojamiento', async () => {
      await crear();
      rellenarBase(VerticalKey.PELUQUERIA);
      componente.form.controls.precioBase.setValue(null as unknown as number);

      expect(componente.precioDesdeRepaso()).toBe(0);
    });
  });

  describe('paso a paso', () => {
    it('no debería salir del paso de categoría sin ninguna modalidad marcada', async () => {
      await crear();
      rellenarBase(VerticalKey.ALOJAMIENTO);
      componente.alternarModalidad(ModalidadAlojamiento.RESIDENCIA);

      componente.siguientePaso();

      expect(componente.paso()).toBe('categoria');
      expect(componente.errorMsg()).toContain('al menos una modalidad');
    });

    it('debería frenar en detalles si la guardería no tiene plazas', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ plazasPorDia: 0 });
      componente.paso.set('detalles');

      componente.siguientePaso();

      expect(componente.paso()).toBe('detalles');
      expect(componente.errorMsg()).toContain('cuántos perros');
    });

    it('debería frenar en detalles si el grupo del vertical es inválido', async () => {
      await crear();
      soloGuarderiaLista();
      guarderia().patchValue({ precioHora: -5 });
      componente.paso.set('detalles');

      componente.siguientePaso();

      expect(componente.paso()).toBe('detalles');
      expect(guarderia().get('precioHora')?.touched).toBe(true);
    });

    it('debería dar el texto del botón final según alta guiada o alta suelta', async () => {
      await crear();
      expect(componente.textoBotonFinal()).toBe('Crear servicio');

      fixture.componentRef.setInput('modoAlta', true);
      expect(componente.textoBotonFinal()).toBe('Guardar y continuar');
    });

    it('no debería avanzar más allá del último paso', async () => {
      await crear();
      soloGuarderiaLista();
      const ultimo = componente.pasos[componente.pasos.length - 1].clave;
      componente.paso.set(ultimo);

      componente.siguientePaso();

      expect(componente.paso()).toBe(ultimo);
    });
  });

  describe('dirección: calle y número', () => {
    it('debería rechazar una calle que sea sólo un número', async () => {
      await crear();
      componente.form.patchValue({ calle: '12' });

      expect(componente.form.controls.calle.hasError('calle')).toBe(true);
    });

    it('debería aceptar una calle real y dejarla vacía sin error', async () => {
      await crear();
      componente.form.patchValue({ calle: 'Calle Mayor' });
      expect(componente.form.controls.calle.valid).toBe(true);

      componente.form.patchValue({ calle: '' });
      expect(componente.form.controls.calle.valid).toBe(true);
    });

    it('debería rechazar un número de portal sin sentido y no guardar', async () => {
      await crear();
      soloGuarderiaLista();
      componente.form.patchValue({ calle: 'Calle Mayor', numero: '#24' });

      await componente.submit();

      expect(componente.form.controls.numero.hasError('numero')).toBe(true);
      expect(api.crearServicio).not.toHaveBeenCalled();
    });

    it('debería conservar lo escrito cuando el geocodificador no devuelve un campo', async () => {
      // «2ºB» que Google no conoce: mejor lo del comercio que dejarlo vacío.
      await crear();
      componente.form.patchValue({
        calle: 'Calle Mayor', numero: '24', ciudad: 'Madrid',
        provincia: 'Madrid', codigoPostal: '28013', pais: 'España',
      });
      const vacia: DireccionLugar = {
        calle: '', numero: '', ciudad: '', provincia: '', codigoPostal: '', pais: '',
        formateada: '', lat: 40.4, lng: -3.7,
      } as DireccionLugar;
      geo.direccionDePunto.mockResolvedValue(vacia);

      await componente.moverPin({ lat: 40.4, lng: -3.7 });

      expect(componente.form.getRawValue()).toMatchObject({
        calle: 'Calle Mayor', numero: '24', ciudad: 'Madrid',
        provincia: 'Madrid', codigoPostal: '28013', pais: 'España',
      });
    });
  });

  describe('perfiles sociales no admitidos', () => {
    it('debería marcar y desmarcar un perfil y guardarlo en el campo nuevo', async () => {
      await crear();
      soloGuarderiaLista();
      const [primero, segundo] = componente.compatibilidadesSociales.map((p) => p.valor);

      componente.togglePerfilNoAdmitido(primero);
      componente.togglePerfilNoAdmitido(segundo);
      componente.togglePerfilNoAdmitido(segundo);

      expect(componente.perfilNoAdmitido(primero)).toBe(true);
      expect(componente.perfilNoAdmitido(segundo)).toBe(false);

      await componente.submit();

      const extra = payload().extra as Record<string, unknown>;
      expect(extra['compatibilidadSocialNoAdmitida']).toEqual([primero]);
      // El campo antiguo se vacía para que nadie lo lea como «admitidos».
      expect(extra['compatibilidadSocialAdmitida']).toEqual([]);
    });
  });

  describe('precarga de un alojamiento al editar', () => {
    it('debería cargar la guardería y completar los días si la ficha no los trae', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Guardería Sol', descripcion: 'Guardería de día',
        ciudad: 'Madrid', precioBase: 20, imagenes: FOTOS,
        extra: {
          modalidades: [ModalidadAlojamiento.GUARDERIA],
          guarderia: { plazasPorDia: 12, precioHora: 4 },
        },
      });

      expect(componente.ofreceGuarderiaForm()).toBe(true);
      expect(componente.ofreceResidenciaForm()).toBe(false);
      expect(guarderia().get('plazasPorDia')?.value).toBe(12);
      expect(guarderia().get('diasSemana')?.value).toEqual([1, 2, 3, 4, 5]);
    });

    it('debería respetar los días declarados de la guardería', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Guardería Sol', descripcion: 'Guardería de día',
        ciudad: 'Madrid', precioBase: 20,
        extra: {
          modalidades: [ModalidadAlojamiento.RESIDENCIA, ModalidadAlojamiento.GUARDERIA],
          guarderia: { plazasPorDia: 6, precioDiaCompleto: 22, diasSemana: [6, 7] },
        },
      });

      expect(componente.abreGuarderia(6)).toBe(true);
      expect(componente.abreGuarderia(1)).toBe(false);
    });

    it('debería tratar como residencia una ficha antigua sin modalidades', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Villa Perruna', descripcion: 'Casa con jardín',
        ciudad: 'Madrid', precioBase: 40,
        extra: { modalidades: [] },
      });

      expect(componente.modalidadesForm()).toEqual([ModalidadAlojamiento.RESIDENCIA]);
    });

    it('debería cargar los perfiles no admitidos y conservar la aptitud sin tipos de pelo', async () => {
      await crear('s1', {
        vertical: VerticalKey.ALOJAMIENTO, titulo: 'Villa Perruna', descripcion: 'Casa con jardín',
        ciudad: 'Madrid', precioBase: 40,
        aptitud: {},
        extra: { compatibilidadSocialNoAdmitida: ['individual'] },
      });
      componente.agregarEspacio();
      componente.espacios.at(0).patchValue({ imagenes: FOTOS });

      expect(componente.perfilNoAdmitido('individual')).toBe(true);

      await componente.submit();

      expect(payload().aptitud).toEqual({
        tamanosAdmitidos: [], tipoPeloAdmitido: [], temperamentosNoAdmitidos: [],
      });
    });
  });

  describe('precarga de transporte con tarifas antiguas incompletas', () => {
    /**
     * Fichas de versiones anteriores pueden traer las listas del alta guiada a
     * medias. Al editarlas no deben perderse ni quedar con huecos `undefined`
     * que luego el motor de tarifas lea como precio.
     */
    it('debería rellenar con valores por defecto las reglas, suplementos, requisitos y salidas vacías', async () => {
      await crear('t1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'Traslados Rex', descripcion: 'Transporte de mascotas',
        ciudad: 'Madrid', precioBase: 30,
        extra: {
          reglasTarifa: [{ tramos: [{}] }],
          suplementos: [{}],
          requisitosDocumentales: [{}],
          salidas: [{}],
        },
      });
      const transporte = componente.form.get('transporte') as FormGroup;

      const regla = (transporte.get('reglasTarifa') as FormArray).at(0).getRawValue() as Record<string, unknown>;
      expect(regla).toMatchObject({
        nombre: 'Tarifa', modelo: 'base_mas_km', unidadCobro: 'vehiculo', zonas: [],
        precioIda: 0, precioIdaVuelta: null, mascotasIncluidas: 1, precioKm: 0,
        tarifaSalida: 0, precioHora: 0, duracionMinimaHoras: 1, fraccionMinutos: 15,
        rutaOrigen: '', rutaDestino: '', precioRuta: 0, importeMinimo: 0,
        tramos: [{ desdeKm: 0, hastaKm: null, precioKm: 0 }],
      });
      expect(String(regla['id'])).toMatch(/^r-/);

      expect((transporte.get('suplementos') as FormArray).at(0).getRawValue()).toEqual({
        clave: '', nombre: '', condicion: 'siempre', forma: 'importe_fijo', importe: 0, aplicacion: 'automatica',
      });
      expect((transporte.get('requisitosDocumentales') as FormArray).at(0).getRawValue())
        .toEqual({ clave: '', exigencia: 'siempre' });
      const salida = (transporte.get('salidas') as FormArray).at(0).getRawValue() as Record<string, unknown>;
      expect(salida).toMatchObject({
        fechaSalida: '', paradas: [], plazasTotales: 6, plazasOcupadas: 0, cierreHoras: 24,
      });
      expect(String(salida['id'])).toMatch(/^s-/);
    });

    it('debería guardar como números las reglas aunque falten valores', async () => {
      await crear('t1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'Traslados Rex', descripcion: 'Transporte de mascotas',
        ciudad: 'Madrid', precioBase: 30, imagenes: FOTOS,
        extra: { reglasTarifa: [{ id: 'r1', precioIdaVuelta: 50, tramos: [{ desdeKm: 0, hastaKm: 20, precioKm: 1 }] }] },
      });
      const regla = ((componente.form.get('transporte') as FormGroup).get('reglasTarifa') as FormArray)
        .at(0) as FormGroup;
      // Un campo borrado del todo en el formulario llega como null.
      regla.patchValue({
        precioIda: null, mascotasIncluidas: null, precioKm: null, tarifaSalida: null, precioHora: null,
        duracionMinimaHoras: null, fraccionMinutos: null, precioRuta: null, importeMinimo: null,
        precioIdaVuelta: '',
      });
      (regla.get('tramos') as FormArray).at(0).patchValue({ desdeKm: null, hastaKm: '', precioKm: null });

      await componente.submit();

      const reglas = (payload().extra as Record<string, unknown>)['reglasTarifa'] as Record<string, unknown>[];
      expect(reglas[0]).toMatchObject({
        precioIda: 0, precioIdaVuelta: undefined, mascotasIncluidas: 1, precioKm: 0, tarifaSalida: 0,
        precioHora: 0, duracionMinimaHoras: 1, fraccionMinutos: 15, precioRuta: 0, importeMinimo: 0,
        tramos: [{ desdeKm: 0, hastaKm: null, precioKm: 0 }],
      });
    });

    it('debería convertir a número el precio de ida y vuelta y los tramos escritos como texto', async () => {
      await crear('t1', {
        vertical: VerticalKey.TRANSPORTE, titulo: 'Traslados Rex', descripcion: 'Transporte de mascotas',
        ciudad: 'Madrid', precioBase: 30, imagenes: FOTOS,
        extra: { reglasTarifa: [{ id: 'r1', tramos: [{ desdeKm: 0, hastaKm: 20, precioKm: 1 }] }] },
      });
      const regla = ((componente.form.get('transporte') as FormGroup).get('reglasTarifa') as FormArray)
        .at(0) as FormGroup;
      regla.patchValue({ precioIdaVuelta: '55' });
      (regla.get('tramos') as FormArray).at(0).patchValue({ hastaKm: '20' });

      await componente.submit();

      const reglas = (payload().extra as Record<string, unknown>)['reglasTarifa'] as Record<string, unknown>[];
      expect(reglas[0]).toMatchObject({
        precioIdaVuelta: 55, tramos: [{ desdeKm: 0, hastaKm: 20, precioKm: 1 }],
      });
    });
  });

  describe('borrador mínimo en el dispositivo', () => {
    it('debería abrir el último paso si el borrador trae un paso que ya no existe', async () => {
      await crear();
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ paso: 'paso-retirado' }));

      fixture.destroy();
      fixture = TestBed.createComponent(ComercioListadoFormComponent);
      componente = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(componente.paso()).toBe(componente.pasos[componente.pasos.length - 1].clave);
      expect(componente.borradorRestaurado()).toBe(true);
    });
  });
});
