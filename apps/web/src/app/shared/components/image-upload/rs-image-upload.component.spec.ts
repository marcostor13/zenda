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
});
