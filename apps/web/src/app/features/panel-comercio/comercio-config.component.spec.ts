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

  describe('carga del perfil', () => {
    it('debería repartir los datos entre los formularios de cada sección', async () => {
      await crear(miComercio({
        descripcion: 'Residencia con jardín',
        direccion: { calle: 'Gran Vía', numero: '1', ciudad: 'Madrid', provincia: 'Madrid', codigoPostal: '28013', pais: 'España' },
        contacto: { nombreContacto: 'Ana', email: 'ana@canes.com', telefono: '600000000', whatsapp: '' },
        sitioWeb: 'https://canes.com',
        redesSociales: { instagram: '@canes' },
      } as Partial<MiComercio>));

      expect(componente.infoForm.getRawValue().descripcion).toBe('Residencia con jardín');
      expect(componente.direccionForm.getRawValue().ciudad).toBe('Madrid');
      expect(componente.contactoForm.getRawValue().email).toBe('ana@canes.com');
      expect(componente.redesForm.getRawValue().instagram).toBe('@canes');
    });

    it('debería quedarse con los formularios vacíos si el perfil no carga', async () => {
      await crear(new Error('500'));

      expect(componente.comercio()).toBeNull();
      expect(componente.infoForm.getRawValue().nombreComercial).toBe('');
    });

    it('debería asumir España cuando no hay país guardado', async () => {
      await crear();

      expect(componente.direccionForm.getRawValue().pais).toBe('España');
    });

    it('debería cargar el logo tal cual, que es lo que espera el componente de subida', async () => {
      // `rs-image-upload` con [multiple]="false" trabaja con la URL suelta;
      // envolverla en un array hacía que al guardar se enviara sólo su primera letra.
      await crear(miComercio({ logoUrl: '/logo.png' }));

      expect(componente.infoForm.getRawValue().logoUrl).toBe('/logo.png');
    });

    it('debería respetar las preferencias de notificación guardadas', async () => {
      await crear(miComercio({
        preferenciasNotificacion: { nuevaReserva: false, cancelacion: true, resena: true, pagos: false },
      } as Partial<MiComercio>));

      expect(componente.notifState()['nuevaReserva']).toBe(false);
      expect(componente.notifState()['resena']).toBe(true);
    });
  });

  describe('horario', () => {
    it('debería crear una fila por día de la semana', async () => {
      await crear();

      expect(componente.diasControls).toHaveLength(componente.dias.length);
    });

    it('debería aplicar el horario guardado a su día', async () => {
      await crear(miComercio({
        horario: [{ dia: 'lunes', abre: '08:00', cierra: '20:00', cerrado: false }],
      } as Partial<MiComercio>));

      const lunes = componente.diasControls.find((c) => c.getRawValue().dia === 'lunes')!;
      expect(lunes.getRawValue()).toMatchObject({ abre: '08:00', cierra: '20:00' });
    });

    it('debería vaciar las horas al marcar un día como cerrado', async () => {
      await crear();
      componente.diasControls[0].patchValue({ cerrado: true });

      componente.onCerradoChange(0);

      // Un día cerrado con horario visible confunde al cliente que consulta la ficha.
      expect(componente.diasControls[0].getRawValue()).toMatchObject({ abre: '', cierra: '' });
    });

    it('debería conservar las horas si el día sigue abierto', async () => {
      await crear();

      componente.onCerradoChange(0);

      expect(componente.diasControls[0].getRawValue().abre).toBe('09:00');
    });

    it('debería guardar el horario completo', async () => {
      await crear();

      await componente.guardarHorario();

      expect(ultimoPayload().horario).toHaveLength(componente.dias.length);
    });
  });

  describe('guardado por secciones', () => {
    it('debería enviar solo la información del negocio', async () => {
      await crear();
      componente.infoForm.patchValue({ nombreComercial: 'Canes Premium', logoUrl: '/logo.png' });

      await componente.guardarInfo();

      expect(ultimoPayload()).toMatchObject({ nombreComercial: 'Canes Premium', logoUrl: '/logo.png' });
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

    it('debería rellenar la dirección y guardar las coordenadas al elegir del desplegable', async () => {
      await crear();

      componente.usarDireccionSugerida({
        placeId: 'p1', ciudad: 'Madrid', lat: 40.4169, lng: -3.7035,
        direccion: {
          calle: 'Calle Mayor', numero: '24', codigoPostal: '28013',
          ciudad: 'Madrid', provincia: 'Madrid', pais: 'España',
          formateada: 'C. Mayor, 24, 28013 Madrid', lat: 40.4169, lng: -3.7035,
        },
      });
      await componente.guardarDireccion();

      expect(ultimoPayload().direccion).toMatchObject({
        calle: 'Calle Mayor', numero: '24', codigoPostal: '28013',
        lat: 40.4169, lng: -3.7035,
      });
      // El mapa se pinta sin esperar a que el servidor devuelva el perfil.
      expect(componente.coordenadas()).toMatchObject({ lat: 40.4169, lng: -3.7035 });
    });

    it('no debería enviar coordenadas vacías al guardar una dirección tecleada a mano', async () => {
      await crear();
      componente.direccionForm.patchValue({ calle: 'Camino del Monte', ciudad: 'Soria' });

      await componente.guardarDireccion();

      expect(ultimoPayload().direccion).not.toHaveProperty('lat');
      expect(ultimoPayload().direccion).toMatchObject({ ciudad: 'Soria' });
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

    it('debería guardar la dirección', async () => {
      await crear();
      componente.direccionForm.patchValue({ ciudad: 'Toledo' });

      await componente.guardarDireccion();

      expect(ultimoPayload().direccion).toMatchObject({ ciudad: 'Toledo' });
    });

    it('debería anidar las redes sociales bajo su propia clave', async () => {
      await crear();
      componente.redesForm.patchValue({ sitioWeb: 'https://canes.com', instagram: '@canes' });

      await componente.guardarRedes();

      expect(ultimoPayload()).toMatchObject({
        sitioWeb: 'https://canes.com',
        redesSociales: { instagram: '@canes' },
      });
    });

    it('debería guardar políticas y datos bancarios juntos', async () => {
      await crear();
      componente.politicasForm.patchValue({ politicaCancelacion: 'flexible', iban: 'ES7620770024003102575766' });

      await componente.guardarPoliticas();

      expect(ultimoPayload()).toMatchObject({
        politicaCancelacion: 'flexible',
        datosBancarios: expect.objectContaining({ iban: 'ES7620770024003102575766' }),
      });
    });

    it('debería omitir la política de cancelación cuando no se ha elegido', async () => {
      await crear();

      await componente.guardarPoliticas();

      expect(ultimoPayload().politicaCancelacion).toBeUndefined();
    });

    it('debería avisar del fallo sin dejar el botón bloqueado', async () => {
      await crear();
      api['actualizarComercio'].mockReturnValue(throwError(() => new Error('500')));

      await componente.guardarDireccion();

      expect(componente.errorMsg()).toContain('Error al guardar');
      expect(componente.guardandoDireccion()).toBe(false);
      expect(componente.guardado()).toBe(false);
    });

    it('debería refrescar el comercio con la respuesta del servidor', async () => {
      await crear();

      await componente.guardarDireccion();

      expect(componente.comercio()?.nombreComercial).toBe('Canes Premium');
    });
  });

  describe('verificación y documentos', () => {
    it('debería enviar la URL de cada documento sin trocearla', async () => {
      await crear();
      componente.verificacionForm.patchValue({
        documentoIdentidadUrl: '/dni.pdf', licenciaNegocioUrl: '/licencia.pdf',
      });

      await componente.guardarVerificacion();

      expect(ultimoPayload()).toMatchObject({
        documentoIdentidadUrl: '/dni.pdf', licenciaNegocioUrl: '/licencia.pdf',
      });
    });

    it('debería añadir un documento adicional y limpiar el formulario', async () => {
      await crear();
      componente.docForm.patchValue({ tipo: 'seguro_rc', url: '/seguro.pdf', fechaCaducidad: '2027-01-01' });

      componente.agregarDoc();

      expect(componente.docsAdicionales()).toHaveLength(1);
      expect(componente.docsAdicionales()[0]).toMatchObject({ url: '/seguro.pdf', estado: 'pendiente' });
      expect(componente.docForm.getRawValue().url).toBe('');
    });

    it('no debería añadir un documento sin url', async () => {
      await crear();
      componente.docForm.patchValue({ tipo: 'seguro_rc', url: '' });

      componente.agregarDoc();

      expect(componente.docsAdicionales()).toHaveLength(0);
    });

    it('debería quitar el documento indicado', async () => {
      await crear();
      componente.docForm.patchValue({ url: '/a.pdf' });
      componente.agregarDoc();
      componente.docForm.patchValue({ url: '/b.pdf' });
      componente.agregarDoc();

      componente.quitarDoc(0);

      expect(componente.docsAdicionales()).toHaveLength(1);
      expect(componente.docsAdicionales()[0].url).toBe('/b.pdf');
    });

    it('debería cargar los documentos ya subidos', async () => {
      await crear(miComercio({
        verificacion: {
          estado: 'pendiente',
          documentos: [{ tipo: 'seguro_rc', url: '/seguro.pdf', estado: 'pendiente' }],
        },
      } as Partial<MiComercio>));

      expect(componente.docsAdicionales()).toHaveLength(1);
    });

    it('debería guardar la lista completa de documentos', async () => {
      await crear();
      componente.docForm.patchValue({ url: '/seguro.pdf' });
      componente.agregarDoc();

      await componente.guardarDocumentacion();

      expect(ultimoPayload().documentos).toHaveLength(1);
    });

    it('debería etiquetar el estado de verificación', async () => {
      await crear(miComercio({ verificacion: { estado: 'verificado' } } as Partial<MiComercio>));

      expect(componente.verificacionBadge()).toBeTruthy();
      expect(componente.verificacionLabel()).toBeTruthy();
    });

    it('debería tratar la ausencia de verificación como "sin verificar"', async () => {
      await crear();

      expect(componente.verificacionLabel()).toBe(componente.verificacionLabel());
      expect(componente.verificacionBadge()).toBeTruthy();
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

  describe('plan contratado', () => {
    it('debería distinguir visualmente cada plan', async () => {
      await crear(miComercio({ plan: 'premium' }));

      expect(componente.planBadgeClass()).toContain('warning');
      expect(componente.planFeatures()).toContain('Soporte prioritario 24/7');
    });

    it('debería describir el plan básico por defecto', async () => {
      await crear();

      expect(componente.planBadgeClass()).toContain('neutral');
      expect(componente.planFeatures()).toContain('Hasta 3 listados');
    });

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

      for (const tab of ['ubicacion', 'contacto', 'redes', 'horarios', 'politicas', 'verificacion'] as const) {
        componente.cambiarTab(tab);
        expect(componente.hayCambiosSinGuardar()).toBe(false);
      }
    });
  });

  describe('punto en el mapa', () => {
    it('no deberia pintar marcador si el negocio no tiene coordenadas', async () => {
      await crear();

      expect(componente.coordenadas()).toBeNull();
      expect(componente.enlaceGoogleMaps()).toBeNull();
    });

    it('deberia pintar el punto guardado', async () => {
      await crear(miComercio({
        direccion: { ciudad: 'Valencia', lat: 39.47, lng: -0.37 },
      } as Partial<MiComercio>));

      expect(componente.coordenadas()).toMatchObject({ lat: 39.47, lng: -0.37 });
      expect(componente.enlaceGoogleMaps()).toContain('39.47');
    });

    it('deberia mover el marcador al elegir direccion, sin esperar a guardar', async () => {
      await crear();

      componente.usarDireccionSugerida({
        direccion: {
          calle: 'Gran Via', numero: '1', codigoPostal: '46001', ciudad: 'Valencia',
          provincia: 'Valencia', pais: 'Espana', formateada: 'Gran Via 1', lat: 39.47, lng: -0.37,
        },
      } as never);

      expect(componente.coordenadas()).toMatchObject({ lat: 39.47, lng: -0.37 });
      expect(componente.direccionForm.getRawValue().ciudad).toBe('Valencia');
      expect(componente.direccionForm.dirty).toBe(true);
    });

    it('no deberia borrar lo que el comercio ya habia escrito', async () => {
      // Google no conoce el "2oB": pisarlo con vacio perderia el dato.
      await crear();
      componente.direccionForm.patchValue({ numero: '2oB' });

      componente.usarDireccionSugerida({
        direccion: {
          calle: 'Gran Via', numero: '', codigoPostal: '46001', ciudad: 'Valencia',
          provincia: 'Valencia', pais: 'Espana', formateada: '', lat: 39.47, lng: -0.37,
        },
      } as never);

      expect(componente.direccionForm.getRawValue().numero).toBe('2oB');
    });

    it('no deberia hacer nada si la sugerencia viene sin direccion', async () => {
      await crear();

      componente.usarDireccionSugerida({} as never);

      expect(componente.direccionForm.dirty).toBe(false);
    });
  });

  describe('plan y limite de listados', () => {
    it('deberia proponer subir de basico a pro', async () => {
      await crear();

      expect(componente.planSiguiente()?.nombre).toBe('pro');
      expect(componente.planBadgeClass()).toContain('neutral');
    });

    it('no deberia proponer nada por encima de premium', async () => {
      await crear(miComercio({ plan: 'premium' }));

      expect(componente.planSiguiente()).toBeNull();
      expect(componente.planBadgeClass()).toContain('warning');
      expect(componente.planFeatures()).toContain('Listados ilimitados');
    });

    it('deberia marcar el plan pro con su propio badge y ventajas', async () => {
      await crear(miComercio({ plan: 'pro' }));

      expect(componente.planBadgeClass()).toContain('accent');
      expect(componente.planFeatures()).toContain('Hasta 20 listados');
    });

    it('deberia calcular el porcentaje de listados usados sobre el tope del plan', async () => {
      await crear();
      componente.serviciosPublicados.set(2);

      // 2 de los 3 del plan basico.
      expect(componente.pctServiciosUsados()).toBe(67);
    });

    it('deberia tapar el porcentaje al 100 aunque se supere el tope', async () => {
      // Un comercio que bajo de plan puede tener mas listados que su tope: la
      // barra no puede pasar del 100 %.
      await crear();
      componente.serviciosPublicados.set(9);

      expect(componente.pctServiciosUsados()).toBe(100);
    });

    it('deberia devolver 0 % si el plan no tiene tope', async () => {
      await crear(miComercio({ plan: 'premium' }));

      expect(componente.pctServiciosUsados()).toBe(0);
    });
  });

  describe('caducidad de la documentacion', () => {
    const enDias = (dias: number): string =>
      new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

    it('no deberia decir nada de un documento sin fecha', async () => {
      await crear();

      expect(componente.estadoCaducidad(undefined)).toBeNull();
      expect(componente.textoCaducidad(undefined)).toBe('');
    });

    it('deberia marcar como caducado lo que ya vencio', async () => {
      await crear();

      expect(componente.estadoCaducidad(enDias(-5))).toBe('caducado');
      expect(componente.textoCaducidad(enDias(-5))).toBe('Caducado');
    });

    it('deberia avisar antes de que caduque, no el dia que caduca', async () => {
      await crear();

      expect(componente.estadoCaducidad(enDias(10))).toBe('pronto');
      expect(componente.textoCaducidad(enDias(10))).toContain('Caduca en');
    });

    it('deberia concordar el singular a un dia vista', async () => {
      await crear();

      expect(componente.textoCaducidad(enDias(1))).toBe('Caduca en 1 día');
    });

    it('deberia dar por vigente lo que queda lejos', async () => {
      await crear();

      expect(componente.estadoCaducidad(enDias(365))).toBe('vigente');
      expect(componente.textoCaducidad(enDias(365))).toContain('Vigente hasta');
    });
  });

  describe('documentos adicionales', () => {
    it('no deberia agregar el documento si el formulario es invalido', async () => {
      await crear();
      const antes = componente.docsAdicionales().length;

      componente.agregarDoc();

      expect(componente.docsAdicionales()).toHaveLength(antes);
    });

    it('deberia agregar el documento como pendiente de revision', async () => {
      await crear();
      componente.docForm.patchValue({ tipo: 'seguro_rc', url: 'https://x/doc.pdf', nombre: 'Seguro' });

      componente.agregarDoc();

      expect(componente.docsAdicionales().at(-1)).toMatchObject({
        tipo: 'seguro_rc', estado: 'pendiente',
      });
    });

    it('deberia quitar el documento de la posicion indicada', async () => {
      await crear();
      componente.docForm.patchValue({ tipo: 'seguro_rc', url: 'https://x/doc.pdf' });
      componente.agregarDoc();

      componente.quitarDoc(0);

      expect(componente.docsAdicionales()).toHaveLength(0);
    });

    it('deberia etiquetar los tipos conocidos y dejar el resto en crudo', async () => {
      await crear();

      expect(componente.tipoDocLabel('seguro_rc')).toBe('Seguro RC');
      expect(componente.tipoDocLabel('inventado')).toBe('inventado');
    });

    it('deberia colorear el badge segun el estado del documento', async () => {
      await crear();

      expect(componente.docBadge('verificado')).toContain('success');
      expect(componente.docBadge('rechazado')).toContain('error');
      expect(componente.docBadge('otro')).toContain('neutral');
    });
  });

  describe('horarios y excepciones', () => {
    it('deberia copiar el horario del lunes al resto de dias', async () => {
      await crear();
      componente.diasControls[0].patchValue({ abre: '08:00', cierra: '20:00', cerrado: false });

      componente.copiarHorarioATodos();

      expect(componente.diasControls[3].getRawValue().abre).toBe('08:00');
      expect(componente.diasControls[6].getRawValue().cierra).toBe('20:00');
    });

    it('no deberia anadir una excepcion sin fecha', async () => {
      await crear();

      componente.anadirExcepcion();

      expect(componente.excepciones()).toHaveLength(0);
    });

    it('deberia anadir un cierre completo sin horario', async () => {
      await crear();
      componente.nuevaExcepcionFecha.set('2026-12-25');
      componente.nuevaExcepcionMotivo.set('Navidad');
      componente.nuevaExcepcionCerrado.set(true);

      componente.anadirExcepcion();

      expect(componente.excepciones()[0]).toMatchObject({
        fecha: '2026-12-25', motivo: 'Navidad', cerrado: true, abre: undefined,
      });
    });

    it('deberia guardar el horario reducido de un dia abierto a medias', async () => {
      await crear();
      componente.nuevaExcepcionFecha.set('2026-12-24');
      componente.nuevaExcepcionCerrado.set(false);
      componente.nuevaExcepcionAbre.set('09:00');
      componente.nuevaExcepcionCierra.set('14:00');

      componente.anadirExcepcion();

      expect(componente.excepciones()[0]).toMatchObject({ abre: '09:00', cierra: '14:00' });
    });

    it('deberia sustituir la excepcion si se repite la fecha, no duplicarla', async () => {
      await crear();
      componente.nuevaExcepcionFecha.set('2026-12-25');
      componente.anadirExcepcion();
      componente.nuevaExcepcionFecha.set('2026-12-25');
      componente.nuevaExcepcionMotivo.set('Corregido');
      componente.anadirExcepcion();

      expect(componente.excepciones()).toHaveLength(1);
      expect(componente.excepciones()[0].motivo).toBe('Corregido');
    });

    it('deberia mantener las excepciones ordenadas por fecha', async () => {
      await crear();
      componente.nuevaExcepcionFecha.set('2026-12-25');
      componente.anadirExcepcion();
      componente.nuevaExcepcionFecha.set('2026-01-06');
      componente.anadirExcepcion();

      expect(componente.excepciones().map((e) => e.fecha)).toEqual(['2026-01-06', '2026-12-25']);
    });
  });

  describe('etiquetas', () => {
    it('deberia traducir los verticales conocidos y dejar el resto en crudo', async () => {
      await crear();

      expect(componente.labelVertical('inventado')).toBe('inventado');
      expect(componente.labelVertical(VerticalKey.ALOJAMIENTO)).not.toBe(VerticalKey.ALOJAMIENTO);
    });

    it('deberia tratar la falta de verificacion como sin verificar', async () => {
      await crear();

      expect(componente.verificacionBadge()).toBeDefined();
    });
  });
  /**
   * `rs-image-upload` con `[multiple]="false"` emite la URL suelta. Al guardar se
   * hacía `arr[0]` sobre ella, y `"https://…"[0]` es `"h"`: eso quedó escrito en
   * la base para el logo, la portada, el DNI y la licencia, y la imagen salía
   * rota al recargar.
   */
  describe('imágenes de una sola URL', () => {
    const CDN = 'https://cdn.doogking.com/logo.jpg';

    it('debería guardar la URL entera del logo, no su primera letra', async () => {
      await crear();
      componente.infoForm.patchValue({ logoUrl: CDN });

      await componente.guardarInfo();

      expect(ultimoPayload().logoUrl).toBe(CDN);
    });

    it('debería guardar la URL entera de la portada', async () => {
      await crear();
      componente.infoForm.patchValue({ coverUrl: CDN });

      await componente.guardarInfo();

      expect(ultimoPayload().coverUrl).toBe(CDN);
    });

    it('debería cargar la URL guardada tal cual, para que la imagen se vea', async () => {
      await crear(miComercio({ logoUrl: CDN, coverUrl: CDN } as Partial<MiComercio>));

      expect(componente.infoForm.getRawValue().logoUrl).toBe(CDN);
      expect(componente.infoForm.getRawValue().coverUrl).toBe(CDN);
    });

    it('debería dejar el control vacío si el comercio no tiene imagen', async () => {
      await crear();

      expect(componente.infoForm.getRawValue().logoUrl).toBeNull();
    });

    it('no debería enviar la imagen si no se ha subido ninguna', async () => {
      // `null` borraría el valor guardado; se omite el campo.
      await crear();

      await componente.guardarInfo();

      expect(ultimoPayload().logoUrl).toBeUndefined();
    });

    it('debería aguantar el viaje completo: cargar, no tocar y volver a guardar', async () => {
      // Es el caso que rompía: se guardaba bien la primera vez y al reguardar
      // sobre lo cargado se troceaba la URL.
      await crear(miComercio({ logoUrl: CDN } as Partial<MiComercio>));

      await componente.guardarInfo();

      expect(ultimoPayload().logoUrl).toBe(CDN);
    });
  });

  describe('documentación de verificación', () => {
    const DOC = 'https://cdn.doogking.com/dni.pdf';

    it('debería guardar entera la URL del documento de identidad y la licencia', async () => {
      await crear();
      componente.verificacionForm.patchValue({ documentoIdentidadUrl: DOC, licenciaNegocioUrl: DOC });

      await componente.guardarVerificacion();

      expect(ultimoPayload().documentoIdentidadUrl).toBe(DOC);
      expect(ultimoPayload().licenciaNegocioUrl).toBe(DOC);
    });

    it('debería enviar sólo los campos que aporta el comercio en cada documento', async () => {
      // `estado` y `subidoAt` los fija el servidor; devolvérselos hace que el API
      // rechace la petición entera con 400.
      await crear();
      componente.docsAdicionales.set([{
        tipo: 'seguro_rc', nombre: 'Póliza', url: DOC, fechaCaducidad: '2027-01-31',
        estado: 'verificado', subidoAt: new Date(),
      } as never]);

      await componente.guardarDocumentacion();

      const [documento] = ultimoPayload().documentos as Record<string, unknown>[];
      expect(documento).toEqual({
        tipo: 'seguro_rc', nombre: 'Póliza', url: DOC, fechaCaducidad: '2027-01-31',
      });
      expect(documento['estado']).toBeUndefined();
    });
  });
  /**
   * Paso a paso con escapatoria: guardar avanza a la sección siguiente, pero las
   * pestañas siguen siendo navegables. Es una pantalla de ajustes a la que se
   * vuelve; obligar a recorrer once pasos para cambiar un teléfono sería peor
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
      expect(componente.tab()).toBe('ubicacion');
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

      expect(componente.tab()).toBe('ubicacion');
    });

    it('no debería retroceder más allá del primero', async () => {
      await crear();

      componente.pasoAnterior();

      expect(componente.pasoActual()).toBe(1);
    });

    it('no debería avanzar más allá del último', async () => {
      await crear();
      componente.cambiarTab('plan');
      expect(componente.esUltimoPaso()).toBe(true);

      await componente.continuar(Promise.resolve(true));

      expect(componente.tab()).toBe('plan');
    });

    it('debería dejar saltar las secciones que no guardan nada', async () => {
      await crear();
      componente.cambiarTab('notificaciones');
      const antes = componente.pasoActual();

      await componente.saltarPaso();

      expect(componente.pasoActual()).toBe(antes + 1);
    });

    it('debería seguir permitiendo ir directo a cualquier pestaña', async () => {
      // La escapatoria: quien vuelve sólo a cambiar el IBAN no recorre diez pasos.
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
      // Redes o plan no se marcan ni como hechas ni como pendientes.
      await crear();

      expect(componente.estadoSeccion('redes')).toBeNull();
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
  describe('calendario de días especiales', () => {
    /** Primer día del mes visible que no está en el pasado ni ya marcado. */
    const primerDisponible = () =>
      componente.celdasExcepciones().find((c) => c.delMes && !c.pasado && !c.yaEsExcepcion)!;

    it('debería pintar seis semanas empezando en lunes', async () => {
      await crear();
      const celdas = componente.celdasExcepciones();

      expect(celdas).toHaveLength(42);
      const [anio, mes, dia] = celdas[0].clave.split('-').map(Number);
      expect(new Date(anio, mes - 1, dia).getDay()).toBe(1);
    });

    it('debería empezar sin ningún día marcado', async () => {
      await crear();

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería marcar y desmarcar un día al pulsarlo', async () => {
      await crear();
      const celda = primerDisponible();

      componente.alternarDiaExcepcion(celda);
      expect(componente.totalSeleccionados()).toBe(1);

      componente.alternarDiaExcepcion(celda);
      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('no debería dejar marcar un día que ya pasó', async () => {
      // Marcar un festivo pasado no cambia nada; invitar a hacerlo confunde.
      await crear();
      const pasado = componente.celdasExcepciones().find((c) => c.pasado);
      if (!pasado) return;

      componente.alternarDiaExcepcion(pasado);

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería moverse de mes hacia delante y hacia atrás', async () => {
      await crear();
      const inicial = componente.mesExcepciones().getMonth();

      componente.cambiarMesExcepciones(1);
      expect(componente.mesExcepciones().getMonth()).toBe((inicial + 1) % 12);

      componente.cambiarMesExcepciones(-1);
      expect(componente.mesExcepciones().getMonth()).toBe(inicial);
    });

    it('debería marcar de golpe todo el mes visible', async () => {
      // El caso de las vacaciones de agosto.
      await crear();
      componente.cambiarMesExcepciones(1);

      componente.seleccionarMesEntero();

      const delMes = componente.celdasExcepciones().filter((c) => c.delMes && !c.pasado);
      expect(componente.totalSeleccionados()).toBe(delMes.length);
    });

    it('debería poder quitar toda la selección', async () => {
      await crear();
      componente.seleccionarMesEntero();

      componente.limpiarSeleccion();

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería aplicar el mismo motivo y horario a todos los días marcados', async () => {
      await crear();
      componente.cambiarMesExcepciones(1);
      componente.seleccionarMesEntero();
      const marcados = componente.totalSeleccionados();
      componente.nuevaExcepcionMotivo.set('Vacaciones');
      componente.nuevaExcepcionCerrado.set(true);

      componente.anadirSeleccionados();

      expect(componente.excepciones()).toHaveLength(marcados);
      expect(componente.excepciones().every((e) => e.motivo === 'Vacaciones')).toBe(true);
      expect(componente.excepciones().every((e) => e.cerrado)).toBe(true);
    });

    it('debería guardar el horario reducido cuando no se cierra el día', async () => {
      await crear();
      componente.cambiarMesExcepciones(1);
      componente.alternarDiaExcepcion(primerDisponible());
      componente.nuevaExcepcionCerrado.set(false);
      componente.nuevaExcepcionAbre.set('10:00');
      componente.nuevaExcepcionCierra.set('14:00');

      componente.anadirSeleccionados();

      expect(componente.excepciones()[0]).toMatchObject({ abre: '10:00', cierra: '14:00', cerrado: false });
    });

    it('debería limpiar la selección y el motivo tras aplicarlos', async () => {
      // Si no, el siguiente puente heredaría el motivo del anterior.
      await crear();
      componente.cambiarMesExcepciones(1);
      componente.alternarDiaExcepcion(primerDisponible());
      componente.nuevaExcepcionMotivo.set('Navidad');

      componente.anadirSeleccionados();

      expect(componente.totalSeleccionados()).toBe(0);
      expect(componente.nuevaExcepcionMotivo()).toBe('');
    });

    it('no debería hacer nada sin días marcados', async () => {
      await crear();

      componente.anadirSeleccionados();

      expect(componente.excepciones()).toEqual([]);
    });

    it('debería marcar en el calendario los días ya guardados', async () => {
      await crear();
      componente.cambiarMesExcepciones(1);
      const celda = primerDisponible();
      componente.alternarDiaExcepcion(celda);
      componente.anadirSeleccionados();

      const yaPuesta = componente.celdasExcepciones().find((c) => c.clave === celda.clave)!;
      expect(yaPuesta.yaEsExcepcion).toBe(true);
    });

    it('no debería dejar volver a marcar un día que ya es especial', async () => {
      // Se quita desde la lista, no volviéndolo a marcar en el calendario.
      await crear();
      componente.cambiarMesExcepciones(1);
      const celda = primerDisponible();
      componente.alternarDiaExcepcion(celda);
      componente.anadirSeleccionados();

      const yaPuesta = componente.celdasExcepciones().find((c) => c.clave === celda.clave)!;
      componente.alternarDiaExcepcion(yaPuesta);

      expect(componente.totalSeleccionados()).toBe(0);
    });

    it('debería reemplazar el día si ya existía, no duplicarlo', async () => {
      await crear();
      componente.cambiarMesExcepciones(1);
      const celda = primerDisponible();
      componente.alternarDiaExcepcion(celda);
      componente.nuevaExcepcionMotivo.set('Primera');
      componente.anadirSeleccionados();

      // Se fuerza el mismo día por la vía de uno en uno.
      componente.nuevaExcepcionFecha.set(celda.clave);
      componente.nuevaExcepcionMotivo.set('Corregida');
      componente.anadirExcepcion();

      expect(componente.excepciones()).toHaveLength(1);
      expect(componente.excepciones()[0].motivo).toBe('Corregida');
    });

    it('debería mostrar la fecha en formato legible, no en ISO', async () => {
      await crear();

      const texto = componente.fechaLarga('2026-08-03');

      expect(texto).not.toBe('2026-08-03');
      expect(texto).toContain('2026');
    });
  });
});
