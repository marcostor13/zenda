import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoEncontradoComponent } from './no-encontrado.component';
import { SeoService } from '../../core/seo/seo.service';

describe('NoEncontradoComponent', () => {
  let fixture: ComponentFixture<NoEncontradoComponent>;
  let seo: jest.Mocked<Pick<SeoService, 'aplicar' | 'noEncontrado'>>;

  beforeEach(async () => {
    seo = { aplicar: jest.fn(), noEncontrado: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [NoEncontradoComponent],
      providers: [
        provideRouter([]),
        // La barra de navegación y el buscador que trae la página hablan con el
        // API; aquí sólo interesa lo que la 404 dice y adónde deja ir.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SeoService, useValue: seo },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NoEncontradoComponent);
    fixture.detectChanges();
  });

  it('debería explicar en castellano que la página no existe', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Esta página no existe');
  });

  /**
   * Es lo que de verdad le dice a Google que la URL no existe. Sin esto el
   * servidor respondía 200 con la portada dentro, y el buscador concluía que
   * esa dirección era una página legítima.
   */
  it('debería marcar la respuesta del servidor como 404', () => {
    expect(seo.noEncontrado).toHaveBeenCalled();
  });

  it('debería pedir que la página no se indexe', () => {
    expect(seo.aplicar).toHaveBeenCalledWith(expect.objectContaining({ indexable: false }));
  });

  /** Quien llega aquí venía buscando algo: la salida tiene que ser útil, no sólo un aviso. */
  it('debería ofrecer las categorías y la vuelta a la portada', () => {
    const elemento = fixture.nativeElement as HTMLElement;
    const enlaces = Array.from(elemento.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(enlaces).toContain('/');
    expect(enlaces).toContain('/alojamiento');
  });
});
