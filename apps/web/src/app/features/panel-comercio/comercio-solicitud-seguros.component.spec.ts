import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { MAX_ASEGURADORAS, VerticalKey } from 'shared';
import { ComercioSolicitudSegurosComponent } from './comercio-solicitud-seguros.component';
import { ComercioApiService } from './comercio-api.service';
import { environment } from '../../../environments/environment';

describe('ComercioSolicitudSegurosComponent', () => {
  let fixture: ComponentFixture<ComercioSolicitudSegurosComponent>;
  let componente: ComercioSolicitudSegurosComponent;
  let comercioApi: { crearServicio: jest.Mock };
  let http: HttpTestingController;
  let router: Router;

  const montar = async (): Promise<void> => {
    comercioApi = { crearServicio: jest.fn().mockReturnValue(of({ _id: 's1' })) };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ComercioSolicitudSegurosComponent, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ComercioApiService, useValue: comercioApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComercioSolicitudSegurosComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  };

  const rellenarFormulario = (): void => {
    componente.form.patchValue({
      contactoNombre: 'Ana Gestora',
      contactoEmail: 'ana@aseguradora.es',
      contactoTelefono: '+34600111222',
      razonSocial: 'Mascotas Seguras S.A.',
      nifCif: 'B12345678',
    });
  };

  const conDocumento = (): void => {
    componente.documentos.set([{ nombre: 'condiciones.pdf', url: 'https://cdn/condiciones.pdf' }]);
  };

  /** Dispara el input de ficheros con los archivos indicados. */
  const subir = (ficheros: File[]): Promise<void> => {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: ficheros, writable: true });
    return componente.subir({ target: input } as unknown as Event);
  };

  const ficheroFalso = (nombre: string): File =>
    new File(['contenido'], nombre, { type: 'application/pdf' });

  beforeEach(async () => await montar());
  afterEach(() => http.verify());

  describe('validación del formulario', () => {
    it('no debería enviar nada con el formulario incompleto', async () => {
      await componente.enviar();

      expect(comercioApi.crearServicio).not.toHaveBeenCalled();
      expect(componente.form.controls.contactoNombre.touched).toBe(true);
    });

    it('debería marcar en rojo un campo obligatorio que se ha dejado vacío', () => {
      componente.form.controls.contactoEmail.markAsTouched();

      expect(componente.malo('contactoEmail')).toBe(true);
    });

    it('no debería marcar un campo que aún no se ha tocado', () => {
      expect(componente.malo('contactoEmail')).toBe(false);
    });

    it('no debería marcar un campo que no existe', () => {
      expect(componente.malo('inventado')).toBe(false);
    });

    it('debería exigir un email con forma de email', () => {
      componente.form.patchValue({ contactoEmail: 'no-es-un-email' });

      expect(componente.form.controls.contactoEmail.invalid).toBe(true);
    });
  });

  describe('documentos', () => {
    it('debería exigir al menos un documento de condiciones', async () => {
      rellenarFormulario();

      await componente.enviar();

      expect(componente.errorDocs()).toContain('Sube al menos un documento');
      expect(comercioApi.crearServicio).not.toHaveBeenCalled();
    });

    it('debería subir cada fichero elegido y quedarse con su url', async () => {
      const promesa = subir([ficheroFalso('condiciones.pdf')]);

      const peticion = http.expectOne(`${environment.apiUrl}/upload/documento`);
      peticion.flush({ url: 'https://cdn/condiciones.pdf' });
      await promesa;

      expect(componente.documentos()).toEqual([
        { nombre: 'condiciones.pdf', url: 'https://cdn/condiciones.pdf' },
      ]);
      expect(componente.subiendo()).toBe(false);
    });

    it('debería subir varios ficheros de una vez', async () => {
      const promesa = subir([ficheroFalso('uno.pdf'), ficheroFalso('dos.pdf')]);

      http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: 'https://cdn/uno.pdf' });
      await Promise.resolve();
      http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: 'https://cdn/dos.pdf' });
      await promesa;

      expect(componente.documentos().map((d) => d.nombre)).toEqual(['uno.pdf', 'dos.pdf']);
    });

    it('no debería hacer nada si no se elige ningún fichero', async () => {
      await subir([]);

      expect(componente.subiendo()).toBe(false);
      expect(componente.documentos()).toEqual([]);
    });

    it('debería explicar el fallo de subida sin dejar el aspa girando', async () => {
      const promesa = subir([ficheroFalso('condiciones.pdf')]);

      http.expectOne(`${environment.apiUrl}/upload/documento`)
        .flush('no', { status: 413, statusText: 'Payload Too Large' });
      await promesa;

      expect(componente.errorDocs()).toContain('No pudimos subir');
      expect(componente.subiendo()).toBe(false);
    });

    /* Sin vaciarlo, volver a elegir el mismo archivo no dispara el evento. */
    it('debería vaciar el campo de ficheros al terminar', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      Object.defineProperty(input, 'files', { value: [ficheroFalso('condiciones.pdf')] });

      const promesa = componente.subir({ target: input } as unknown as Event);
      http.expectOne(`${environment.apiUrl}/upload/documento`).flush({ url: 'https://cdn/x.pdf' });
      await promesa;

      expect(input.value).toBe('');
    });

    it('debería poder quitar un documento ya subido', () => {
      componente.documentos.set([
        { nombre: 'uno.pdf', url: 'https://cdn/uno.pdf' },
        { nombre: 'dos.pdf', url: 'https://cdn/dos.pdf' },
      ]);

      componente.quitar('https://cdn/uno.pdf');

      expect(componente.documentos().map((d) => d.nombre)).toEqual(['dos.pdf']);
    });
  });

  describe('envío de la solicitud', () => {
    it('debería crear la ficha del vertical con lo que ha declarado la compañía', async () => {
      rellenarFormulario();
      conDocumento();

      await componente.enviar();

      expect(comercioApi.crearServicio).toHaveBeenCalledWith(expect.objectContaining({
        vertical: VerticalKey.SEGUROS,
        titulo: 'Mascotas Seguras S.A.',
        // El comercio no pone precios ni coberturas: eso se configura al aprobar.
        precioBase: 0,
      }));
      expect(componente.enviada()).toBe(true);
    });

    it('debería guardarla pendiente de revisión, no publicada', async () => {
      rellenarFormulario();
      conDocumento();

      await componente.enviar();

      const extra = comercioApi.crearServicio.mock.calls[0][0].extra;
      expect(extra.estadoSolicitud).toBe('pendiente');
      expect(extra.solicitud.documentos).toHaveLength(1);
      expect(extra.solicitud.enviadaEn).toBeTruthy();
    });

    it('debería omitir los campos opcionales que se dejan en blanco', async () => {
      // Guardar cadenas vacías haría que la ficha del admin enseñara etiquetas
      // sin contenido en vez de omitirlas.
      rellenarFormulario();
      conDocumento();

      await componente.enviar();

      const { solicitud } = comercioApi.crearServicio.mock.calls[0][0].extra;
      expect(solicitud.contacto.cargo).toBeUndefined();
      expect(solicitud.aseguradora.registroDgs).toBeUndefined();
      expect(solicitud.aseguradora.web).toBeUndefined();
      expect(solicitud.notas).toBeUndefined();
    });

    it('debería conservar los campos opcionales que sí se rellenan', async () => {
      rellenarFormulario();
      conDocumento();
      componente.form.patchValue({
        contactoCargo: 'Directora de alianzas',
        registroDgs: 'C0123',
        web: 'https://mascotasseguras.es',
        ambito: 'Madrid',
        notas: 'Trabajamos con clínicas concertadas.',
      });

      await componente.enviar();

      const payload = comercioApi.crearServicio.mock.calls[0][0];
      expect(payload.ciudad).toBe('Madrid');
      expect(payload.extra.solicitud.contacto.cargo).toBe('Directora de alianzas');
      expect(payload.extra.solicitud.aseguradora.registroDgs).toBe('C0123');
      expect(payload.extra.solicitud.notas).toBe('Trabajamos con clínicas concertadas.');
    });

    it('debería asumir España cuando no se declara ámbito', async () => {
      rellenarFormulario();
      conDocumento();

      await componente.enviar();

      expect(comercioApi.crearServicio.mock.calls[0][0].ciudad).toBe('España');
    });

    it('debería explicar el fallo sin dar la solicitud por enviada', async () => {
      comercioApi.crearServicio.mockReturnValue(throwError(() => new Error('500')));
      rellenarFormulario();
      conDocumento();

      await componente.enviar();

      expect(componente.error()).toContain('No pudimos enviar la solicitud');
      expect(componente.enviada()).toBe(false);
      expect(componente.enviando()).toBe(false);
    });
  });

  describe('detalles de la pantalla', () => {
    it('debería nombrar a la compañía en cuanto se escribe su razón social', () => {
      componente.form.patchValue({ razonSocial: '  Mascotas Seguras S.A.  ' });

      expect(componente.nombreCompania()).toBe('Mascotas Seguras S.A.');
    });

    it('debería hablar de «tu compañía» mientras no haya razón social', () => {
      expect(componente.nombreCompania()).toBe('tu compañía');
    });

    it('debería exponer el límite de aseguradoras que fija el dominio', () => {
      expect(componente.maximo).toBe(MAX_ASEGURADORAS);
    });

    it('debería llevar al panel del comercio al terminar', () => {
      componente.irAlPanel();

      expect(router.navigate).toHaveBeenCalledWith(['/comercio']);
    });

    it('no debería ofrecer el botón de volver fuera del alta guiada', () => {
      expect(componente.mostrarVolver()).toBe(false);
    });
  });
});
