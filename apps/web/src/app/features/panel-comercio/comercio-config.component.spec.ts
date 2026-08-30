import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { VerticalKey } from 'shared';
import { ComercioConfigComponent } from './comercio-config.component';
import { ComercioApiService, MiComercio } from './comercio-api.service';

const miComercio = (extra: Partial<MiComercio> = {}): MiComercio => ({
  _id: 'c1', nombreComercial: 'Canes', razonSocial: 'Canes SL', vatNumber: 'ESB12345678',
  verticales: [VerticalKey.ALOJAMIENTO], plan: 'basico', estado: 'activo',
  ...extra,
} as MiComercio);

describe('ComercioConfigComponent', () => {
  let fixture: ComponentFixture<ComercioConfigComponent>;
  let componente: ComercioConfigComponent;
  let api: Record<string, jest.Mock>;

  const crear = async (datos: MiComercio | Error = miComercio()): Promise<void> => {
    api = {
      getMiComercio: jest.fn().mockReturnValue(
        datos instanceof Error ? throwError(() => datos) : of(datos),
      ),
      actualizarComercio: jest.fn().mockReturnValue(of(miComercio({ nombreComercial: 'Canes Premium' }))),
      getMisServicios: jest.fn().mockReturnValue(of([{ _id: 's1' }, { _id: 's2' }])),
    };

    await TestBed.configureTestingModule({
      imports: [ComercioConfigComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: api },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioConfigComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const ultimoPayload = () => api['actualizarComercio'].mock.calls.at(-1)![0];

  afterEach(() => jest.clearAllMocks());

  describe('datos fiscales', () => {
    it('debería cargar el CIF guardado en el formulario del perfil', async () => {
      await crear(miComercio({ razonSocial: 'Canes SL', vatNumber: 'ESB12345678' }));

      expect(componente.infoForm.value.vatNumber).toBe('ESB12345678');
      expect(componente.infoForm.value.razonSocial).toBe('Canes SL');
    });

    it('debería normalizar el CIF y omitirlo cuando está vacío', async () => {
      await crear();
      componente.infoForm.patchValue({ vatNumber: '  b12345678 ', razonSocial: '   ' });

      await componente.guardarInfo();

      expect(ultimoPayload()).toMatchObject({ vatNumber: 'B12345678', razonSocial: undefined });
    });

    it('debería pedir los datos fiscales cuando faltan', async () => {
      await crear(miComercio({ vatNumber: '' }));

      expect(componente.faltantes().some((f) => f.label.includes('Datos fiscales'))).toBe(true);
    });

    it('debería dar los datos fiscales por hechos cuando hay CIF', async () => {
      // El panel daba el perfil al 100% sin CIF mientras el escritorio lo seguía
      // pidiendo: los dos contaban cosas distintas del mismo comercio.
      await crear(miComercio({ vatNumber: 'ESB12345678' }));

      expect(componente.faltantes().some((f) => f.label.includes('Datos fiscales'))).toBe(false);
    });
  });

  describe('servicios que ofreces', () => {
    it('debería partir de las categorías que ya tiene el comercio', async () => {
      await crear(miComercio({ verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA] }));

      expect(componente.verticalesSel()).toEqual([VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA]);
      expect(componente.tieneVertical(VerticalKey.ALOJAMIENTO)).toBe(true);
      expect(componente.tieneVertical(VerticalKey.VETERINARIA)).toBe(false);
    });

    it('debería añadir y quitar categorías al pulsarlas', async () => {
      await crear();

      componente.alternarVertical(VerticalKey.VETERINARIA);
      expect(componente.verticalesSel()).toEqual([VerticalKey.ALOJAMIENTO, VerticalKey.VETERINARIA]);

      componente.alternarVertical(VerticalKey.ALOJAMIENTO);
      expect(componente.verticalesSel()).toEqual([VerticalKey.VETERINARIA]);
    });

    it('debería avisar de que hay cambios sin guardar al tocar una categoría', async () => {
      await crear();

      componente.alternarVertical(VerticalKey.TRANSPORTE);

      expect(componente.hayCambiosSinGuardar()).toBe(true);
    });

    it('debería guardar sólo las categorías y limpiar el aviso', async () => {
      await crear();
      componente.alternarVertical(VerticalKey.PELUQUERIA);

      await expect(componente.guardarVerticales()).resolves.toBe(true);

      expect(ultimoPayload()).toEqual({
        verticales: [VerticalKey.ALOJAMIENTO, VerticalKey.PELUQUERIA],
      });
      expect(componente.hayCambiosSinGuardar()).toBe(false);
    });

    it('no debería guardar si el comercio se queda sin ninguna categoría', async () => {
      await crear();
      componente.alternarVertical(VerticalKey.ALOJAMIENTO);

      await expect(componente.guardarVerticales()).resolves.toBe(false);

      expect(api['actualizarComercio']).not.toHaveBeenCalled();
    });

    it('debería contar como paso completado en el progreso del perfil', async () => {
      await crear();

      // Antes devolvía null: el índice lo pintaba sin estado y no sumaba nunca.
      expect(componente.estadoSeccion('verticales')).toBe(true);
    });

    it('debería marcarse como pendiente si el comercio no tiene categorías', async () => {
      await crear(miComercio({ verticales: [] }));

      expect(componente.estadoSeccion('verticales')).toBe(false);
      expect(componente.faltantes().some((f) => f.tab === 'verticales')).toBe(true);
    });
  });

  describe('carga del perfil', () => {
    it('debería repartir los datos entre los formularios de cada sección', async () => {
      await crear(miComercio({
        descripcion: 'Residencia con jardín',
        contacto: { nombreContacto: 'Ana', email: 'ana@canes.com', telefono: '600000000', whatsapp: '' },
      } as Partial<MiComercio>));

      expect(componente.infoForm.getRawValue().descripcion).toBe('Residencia con jardín');
      expect(componente.contactoForm.getRawValue().email).toBe('ana@canes.com');
    });

    it('debería quedarse con los formularios vacíos si el perfil no carga', async () => {
      await crear(new Error('500'));

      expect(componente.comercio()).toBeNull();
      expect(componente.infoForm.getRawValue().nombreComercial).toBe('');
    });

    it('debería respetar las preferencias de notificación guardadas', async () => {
      await crear(miComercio({
        preferenciasNotificacion: { nuevaReserva: false, cancelacion: true, resena: true, pagos: false },
      } as Partial<MiComercio>));

      expect(componente.notifState()['nuevaReserva']).toBe(false);
      expect(componente.notifState()['resena']).toBe(true);
    });
  });

  describe('guardado por secciones', () => {
    it('debería enviar solo la información del negocio', async () => {
      await crear();
      componente.infoForm.patchValue({ nombreComercial: 'Canes Premium', descripcion: 'Guardería con jardín' });

      await componente.guardarInfo();

      expect(ultimoPayload()).toMatchObject({ nombreComercial: 'Canes Premium', descripcion: 'Guardería con jardín' });
      expect(componente.guardado()).toBe(true);
      expect(componente.guardandoInfo()).toBe(false);
    });

    it('no debería guardar la información sin nombre comercial', async () => {
      await crear();
      componente.infoForm.patchValue({ nombreComercial: '' });

      await componente.guardarInfo();

      expect(api['actualizarComercio']).not.toHaveBeenCalled();
      expect(componente.infoForm.touched).toBe(true);
    });

    it('no debería guardar un contacto con email inválido', async () => {
      await crear();
      componente.contactoForm.patchValue({ email: 'no-es-un-email' });

      await componente.guardarContacto();

      expect(api['actualizarComercio']).not.toHaveBeenCalled();
    });

    it('debería guardar el contacto válido', async () => {
      await crear();
      componente.contactoForm.patchValue({ email: 'ana@canes.com', telefono: '600000000' });

      await componente.guardarContacto();

      expect(ultimoPayload().contacto).toMatchObject({ email: 'ana@canes.com' });
    });

    it('debería guardar los datos bancarios', async () => {
      await crear();
      componente.datosBancariosForm.patchValue({ iban: 'ES7620770024003102575766' });

      await componente.guardarDatosBancarios();

      expect(ultimoPayload().datosBancarios)
        .toEqual(expect.objectContaining({ iban: 'ES7620770024003102575766' }));
    });

    it('debería avisar del fallo sin dejar el botón bloqueado', async () => {
      await crear();
      componente.contactoForm.patchValue({ email: 'hola@canes.com' });
      api['actualizarComercio'].mockReturnValue(throwError(() => new Error('500')));

      await componente.guardarContacto();

      expect(componente.errorMsg()).toContain('Error al guardar');
      expect(componente.guardandoContacto()).toBe(false);
      expect(componente.guardado()).toBe(false);
    });

    it('debería refrescar el comercio con la respuesta del servidor', async () => {
      await crear();
      componente.contactoForm.patchValue({ email: 'hola@canes.com' });

      await componente.guardarContacto();

      expect(componente.comercio()?.nombreComercial).toBe('Canes Premium');
    });
  });

  describe('notificaciones', () => {
    it('debería invertir la preferencia y guardarla al momento', async () => {
      await crear();
      const antes = componente.notifState()['resena'];

      componente.toggleNotif('resena');

      expect(componente.notifState()['resena']).toBe(!antes);
      expect(api['actualizarComercio']).toHaveBeenCalled();
    });

    it('debería enviar el mapa completo de preferencias', async () => {
      await crear();

      componente.toggleNotif('pagos');

      expect(ultimoPayload().preferenciasNotificacion).toMatchObject({ pagos: false, nuevaReserva: true });
    });
  });

  describe('datos del comercio', () => {
    it('debería traducir los verticales del comercio', async () => {
      await crear();

      expect(componente.labelVertical(VerticalKey.ALOJAMIENTO)).not.toBe(VerticalKey.ALOJAMIENTO);
      expect(componente.labelVertical('inventado')).toBe('inventado');
    });
  });
  describe('avisos de cambios sin guardar', () => {
    it('no deberia avisar mientras no se toque nada', async () => {
      await crear();

      expect(componente.hayCambiosSinGuardar()).toBe(false);
    });

    it('deberia avisar al ensuciar el formulario de la pestana activa', async () => {
      await crear();

      componente.infoForm.markAsDirty();
      componente.cambiarTab('perfil');

      expect(componente.hayCambiosSinGuardar()).toBe(true);
    });

    it('no deberia avisar si lo sucio es otra pestana', async () => {
      // El aviso tiene que referirse a lo que el comercio esta viendo.
      await crear();
      componente.infoForm.markAsDirty();

      componente.cambiarTab('contacto');

      expect(componente.hayCambiosSinGuardar()).toBe(false);
    });

    it('deberia seguir cada pestana con su propio formulario', async () => {
      await crear();

      for (const tab of ['ubicacion', 'contacto', 'horarios', 'politicas', 'verificacion'] as const) {
        componente.cambiarTab(tab);
        expect(componente.hayCambiosSinGuardar()).toBe(false);
      }
    });
  });

  describe('etiquetas', () => {
    it('deberia traducir los verticales conocidos y dejar el resto en crudo', async () => {
      await crear();

      expect(componente.labelVertical('inventado')).toBe('inventado');
      expect(componente.labelVertical(VerticalKey.ALOJAMIENTO)).not.toBe(VerticalKey.ALOJAMIENTO);
    });

  });
  /**
   * Paso a paso con escapatoria: guardar avanza a la sección siguiente, pero las
   * pestañas siguen siendo navegables. Es una pantalla de ajustes a la que se
   * vuelve; obligar a recorrer todos los pasos para cambiar un teléfono sería peor
   * que no guiar nada.
   */
  describe('recorrido paso a paso', () => {
    beforeAll(() => {
      // jsdom no implementa el scroll suave que dispara cada cambio de paso.
      window.scrollTo = jest.fn();
    });

    it('debería empezar en el primer paso', async () => {
      await crear();

      expect(componente.pasoActual()).toBe(1);
      expect(componente.esPrimerPaso()).toBe(true);
      expect(componente.esUltimoPaso()).toBe(false);
    });

    it('debería avanzar al paso siguiente cuando el guardado funciona', async () => {
      await crear();

      await componente.continuar(componente.guardarInfo());

      expect(componente.pasoActual()).toBe(2);
      expect(componente.tab()).toBe('contacto');
    });

    it('NO debería avanzar si el guardado falla', async () => {
      // Avanzar sobre un error escondería el mensaje y el comercio creería que
      // sus datos están puestos cuando no lo están.
      await crear();
      api['actualizarComercio'].mockReturnValue(throwError(() => new Error('500')));

      await componente.continuar(componente.guardarInfo());

      expect(componente.pasoActual()).toBe(1);
      expect(componente.errorMsg()).toContain('Error al guardar');
    });

    it('NO debería avanzar si el formulario es inválido', async () => {
      await crear();
      componente.infoForm.patchValue({ nombreComercial: '' });

      await componente.continuar(componente.guardarInfo());

      expect(componente.pasoActual()).toBe(1);
      expect(api['actualizarComercio']).not.toHaveBeenCalled();
    });

    it('debería poder retroceder', async () => {
      await crear();
      componente.cambiarTab('contacto');

      componente.pasoAnterior();

      expect(componente.tab()).toBe('perfil');
    });

    it('no debería retroceder más allá del primero', async () => {
      await crear();

      componente.pasoAnterior();

      expect(componente.pasoActual()).toBe(1);
    });

    it('no debería avanzar más allá del último', async () => {
      await crear();
      componente.cambiarTab('notificaciones');
      expect(componente.esUltimoPaso()).toBe(true);

      await componente.continuar(Promise.resolve(true));

      expect(componente.tab()).toBe('notificaciones');
    });

    it('debería dejar saltar las secciones que no guardan nada', async () => {
      await crear();
      componente.cambiarTab('verificacion');
      const antes = componente.pasoActual();

      await componente.saltarPaso();

      expect(componente.pasoActual()).toBe(antes + 1);
    });

    it('debería seguir permitiendo ir directo a cualquier pestaña', async () => {
      // La escapatoria: quien vuelve sólo a cambiar el IBAN no recorre todos los pasos.
      await crear();

      componente.cambiarTab('politicas');

      expect(componente.tab()).toBe('politicas');
    });

    it('debería subir la vista al cambiar de paso', async () => {
      // Las secciones son largas: sin esto se cambia de paso y el formulario
      // nuevo queda fuera de pantalla.
      await crear();

      componente.cambiarTab('horarios');

      expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });
  });

  describe('fases del recorrido', () => {
    it('debería repartir todos los pasos entre las tres fases, sin perder ninguno', async () => {
      await crear();

      const enFases = componente.fases.flatMap((f) => f.pasos.map((p) => p.clave));

      expect(enFases).toHaveLength(componente.totalPasos);
      expect(new Set(enFases).size).toBe(componente.totalPasos);
    });

    it('debería agrupar las fases en el mismo orden en que se recorren los pasos', async () => {
      // Si divergieran, "Guardar y continuar" saltaría a un paso que el índice
      // pinta en otra fase y el recorrido dejaría de leerse de arriba abajo.
      await crear();

      const enFases = componente.fases.flatMap((f) => f.pasos.map((p) => p.clave));

      expect(enFases).toEqual(componente.tabs.map((t) => t.clave));
    });

    it('debería situar el paso visible en su fase', async () => {
      await crear();
      componente.cambiarTab('datosBancarios');

      expect(componente.faseActual().titulo).toBe('Cómo cobras');
      expect(componente.pasoUi().clave).toBe('datosBancarios');
    });

    it('no debería dar por hecha una fase con un paso pendiente', async () => {
      await crear();

      const tuNegocio = componente.fases[0];
      expect(componente.faseCompleta(tuNegocio)).toBe(false);
    });

    it('debería dar por hecha la fase cuyos pasos no tienen nada pendiente', async () => {
      // Los pasos informativos (notificaciones) no bloquean su fase.
      await crear();

      const confianza = componente.fases[2];
      expect(componente.faseCompleta(confianza)).toBe(true);
    });
  });

  describe('índice plegable', () => {
    it('debería arrancar cerrado, para que lo primero que se vea sea el formulario', async () => {
      await crear();

      expect(componente.indiceAbierto()).toBe(false);
    });

    it('debería cerrarse al elegir un paso', async () => {
      await crear();
      componente.indiceAbierto.set(true);

      componente.cambiarTab('politicas');

      expect(componente.indiceAbierto()).toBe(false);
    });
  });

  describe('estado de cada sección', () => {
    it('debería marcar como completa la sección con todos sus campos puestos', async () => {
      await crear(miComercio({
        contacto: { nombreContacto: 'Ana', email: 'ana@canes.com', telefono: '600000000', whatsapp: '' },
      } as Partial<MiComercio>));

      expect(componente.estadoSeccion('contacto')).toBe(true);
    });

    it('debería marcar como incompleta la sección a la que le falta algo', async () => {
      await crear();

      expect(componente.estadoSeccion('contacto')).toBe(false);
    });

    it('no debería opinar de las secciones sin campos obligatorios', async () => {
      // Notificaciones o plan no se marcan ni como hechas ni como pendientes.
      await crear();

      expect(componente.estadoSeccion('notificaciones')).toBeNull();
      expect(componente.estadoSeccion('plan')).toBeNull();
    });

    it('no debería contradecir al porcentaje de la cabecera', async () => {
      // Ambos salen de `camposPerfil`: si divergieran, la pestaña diría "hecho"
      // sobre algo que el aviso cuenta como pendiente.
      await crear();

      const seccionesHechas = componente.tabs
        .filter((t) => componente.estadoSeccion(t.clave) === true);
      const faltantesDeEsasSecciones = componente.faltantes()
        .filter((f) => seccionesHechas.some((t) => t.clave === f.tab));

      expect(faltantesDeEsasSecciones).toEqual([]);
    });
  });
  /**
   * Días especiales con calendario de selección múltiple. Antes era un campo de
   * fecha y un botón: un puente son cuatro días y agosto entero son treinta, y
   * añadirlos de uno en uno con su motivo cada vez era la parte que nadie
   * terminaba.
   */
});
