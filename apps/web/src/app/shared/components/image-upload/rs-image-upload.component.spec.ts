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
});
