import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RsImageUploadComponent } from './rs-image-upload.component';
import { environment } from '../../../../environments/environment';

describe('RsImageUploadComponent', () => {
  let fixture: ComponentFixture<RsImageUploadComponent>;
  let component: RsImageUploadComponent;
  let httpMock: HttpTestingController;

  beforeAll(() => {
    // jsdom no implementa URL.createObjectURL/revokeObjectURL.
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsImageUploadComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RsImageUploadComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function subirArchivo(): void {
    const file = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });
    component.onFileChange({ target: { files: [file], value: '' } } as unknown as Event);
  }

  it('en modo single (multiple=false) debería emitir un string, no un array', async () => {
    component.multiple = false;
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    subirArchivo();
    const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
    req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
    await fixture.whenStable();

    expect(onChange).toHaveBeenCalledWith('https://cdn.doogking.com/foto.jpg');
  });

  it('en modo multiple debería emitir un array de strings', async () => {
    component.multiple = true;
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    subirArchivo();
    const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
    req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
    await fixture.whenStable();

    expect(onChange).toHaveBeenCalledWith(['https://cdn.doogking.com/foto.jpg']);
  });

  it('writeValue con un string en modo single debería mostrar un slot', () => {
    component.writeValue('https://cdn.doogking.com/existente.jpg');
    expect(component.slots()).toHaveLength(1);
    expect(component.slots()[0].uploadedUrl).toBe('https://cdn.doogking.com/existente.jpg');
  });

  it('writeValue con null debería vaciar los slots', () => {
    component.writeValue('https://cdn.doogking.com/existente.jpg');
    component.writeValue(null);
    expect(component.slots()).toHaveLength(0);
  });

  describe('cuando la subida falla (TCK-8012)', () => {
    /** Provoca un fallo de subida con el estado HTTP indicado. */
    async function fallarConEstado(status: number, body: unknown = {}): Promise<void> {
      subirArchivo();
      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      req.flush(body, { status, statusText: 'Error' });
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('debería mostrar el motivo del fallo en pantalla', async () => {
      await fallarConEstado(503, { message: 'La subida de imágenes no está configurada.' });

      expect(component.mensajeError()).toBe('La subida de imágenes no está configurada.');
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('La subida de imágenes no está configurada.');
    });

    it('debería explicar la falta de conexión cuando el servidor no responde', async () => {
      await fallarConEstado(0);

      expect(component.mensajeError()).toContain('sin conexión con el servidor');
    });

    it('debería explicar el formato o tamaño no válido ante un 422', async () => {
      await fallarConEstado(422);

      expect(component.mensajeError()).toContain('menos de 5 MB');
    });

    it('debería invalidar el control para que el formulario no se guarde sin foto', async () => {
      await fallarConEstado(500);

      expect(component.validate({} as never)).toEqual({ subidaFallida: true });
    });

    it('debería invalidar el control mientras la subida está en curso', () => {
      subirArchivo();

      expect(component.validate({} as never)).toEqual({ subidaEnCurso: true });

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
    });

    it('debería reintentar la subida fallida sin volver a elegir el fichero', async () => {
      await fallarConEstado(500);

      component.reintentar();
      const reintento = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      reintento.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
      await fixture.whenStable();

      expect(component.mensajeError()).toBe('');
      expect(component.validate({} as never)).toBeNull();
    });

    it('debería limpiar el aviso al quitar el slot fallido', async () => {
      await fallarConEstado(500);

      component.removeSlot(component.slots()[0].id);

      expect(component.mensajeError()).toBe('');
      expect(component.validate({} as never)).toBeNull();
    });
  });
  /**
   * Fotos de iPhone. Desde iOS 11 el carrete guarda en HEIC, que sólo Safari
   * sabe pintar: se convierte a JPEG antes de subir para que la imagen se vea
   * también desde Chrome y Android.
   */
  describe('fotos de iPhone (HEIC)', () => {
    /** Simula la decodificación y el volcado a JPEG que hace Safari. */
    function conCanvasQueConvierte(): void {
      global.createImageBitmap = jest.fn().mockResolvedValue({
        width: 100, height: 80, close: jest.fn(),
      }) as never;

      jest.spyOn(document, 'createElement').mockImplementation((etiqueta: string) => {
        if (etiqueta !== 'canvas') {
          return Object.getPrototypeOf(document).createElement.call(document, etiqueta) as HTMLElement;
        }
        return {
          width: 0, height: 0,
          getContext: () => ({ drawImage: jest.fn() }),
          toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['jpeg'], { type: 'image/jpeg' })),
        } as unknown as HTMLCanvasElement;
      });
    }

    /** Lo que hace el navegador de escritorio: no sabe decodificar HEIC. */
    function sinDecodificador(): void {
      global.createImageBitmap = jest.fn().mockRejectedValue(new Error('sin decodificador')) as never;
    }

    function elegir(nombre: string, tipo: string): void {
      const file = new File(['contenido'], nombre, { type: tipo });
      component.onFileChange({ target: { files: [file], value: '' } } as unknown as Event);
    }

    /**
     * La conversión encadena varias promesas (decodificar, pintar, volcar a
     * JPEG); `whenStable` no basta para vaciar esa cola antes de que salga la
     * petición.
     */
    const esperarConversion = (): Promise<void> =>
      new Promise((resolver) => setTimeout(resolver, 0));

    afterEach(() => jest.restoreAllMocks());

    it('debería subir la foto ya convertida a JPEG', async () => {
      conCanvasQueConvierte();

      elegir('IMG_0042.HEIC', 'image/heic');
      await esperarConversion();

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      const enviado = (req.request.body as FormData).get('file') as File;
      expect(enviado.type).toBe('image/jpeg');
      expect(enviado.name).toBe('IMG_0042.jpg');
      req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
      await fixture.whenStable();
    });

    it('debería intentar subirla igualmente si no se puede convertir', async () => {
      // El API acepta HEIC como último recurso: mejor eso que dejar al usuario
      // sin poder subir su foto.
      sinDecodificador();

      elegir('IMG_0042.HEIC', 'image/heic');
      await esperarConversion();

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
      req.flush({ url: 'https://cdn.doogking.com/foto.heic' });
      await fixture.whenStable();
    });

    it('debería aceptar la foto aunque iOS no rellene el tipo', async () => {
      // Pasa cuando llega desde la app Archivos. Antes se descartaba en silencio:
      // el usuario elegía su foto y no ocurría nada.
      sinDecodificador();

      elegir('IMG_0042.HEIC', '');
      await esperarConversion();

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      req.flush({ url: 'https://cdn.doogking.com/foto.heic' });
      await fixture.whenStable();
    });

    it('debería aceptar un JPEG sin tipo por su extensión', async () => {
      elegir('IMG_0042.JPG', '');
      await fixture.whenStable();

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
      await fixture.whenStable();
    });

    it('debería avisar en vez de callarse cuando el archivo no es una imagen', async () => {
      elegir('contrato.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      await fixture.whenStable();

      expect(component.mensajeError()).toContain('no es una imagen');
      httpMock.expectNone(`${environment.apiUrl}/upload/image`);
    });
  });

  it('debería ofrecer las fotos del carrete en el selector del sistema', () => {
    // Sin HEIC en el accept, iOS deja en gris las fotos del iPhone.
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');

    expect(input.accept).toContain('image/heic');
    expect(input.accept).toContain('.heic');
    expect(input.accept).toContain('image/jpeg');
  });
});
