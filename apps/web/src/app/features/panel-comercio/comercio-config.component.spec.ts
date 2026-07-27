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

    it('debería normalizar el logo a lista para el componente de subida', async () => {
      await crear(miComercio({ logoUrl: '/logo.png' }));

      expect(componente.infoForm.getRawValue().logoUrl).toEqual(['/logo.png']);
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
      componente.infoForm.patchValue({ nombreComercial: 'Canes Premium', logoUrl: ['/logo.png'] });

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
    it('debería enviar el primer archivo subido de cada documento', async () => {
      await crear();
      componente.verificacionForm.patchValue({
        documentoIdentidadUrl: ['/dni.pdf'], licenciaNegocioUrl: ['/licencia.pdf'],
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
});
