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

  /**
   * Partes de diagnóstico enviados. Son telemetría: se mandan sin esperar
   * respuesta, así que aquí se drenan para que `verify()` no los cuente como
   * peticiones sueltas.
   */
  const partes = (): Record<string, unknown>[] => {
    const peticiones = httpMock.match((r) => r.url.endsWith('/upload/diagnostico'));
    const cuerpos = peticiones.map((r) => r.request.body as Record<string, unknown>);
    peticiones.forEach((r) => r.flush(null, { status: 204, statusText: 'No Content' }));
    return cuerpos;
  };

  afterEach(() => {
    partes();
    httpMock.verify();
  });

  /**
   * Elige un fichero y espera a que la petición esté en vuelo.
   *
   * Hace falta esperar porque la imagen se prepara antes de subirla (convertir
   * el HEIC del iPhone, reducirla si no cabe), y eso es asíncrono aunque no haya
   * nada que preparar.
   */
  async function subirArchivo(): Promise<void> {
    const file = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });
    component.onFileChange({ target: { files: [file], value: '' } } as unknown as Event);
    await fixture.whenStable();
  }

  it('en modo single (multiple=false) debería emitir un string, no un array', async () => {
    component.multiple = false;
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    await subirArchivo();
    const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
    req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
    await fixture.whenStable();

    expect(onChange).toHaveBeenCalledWith('https://cdn.doogking.com/foto.jpg');
  });

  it('en modo multiple debería emitir un array de strings', async () => {
    component.multiple = true;
    const onChange = jest.fn();
    component.registerOnChange(onChange);

    await subirArchivo();
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
      await subirArchivo();
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

    it('debería invalidar el control mientras la subida está en curso', async () => {
      await subirArchivo();

      expect(component.validate({} as never)).toEqual({ subidaEnCurso: true });

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
    });

    it('debería reintentar la subida fallida sin volver a elegir el fichero', async () => {
      await fallarConEstado(500);

      component.reintentar();
      await fixture.whenStable();

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

    it('NO debería subir un HEIC sin convertir, y debería explicar por qué', async () => {
      /*
       * Antes se subía en crudo "por si acaso": el API lo aceptaba, la subida
       * parecía ir bien y la ficha quedaba con una foto que sólo se ve desde
       * Safari. Un anuncio con la imagen rota para el resto del mundo es peor
       * que un aviso que se puede accionar.
       */
      sinDecodificador();

      elegir('IMG_0042.HEIC', 'image/heic');
      await esperarConversion();

      httpMock.expectNone(`${environment.apiUrl}/upload/image`);
      expect(component.mensajeError()).toContain('HEIC');
      expect(component.validate({} as never)).toEqual({ subidaFallida: true });
    });

    it('debería aceptar la foto aunque iOS no rellene el tipo', async () => {
      // Pasa cuando llega desde la app Archivos. Antes se descartaba en silencio:
      // el usuario elegía su foto y no ocurría nada.
      conCanvasQueConvierte();

      elegir('IMG_0042.HEIC', '');
      await esperarConversion();

      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
      req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
      await fixture.whenStable();
    });

    it('debería avisar de la foto que iCloud no ha descargado, en vez de subir 0 bytes', async () => {
      // iOS entrega un fichero vacío cuando la foto sólo está en la nube. El
      // servidor respondía 422 y el usuario leía "formato no válido".
      const vacia = new File([], 'IMG_0043.JPG', { type: 'image/jpeg' });
      component.onFileChange({ target: { files: [vacia], value: '' } } as unknown as Event);
      await esperarConversion();

      httpMock.expectNone(`${environment.apiUrl}/upload/image`);
      expect(component.mensajeError()).toContain('iCloud');
    });

    it('debería enseñar la casilla en cuanto se elige la foto, sin esperar a convertirla', async () => {
      // Convertir una foto de 48 MP tarda segundos en un iPhone: sin la casilla
      // con su indicador de carga parecía que elegir la foto no hacía nada.
      conCanvasQueConvierte();

      elegir('IMG_0042.HEIC', 'image/heic');

      expect(component.slots()).toHaveLength(1);
      expect(component.slots()[0].uploading).toBe(true);

      await esperarConversion();
      const req = httpMock.expectOne(`${environment.apiUrl}/upload/image`);
      req.flush({ url: 'https://cdn.doogking.com/foto.jpg' });
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

  it('no debería pedir HEIC en el selector, para que iOS entregue la foto ya convertida', () => {
    /*
     * iOS convierte la foto del carrete a JPEG al entregarla salvo que la página
     * declare que acepta HEIC. Declararlo hacía que Safari mandase el original y
     * dejaba la conversión en manos del navegador, que es justo donde fallaba.
     * El comodín no vacía el selector: eso pasa con listas cerradas de tipos.
     */
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');

    expect(input.accept).toBe('image/*');
  });
  /**
   * Diagnóstico de subidas. Los fallos que importan pasan en el móvil de otra
   * persona: sin parte no hay forma de distinguir una foto en iCloud de un HEIC
   * que el navegador no supo abrir o de una sesión caducada.
   */
  describe('parte de diagnostico', () => {
    it('deberia avisar de lo que se descarta por formato', async () => {
      const hoja = new File(['x'], 'hoja.xlsx', { type: 'application/vnd.ms-excel' });
      component.onFileChange({ target: { files: [hoja], value: '' } } as unknown as Event);
      await fixture.whenStable();

      const [parte] = partes();
      expect(parte['paso']).toBe('descartado');
      expect(parte['nombre']).toBe('hoja.xlsx');
    });

    it('deberia avisar de una foto que llega vacia', async () => {
      /*
       * Pasa con las fotos que viven en iCloud y no estan descargadas: iOS
       * entrega un fichero de 0 bytes sin decir nada.
       *
       * Se usa un JPEG y no un HEIC a proposito: jsdom no implementa
       * `createImageBitmap` ni dispara los eventos de `<img>`, asi que un HEIC
       * se quedaria esperando la decodificacion hasta agotar el tiempo. El caso
       * que se comprueba —fichero de 0 bytes— es el mismo.
       */
      const vacia = new File([], 'IMG_0001.jpg', { type: 'image/jpeg' });
      component.onFileChange({ target: { files: [vacia], value: '' } } as unknown as Event);
      await fixture.whenStable();

      const [parte] = partes();
      expect(parte['paso']).toBe('vacio');
    });

    it('deberia contar el codigo cuando el servidor rechaza la foto', async () => {
      await subirArchivo();
      httpMock.expectOne(`${environment.apiUrl}/upload/image`)
        .flush({ message: 'no' }, { status: 422, statusText: 'Unprocessable Entity' });
      await fixture.whenStable();

      const parte = partes().find((c) => c['paso'] === 'error_http');
      expect(parte).toBeDefined();
      expect(parte!['estadoHttp']).toBe(422);
    });

    it('deberia decir desde que pantalla se subia', async () => {
      // Sin esto, en el registro no se distingue el logotipo del comercio de
      // la foto de un perro.
      component.origen = 'perro/fotos';
      const hoja = new File(['x'], 'hoja.xlsx', { type: 'application/vnd.ms-excel' });
      component.onFileChange({ target: { files: [hoja], value: '' } } as unknown as Event);
      await fixture.whenStable();

      expect(partes()[0]['origen']).toBe('perro/fotos');
    });

    it('deberia registrar tambien las subidas que salen bien', async () => {
      // Sin el denominador no se sabe si falla una de cada cien o la mitad.
      await subirArchivo();
      httpMock.expectOne(`${environment.apiUrl}/upload/image`)
        .flush({ url: 'https://cdn.doogking.com/f.jpg' });
      await fixture.whenStable();

      expect(partes().some((c) => c['paso'] === 'subida')).toBe(true);
    });

    it('no deberia mandar el contenido del fichero', async () => {
      // El parte viaja a los registros del servidor: sólo lleva metadatos.
      const hoja = new File(['contenido secreto'], 'hoja.xlsx', { type: 'application/vnd.ms-excel' });
      component.onFileChange({ target: { files: [hoja], value: '' } } as unknown as Event);
      await fixture.whenStable();

      expect(JSON.stringify(partes()[0])).not.toContain('contenido secreto');
    });
  });
});
